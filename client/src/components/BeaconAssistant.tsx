import { useEffect, useRef, useState } from "react";
import { AssistantEdgeGlow } from "./EdgeGlow";
import { Link, useLocation } from "wouter";
import {
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
  if (!/^\/(?:$|services(?:\/|$)|providers(?:\/|$)|compare$)/.test(path))
    return null;
  return <AssistantChat path={path} />;
}

function AssistantChat({ path }: { path: string }) {
  const { locale } = useLocale();
  const t = assistantCopy[locale];
  const [open, setOpen] = useState(false);
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
  const appearance = trpc.appearance.public.useQuery(undefined, {
    staleTime: 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const ready = status.data?.available === true;

  useEffect(() => {
    if (open && ready) field.current?.focus();
  }, [open, ready]);
  useEffect(() => {
    log.current?.scrollTo({
      top: log.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, failure, chat.isPending]);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => launcher.current?.focus());
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
      <AssistantEdgeGlow
        enabled={
          appearance.data?.edgeGlowEnabled === true && !appearance.isError
        }
        open={open}
        pending={chat.isPending}
        replyId={turns.findLast(turn => turn.role === "assistant")?.id ?? 0}
      />
      <button
        ref={launcher}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="beacon-assistant"
        className={`beacon-assistant-launcher fixed end-5 z-[60] items-center gap-2 rounded-full bg-ink px-5 py-3.5 text-sm font-bold text-white shadow-xl ring-1 ring-white/30 hover:bg-beacon-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-beacon-600 ${open ? "hidden" : "inline-flex"}`}
      >
        <Sparkles aria-hidden="true" className="size-5 text-beacon-300" />
        {t.launcher}
      </button>
      {open && (
        <section
          id="beacon-assistant"
          role="dialog"
          aria-label={t.title}
          onKeyDown={event => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
          className="fixed inset-x-3 bottom-3 z-[70] flex h-[min(720px,calc(100dvh-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:end-5 sm:w-[430px]"
        >
          <header className="flex shrink-0 items-center gap-3 bg-ink p-4 text-white">
            <Sparkles aria-hidden="true" className="size-6 text-beacon-300" />
            <div className="flex-1">
              <h2 className="font-extrabold" dir="ltr">
                {t.title}
              </h2>
              <p className="mt-1 text-xs text-blue-100">{t.subtitle}</p>
            </div>
            <button
              type="button"
              title={t.clear}
              aria-label={t.clear}
              disabled={chat.isPending}
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
          <div
            ref={log}
            role="log"
            aria-label={t.history}
            aria-live="polite"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4"
          >
            {status.isLoading && (
              <p role="status" className="text-sm text-slate-500">
                {t.thinking}
              </p>
            )}
            {!status.isLoading && !ready && (
              <div className="rounded-xl bg-slate-50 p-4 text-sm leading-7">
                <p>{status.isError ? t.error : t.unavailable}</p>
                <Link
                  href="/services"
                  onClick={close}
                  className="font-bold text-beacon-700 underline"
                >
                  {t.more}
                </Link>
                {status.isError && (
                  <button
                    onClick={() => void status.refetch()}
                    className="ms-3 font-bold text-beacon-700"
                  >
                    {t.retry}
                  </button>
                )}
              </div>
            )}
            {ready && turns.length === 0 && (
              <div className="space-y-4 py-3">
                <MessageCircle
                  aria-hidden="true"
                  className="size-8 text-beacon-700"
                />
                <p className="text-sm leading-7">{t.welcome}</p>
                <div className="flex flex-col gap-2">
                  {t.examples.map(example => (
                    <button
                      key={example}
                      disabled={chat.isPending}
                      onClick={() => send(example)}
                      className="rounded-xl border border-slate-200 p-3 text-start text-sm font-medium hover:border-beacon-400 hover:bg-beacon-50 disabled:opacity-50"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {turns.map(turn => (
              <article
                key={turn.id}
                className={
                  turn.role === "user"
                    ? "ms-8 rounded-2xl bg-ink px-4 py-3 text-sm leading-7 text-white"
                    : "space-y-3 text-sm leading-7"
                }
              >
                <p dir="auto" className="whitespace-pre-wrap break-words">
                  {turn.content}
                </p>
                {turn.result && (
                  <>
                    {turn.result.comparisonMissing && (
                      <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                        {t.missing}
                      </p>
                    )}
                    {turn.result.offers.length > 0 && (
                      <>
                        <p className="text-xs text-slate-500">
                          {t.currency}: <bdi>{turn.result.displayCurrency}</bdi>
                          {turn.result.quantity != null && (
                            <>
                              {" "}
                              · {t.quantity}:{" "}
                              <bdi>
                                {turn.result.quantity.toLocaleString(locale)}
                              </bdi>
                            </>
                          )}
                        </p>
                        {turn.result.offers.map(offer => (
                          <div
                            key={offer.service.id}
                            className="space-y-2 rounded-xl border border-slate-200 p-3"
                          >
                            <Link
                              href={`/providers/${offer.provider.slug}`}
                              onClick={close}
                              className="font-bold text-beacon-700 hover:underline"
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
                            <p className="text-xs text-slate-500">
                              {unitLabel(locale, offer.service)}
                            </p>
                            {turn.result!.quantity != null ? (
                              <QuoteCost
                                service={offer.service}
                                quantity={turn.result!.quantity}
                                lowest={offer.lowest}
                              />
                            ) : (
                              <p className="text-xs text-slate-500">
                                {t.quantityNeeded}
                              </p>
                            )}
                            {offer.convertedTotal && offer.fxAsOf != null && (
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
                                <p className="text-xs text-amber-800">
                                  {t.fxUnavailable}
                                </p>
                              )}
                            {offer.budgetStatus && (
                              <p
                                className={`text-xs font-bold ${offer.budgetStatus === "within" ? "text-emerald-800" : "text-amber-800"}`}
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
                              className="inline-block text-xs font-bold text-beacon-700 underline"
                            >
                              {t.provider}
                            </Link>
                          </div>
                        ))}
                        {turn.result.offers.length >= 2 && (
                          <Link
                            onClick={close}
                            href={`/compare?services=${turn.result.offers.map(offer => offer.service.id).join(",")}${turn.result.quantity != null ? `&quantity=${turn.result.quantity}` : ""}&currency=${turn.result.displayCurrency}`}
                            className="block rounded-xl bg-ink p-3 text-center text-sm font-bold text-white"
                          >
                            {t.compare}
                          </Link>
                        )}
                        {turn.result.partial && (
                          <p className="text-xs text-slate-500">{t.partial}</p>
                        )}
                        <p className="text-xs leading-5 text-slate-500">
                          {t.priceNote}
                        </p>
                      </>
                    )}
                    <Link
                      href={turn.result.catalogueUrl}
                      onClick={close}
                      className="inline-block text-xs font-bold text-beacon-700 underline"
                    >
                      {t.more}
                    </Link>
                  </>
                )}
              </article>
            ))}
            {chat.isPending && (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-beacon-800"
              >
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                {t.thinking}
              </p>
            )}
            {failure && (
              <div
                role="alert"
                className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
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
          <form
            className="shrink-0 border-t border-slate-200 bg-slate-50 p-3"
            onSubmit={event => {
              event.preventDefault();
              send(draft);
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={field}
                rows={2}
                maxLength={1200}
                value={draft}
                onChange={event => setDraft(event.target.value)}
                placeholder={t.placeholder}
                aria-label={t.placeholder}
                disabled={!ready || chat.isPending}
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
                className="max-h-32 min-h-16 flex-1 resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm focus:border-beacon-500 focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                aria-label={t.send}
                disabled={!ready || chat.isPending || !draft.trim()}
                className="mb-1 rounded-xl bg-beacon-700 p-3 text-white hover:bg-beacon-800 disabled:opacity-40"
              >
                <Send aria-hidden="true" className="size-5 rtl:-scale-x-100" />
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">
              {t.privacy}
            </p>
          </form>
        </section>
      )}
    </>
  );
}
