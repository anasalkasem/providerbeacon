import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowUpRight,
  Headphones,
  Loader2,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { assistantCopy } from "@/i18n/assistant";
import { messagingCopy, messagingError } from "@/i18n/messaging";
import { explicitHumanRequest } from "../../../shared/messaging";
import MessageThread from "./MessageThread";
import { useSiteTheme } from "@/contexts/SiteAppearanceContext";
import { usePanelPresence } from "@/hooks/usePanelPresence";
import { SignalMark } from "./orbit/SignalMark";
import { usePageVisible } from "@/hooks/usePageVisible";
import { useMessageAlerts } from "@/hooks/useMessageAlerts";
import MessageAlertControls, { UnreadMessages } from "./MessageAlertControls";
import { unitLabel } from "@/i18n/pricing";
import { serviceName } from "./OfferEvidence";
import OfferPrice from "./OfferPrice";
import QuoteCost from "./QuoteCost";
import ConvertedQuote from "./ConvertedQuote";
import type { AssistantTurnInput } from "../../../shared/assistant";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type Reply = inferRouterOutputs<AppRouter>["assistant"]["chat"];
type Turn = {
  id: number;
  role: "user" | "assistant";
  content: string;
  result?: Reply;
};

export default function BeaconAssistant() {
  const [path] = useLocation();
  if (
    !/^\/(?:$|services(?:\/|$)|providers(?:\/|$)|compare$|find$|groups$|offers$|vip$|account(?:\/|$)|directory(?:\/|$))/.test(
      path
    )
  )
    return null;
  return (
    <AssistantChat
      path={
        /^\/(?:$|services(?:\/|$)|providers(?:\/|$)|compare$|find$)/.test(path)
          ? path
          : "/"
      }
    />
  );
}

function AssistantChat({ path }: { path: string }) {
  const { locale } = useLocale();
  const t = assistantCopy[locale];
  const mt = messagingCopy[locale];
  const [open, setOpen] = useState(false);
  const isOrbit = useSiteTheme() === "orbit";
  const panelPresent = usePanelPresence(open, isOrbit);
  const [supportId, setSupportId] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const visible = usePageVisible();
  const handoffIdentity = useRef<{ text: string; id: string } | null>(null);
  const support = trpc.messaging.support.current.useQuery(undefined, {
    retry: false,
    staleTime: 0,
    refetchInterval: query =>
      query.state.data?.id &&
      (query.state.data.status !== "closed" || query.state.data.unread > 0)
        ? visible
          ? 4000
          : 15000
        : false,
    refetchIntervalInBackground: true,
  });
  const notificationData = useMemo(
    () =>
      support.isError || support.data === undefined
        ? undefined
        : {
            unread: support.data?.unread ?? 0,
            items: support.data?.unread
              ? [
                  {
                    conversationId: support.data.id,
                    kind: "support" as const,
                    messageId: support.data.lastIncomingId,
                    name: support.data.name,
                  },
                ]
              : [],
          },
    [support.data, support.isError]
  );
  const alerts = useMessageAlerts({
    scope: support.data?.id ? `visitor:${support.data.id}` : null,
    data: notificationData,
    readingId: open && reading ? supportId : null,
    locale,
    onOpen: id => {
      setSupportId(id);
      setOpen(true);
    },
  });
  const handoff = trpc.messaging.support.start.useMutation({ retry: false });
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [failedRequest, setFailedRequest] = useState<AssistantTurnInput | null>(
    null
  );
  const launcher = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const counter = useRef(0);
  const sending = useRef(false);
  const status = trpc.assistant.status.useQuery(undefined, {
    enabled: open,
    staleTime: 60000,
    retry: false,
  });
  const chat = trpc.assistant.chat.useMutation({ retry: false });
  const ready = status.data?.available === true;

  useEffect(() => {
    if (support.data && support.data.status !== "closed")
      setSupportId(support.data.id);
  }, [support.data?.id, support.data?.status]);

  async function startHuman(
    text = draft.trim() || mt.startText,
    history = turns
      .slice(-12)
      .map(({ role, content }) => ({ role, content: content.slice(0, 2000) }))
  ) {
    if (handoff.isPending) return;
    setFailure(null);
    if (handoffIdentity.current?.text !== text)
      handoffIdentity.current = { text, id: crypto.randomUUID() };
    try {
      const result = await handoff.mutateAsync({
        locale,
        text,
        history,
        clientId: handoffIdentity.current.id,
      });
      setSupportId(result.id);
      setDraft("");
      handoffIdentity.current = null;
      void support.refetch();
    } catch (error) {
      setFailure(messagingError(locale, error));
    }
  }

  useEffect(() => {
    // Opening on a phone should not immediately cover the greeting with a keyboard.
    if (open && ready && !window.matchMedia?.("(pointer: coarse)").matches)
      field.current?.focus({ preventScroll: true });
  }, [open, ready]);
  useEffect(() => {
    log.current?.scrollTo({
      top: log.current.scrollHeight,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [turns, failure, chat.isPending]);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() =>
      launcher.current?.focus({ preventScroll: true })
    );
  };

  async function request(input: AssistantTurnInput, appendUser = true) {
    if (sending.current || !ready) return;
    sending.current = true;
    setFailure(null);
    setFailedRequest(null);
    setDraft("");
    if (appendUser)
      setTurns(current => [
        ...current,
        { id: ++counter.current, role: "user", content: input.message },
      ]);
    try {
      const response = await chat.mutateAsync(input);
      if (response.handoff) {
        await startHuman(input.message, input.history);
        return;
      }
      setTurns(current => [
        ...current,
        {
          id: ++counter.current,
          role: "assistant",
          content: response.answer || t.explanationUnavailable,
          result: response,
        },
      ]);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setFailure(
        code.includes("AI_LIMIT")
          ? t.limited
          : code.includes("AI_BUSY")
            ? t.busy
            : code.includes("AI_NOT_CONFIGURED")
              ? t.unavailable
              : t.error
      );
      setFailedRequest(input);
    } finally {
      sending.current = false;
      field.current?.focus();
    }
  }

  function send(message: string) {
    if (!message.trim()) return;
    if (explicitHumanRequest(message)) {
      void startHuman(message.trim());
      return;
    }
    const latest = [...turns]
      .reverse()
      .find(turn => turn.result?.offers.length)?.result;
    const routeIds =
      path === "/compare"
        ? (new URLSearchParams(window.location.search).get("services") ?? "")
            .split(",")
            .filter(id => /^service-[1-9]\d{0,9}$/.test(id))
            .slice(0, 4)
        : [];
    void request({
      message: message.trim(),
      locale,
      history: turns.slice(-6).map(({ role, content }) => ({
        role,
        content: content.slice(0, 2000),
      })),
      context: {
        path: path.slice(0, 250),
        offerIds: routeIds.length
          ? routeIds
          : (latest?.offers.map(offer => offer.service.id).slice(0, 4) ?? []),
      },
    });
  }

  return (
    <>
      <button
        ref={launcher}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="beacon-assistant"
        className={`beacon-assistant-launcher fixed end-5 z-[60] items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-lg ring-1 ring-copper hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${open ? "hidden" : "inline-flex"}`}
      >
        {isOrbit ? (
          <SignalMark />
        ) : (
          <Sparkles aria-hidden="true" className="size-5" />
        )}
        {t.launcher}
        <UnreadMessages count={notificationData?.unread ?? 0} />
      </button>
      {panelPresent && (
        <section
          id="beacon-assistant"
          role="dialog"
          data-state={open ? "open" : "closing"}
          aria-hidden={!open || undefined}
          inert={!open}
          aria-label={t.title}
          onKeyDown={event => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
          className="beacon-assistant-panel fixed inset-x-3 bottom-3 z-[70] flex h-[min(720px,calc(100dvh-24px))] flex-col overflow-hidden rounded-2xl border border-copper/70 bg-card text-foreground shadow-2xl sm:inset-x-auto sm:bottom-5 sm:end-5 sm:w-[430px]"
        >
          <header className="beacon-assistant-header flex shrink-0 items-center gap-3 border-b border-copper/50 bg-secondary p-4 text-heading">
            {isOrbit ? (
              <SignalMark />
            ) : (
              <Sparkles aria-hidden="true" className="size-6 text-copper" />
            )}
            <div className="flex-1">
              <h2 className="font-extrabold" dir="ltr">
                {supportId ? mt.supportTitle : t.title}
              </h2>
              <p className="mt-1 text-xs text-foreground">
                {supportId ? mt.supportIntro : t.subtitle}
              </p>
            </div>
            <UnreadMessages count={notificationData?.unread ?? 0} />
            <button
              type="button"
              title={t.clear}
              aria-label={t.clear}
              disabled={chat.isPending || handoff.isPending || !!supportId}
              onClick={() => {
                setTurns([]);
                setFailure(null);
                setFailedRequest(null);
                setDraft("");
                field.current?.focus();
              }}
              className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40"
            >
              <RotateCcw className="size-4" />
            </button>
            <button
              type="button"
              aria-label={t.close}
              onClick={close}
              className="rounded-lg p-2 hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
          </header>
          {support.data?.id && <MessageAlertControls alerts={alerts} />}
          {supportId ? (
            <MessageThread
              key={supportId}
              id={supportId}
              mode="visitor"
              onReadingChange={setReading}
              onBack={() => {
                setSupportId(null);
              }}
            />
          ) : (
            <>
              <div
                ref={log}
                role="log"
                aria-label={t.history}
                aria-live="polite"
                className="beacon-assistant-log min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4"
              >
                {status.isLoading && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {t.thinking}
                  </p>
                )}
                {!status.isLoading && !ready && (
                  <div className="rounded-xl bg-muted p-4 text-sm leading-7">
                    <p>{status.isError ? t.error : t.unavailable}</p>
                    <Link
                      href="/services"
                      onClick={close}
                      className="font-bold text-foreground underline"
                    >
                      {t.more}
                    </Link>
                    {status.isError && (
                      <button
                        onClick={() => void status.refetch()}
                        className="ms-3 font-bold text-foreground"
                      >
                        {t.retry}
                      </button>
                    )}
                  </div>
                )}
                {ready && turns.length === 0 && (
                  <div className="beacon-assistant-welcome space-y-4 py-3">
                    {isOrbit ? (
                      <>
                        <SignalMark className="beacon-signal--welcome" />
                        <h3>{t.welcomeTitle}</h3>
                      </>
                    ) : (
                      <MessageCircle
                        aria-hidden="true"
                        className="size-8 text-foreground"
                      />
                    )}
                    <p className="text-sm leading-7">{t.welcome}</p>
                    <div className="beacon-assistant-suggestions flex flex-col gap-2">
                      {t.examples.map(example => (
                        <button
                          key={example}
                          disabled={chat.isPending}
                          onClick={() => send(example)}
                          className="rounded-xl border border-border p-3 text-start text-sm font-medium hover:border-input hover:bg-secondary disabled:opacity-50"
                        >
                          <span>{example}</span>
                          {isOrbit && (
                            <ArrowUpRight
                              aria-hidden="true"
                              className="size-4 shrink-0 rtl:-scale-x-100"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {turns.map(turn => (
                  <article
                    key={turn.id}
                    data-speaker={turn.role}
                    className={
                      turn.role === "user"
                        ? "ms-8 rounded-2xl bg-secondary px-4 py-3 text-sm leading-7 text-foreground"
                        : "space-y-3 text-sm leading-7"
                    }
                  >
                    <p dir="auto" className="whitespace-pre-wrap break-words">
                      {turn.content}
                    </p>
                    {turn.result && (
                      <>
                        {turn.result.comparisonMissing && (
                          <p className="rounded-lg bg-warning-muted p-2 text-xs text-warning">
                            {t.missing}
                          </p>
                        )}
                        {turn.result.offers.length > 0 && (
                          <>
                            <p className="text-xs text-muted-foreground">
                              {t.currency}:{" "}
                              <bdi>{turn.result.displayCurrency}</bdi>
                              {turn.result.quantity != null && (
                                <>
                                  {" "}
                                  · {t.quantity}:{" "}
                                  <bdi>
                                    {turn.result.quantity.toLocaleString(
                                      locale
                                    )}
                                  </bdi>
                                </>
                              )}
                            </p>
                            {turn.result.offers.map(offer => (
                              <div
                                key={offer.service.id}
                                className="space-y-2 rounded-xl border border-border p-3"
                              >
                                <Link
                                  href={`/providers/${offer.provider.slug}`}
                                  onClick={close}
                                  className="font-bold text-foreground hover:underline"
                                >
                                  {offer.provider.name}
                                </Link>
                                <p
                                  dir="auto"
                                  className="text-sm font-semibold leading-6"
                                >
                                  {serviceName(locale, offer.service)}
                                </p>
                                <OfferPrice
                                  service={offer.service}
                                  lowest={offer.lowest}
                                />
                                <p className="text-xs text-muted-foreground">
                                  {unitLabel(locale, offer.service)}
                                </p>
                                {turn.result!.quantity != null ? (
                                  <QuoteCost
                                    service={offer.service}
                                    quantity={turn.result!.quantity}
                                    lowest={offer.lowest}
                                  />
                                ) : (
                                  <p className="text-xs text-muted-foreground">
                                    {t.quantityNeeded}
                                  </p>
                                )}
                                {offer.convertedTotal &&
                                  offer.fxAsOf != null && (
                                    <ConvertedQuote
                                      amount={offer.convertedTotal}
                                      currency={offer.displayCurrency}
                                      asOf={offer.fxAsOf}
                                      lowest={offer.lowest}
                                    />
                                  )}
                                {offer.total &&
                                  offer.service.priceCurrency !==
                                    offer.displayCurrency &&
                                  !offer.convertedTotal && (
                                    <p className="text-xs text-warning">
                                      {t.fxUnavailable}
                                    </p>
                                  )}
                                {offer.budgetStatus && (
                                  <p
                                    className={`text-xs font-bold ${offer.budgetStatus === "within" ? "text-success" : "text-warning"}`}
                                  >
                                    {offer.budgetStatus === "within"
                                      ? t.within
                                      : offer.budgetStatus === "above"
                                        ? t.above
                                        : t.budgetUnknown}
                                  </p>
                                )}
                                <Link
                                  href={`/providers/${offer.provider.slug}`}
                                  onClick={close}
                                  className="inline-block text-xs font-bold text-foreground underline"
                                >
                                  {t.provider}
                                </Link>
                              </div>
                            ))}
                            {turn.result.offers.length >= 2 && (
                              <Link
                                onClick={close}
                                href={`/compare?services=${turn.result.offers.map(offer => offer.service.id).join(",")}${turn.result.quantity != null ? `&quantity=${turn.result.quantity}` : ""}&currency=${turn.result.displayCurrency}`}
                                className="block rounded-xl bg-primary p-3 text-center text-sm font-bold text-primary-foreground"
                              >
                                {t.compare}
                              </Link>
                            )}
                            {turn.result.partial && (
                              <p className="text-xs text-muted-foreground">
                                {t.partial}
                              </p>
                            )}
                            <p className="text-xs leading-5 text-muted-foreground">
                              {t.priceNote}
                            </p>
                          </>
                        )}
                        <Link
                          href={turn.result.catalogueUrl}
                          onClick={close}
                          className="inline-block text-xs font-bold text-foreground underline"
                        >
                          {t.more}
                        </Link>
                      </>
                    )}
                  </article>
                ))}
                {(chat.isPending || handoff.isPending) && (
                  <p
                    role="status"
                    className="beacon-assistant-thinking flex items-center gap-2 text-sm text-foreground"
                  >
                    {isOrbit ? (
                      <span className="beacon-thinking-dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : (
                      <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                    )}
                    {handoff.isPending ? mt.connecting : t.thinking}
                  </p>
                )}
                {failure && (
                  <div
                    role="alert"
                    className="rounded-xl bg-warning-muted p-3 text-sm text-warning"
                  >
                    <p>{failure}</p>
                    {failedRequest && (
                      <button
                        type="button"
                        disabled={chat.isPending}
                        onClick={() => void request(failedRequest, false)}
                        className="mt-2 font-bold underline"
                      >
                        {t.retry}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="beacon-assistant-handoff shrink-0 border-t border-border px-3 py-2">
                <button
                  type="button"
                  disabled={
                    chat.isPending || handoff.isPending || support.isLoading
                  }
                  onClick={() =>
                    support.data?.status !== "closed" && support.data?.id
                      ? setSupportId(support.data.id)
                      : void startHuman()
                  }
                  className="w-full rounded-xl border border-input bg-secondary px-3 py-2 text-sm font-bold text-foreground disabled:opacity-50"
                >
                  {isOrbit && (
                    <Headphones aria-hidden="true" className="size-4" />
                  )}
                  {handoff.isPending
                    ? mt.connecting
                    : support.data?.status !== "closed" && support.data?.id
                      ? mt.resume
                      : mt.support}
                </button>
                <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                  {mt.supportPrivacy}
                </p>
              </div>
              <form
                className="beacon-assistant-composer shrink-0 border-t border-border bg-muted p-3"
                onSubmit={event => {
                  event.preventDefault();
                  send(draft);
                }}
              >
                <div className="beacon-composer-field flex items-end gap-2">
                  <textarea
                    ref={field}
                    rows={2}
                    maxLength={1200}
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    placeholder={t.placeholder}
                    aria-label={t.placeholder}
                    disabled={!ready || chat.isPending || handoff.isPending}
                    dir="auto"
                    onKeyDown={event => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        send(draft);
                      }
                    }}
                    className="max-h-32 min-h-16 flex-1 resize-none rounded-xl border border-border bg-card p-3 text-sm focus:border-ring focus:outline-none disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    aria-label={t.send}
                    disabled={
                      !ready ||
                      chat.isPending ||
                      handoff.isPending ||
                      !draft.trim()
                    }
                    className="mb-1 rounded-xl bg-primary p-3 text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                  >
                    <Send
                      aria-hidden="true"
                      className="size-5 rtl:-scale-x-100"
                    />
                  </button>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                  {t.privacy}
                </p>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
}
