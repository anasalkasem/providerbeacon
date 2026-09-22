import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowRight, Loader2, RotateCcw, Search, Sparkles } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import type { AssistantTurnInput } from "../../../shared/assistant";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { workspaceCopy } from "@/i18n/workspace";
import { assistantCopy } from "@/i18n/assistant";
import { localizeData } from "@/i18n/messages";
import { PublicLayout } from "@/components/SiteChrome";
import {
  ComparisonExplanation,
  DecisionOffer,
} from "@/components/DecisionOffer";
import { SaveComparison } from "@/components/WorkspaceActions";
import { comparisonGroup } from "../../../shared/offerComparison";
import type { PriceCurrency } from "../../../shared/pricing";
import {
  providerSelection,
  providerSearchUrl,
} from "../../../shared/providerSelection";
import { homeDiscoveryCopy } from "@/i18n/homeDiscovery";

type Reply = inferRouterOutputs<AppRouter>["assistant"]["chat"];
export default function Find() {
  const search = useSearch();
  return <FindPage key={search} />;
}
function FindPage() {
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  const a = assistantCopy[locale];
  const params = new URLSearchParams(useSearch());
  const query = params.get("q")?.slice(0, 1200) ?? "";
  const providerIds = providerSelection(params.get("providers"));
  const scopeCopy = homeDiscoveryCopy[locale];
  const selectedProviders = trpc.marketplace.snapshot.useQuery(
    { scope: "providers", providerIds, limit: 4 },
    { enabled: providerIds.length > 0, staleTime: 30_000, retry: 1 }
  );
  const [draft, setDraft] = useState(query);
  const [result, setResult] = useState<Reply | null>(null);
  const [history, setHistory] = useState<AssistantTurnInput["history"]>([]);
  const [lastRequest, setLastRequest] = useState<AssistantTurnInput | null>(
    null
  );
  const [failure, setFailure] = useState("");
  const [lastMessage, setLastMessage] = useState("");
  const started = useRef("");
  const sending = useRef(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const status = trpc.assistant.status.useQuery(undefined, {
    staleTime: 60000,
    retry: false,
  });
  const chat = trpc.assistant.chat.useMutation({ retry: false });
  const ready = status.data?.available === true;
  async function request(input: AssistantTurnInput) {
    if (sending.current || !ready) return;
    sending.current = true;
    setFailure("");
    setLastRequest(input);
    try {
      const reply = await chat.mutateAsync(input);
      setResult(reply);
      setLastMessage(input.message);
      setDraft("");
      setHistory(
        [
          ...input.history,
          { role: "user", content: input.message },
          {
            role: "assistant",
            content: (reply.answer || a.explanationUnavailable).slice(0, 2000),
          },
        ].slice(-6) as AssistantTurnInput["history"]
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setFailure(
        code.includes("AI_LIMIT")
          ? a.limited
          : code.includes("AI_BUSY")
            ? a.busy
            : code.includes("AI_NOT_CONFIGURED")
              ? a.unavailable
              : a.error
      );
    } finally {
      sending.current = false;
    }
  }
  function send(message: string) {
    if (!message.trim()) return;
    void request({
      message: message.trim(),
      locale,
      history,
      context: {
        path: "/find",
        providerIds: providerIds.length ? providerIds : undefined,
        offerIds: result?.offers.map(o => o.service.id) ?? [],
      },
    });
  }
  useEffect(() => {
    if (ready && query && started.current !== query) {
      started.current = query;
      send(query);
    }
  }, [ready, query]);
  const comparable =
    !!result &&
    result.offers.length > 1 &&
    result.offers.some(o => o.lowest) &&
    result.offers.every(
      o =>
        comparisonGroup(o.service) ===
        comparisonGroup(result.offers[0]!.service)
    );
  const comparisonHref = result
    ? `/compare?services=${result.offers.map(o => o.service.id).join(",")}&quantity=${result.quantity ?? 1000}&currency=${result.displayCurrency}`
    : "/compare";
  return (
    <PublicLayout showCatalogueNotice={false}>
      <section className="find-hero border-b border-border bg-ink text-white">
        <div className="container max-w-5xl py-10 sm:py-14">
          <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-foreground">
            <Sparkles className="size-4" />
            BEACON AI
          </p>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
            {t.ask}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-silver">
            {t.intro}
          </p>
          {providerIds.length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4 text-foreground">
              <p className="text-sm">{scopeCopy.scopeNotice}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                {selectedProviders.data?.source === "database" &&
                  selectedProviders.data.providers.map(provider => (
                    <Link
                      key={provider.id}
                      href={"/providers/" + provider.slug}
                      className="underline underline-offset-4"
                    >
                      <bdi>{provider.name}</bdi>
                    </Link>
                  ))}
                <Link
                  href={providerSearchUrl(query)}
                  className="ms-auto inline-flex min-h-11 items-center underline underline-offset-4"
                >
                  {scopeCopy.clearScope}
                </Link>
              </div>
              {selectedProviders.isError ||
              selectedProviders.data?.source === "unavailable" ? (
                <p role="status" className="mt-2 text-xs">
                  {scopeCopy.scopeUnavailable}
                </p>
              ) : selectedProviders.data &&
                selectedProviders.data.providers.length < providerIds.length ? (
                <p role="status" className="mt-2 text-xs">
                  {scopeCopy.scopeMissing}
                </p>
              ) : null}
            </div>
          )}
          <form
            className="mt-6 rounded-2xl border border-white/15 bg-card p-3 text-foreground shadow-none"
            onSubmit={e => {
              e.preventDefault();
              send(draft);
            }}
          >
            <label className="sr-only" htmlFor="buyer-request">
              {t.ask}
            </label>
            <textarea
              id="buyer-request"
              ref={field}
              dir="auto"
              maxLength={1200}
              rows={2}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={result ? t.refine : a.placeholder}
              disabled={chat.isPending}
              className="w-full resize-y rounded-xl p-3 text-base leading-7 outline-none focus:ring-2 focus:ring-input"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <p className="max-w-xl text-[11px] leading-5 text-muted-foreground">
                {a.privacy}
              </p>
              <button
                disabled={!ready || chat.isPending || !draft.trim()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-graphite px-5 py-3 text-sm font-bold text-white hover:bg-graphite disabled:opacity-50"
              >
                {chat.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                {t.search}
              </button>
            </div>
          </form>
          {!result && (
            <div className="mt-4 flex flex-wrap gap-2">
              {t.examples.map(example => (
                <button
                  key={example}
                  type="button"
                  disabled={!ready || chat.isPending}
                  onClick={() => {
                    setDraft(example);
                    send(example);
                  }}
                  className="rounded-full border border-white/20 px-3 py-2 text-xs text-foreground hover:border-input disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="container py-8 sm:py-10">
        {status.isLoading && <p role="status">{a.thinking}</p>}
        {!status.isLoading && !ready && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <p>{status.isError ? a.error : a.unavailable}</p>
            <Link
              className="mt-3 inline-flex font-bold text-foreground underline"
              href={
                providerIds.length
                  ? "/services?providers=" + providerIds.join(",")
                  : "/services"
              }
            >
              {t.browse}
            </Link>
          </div>
        )}
        {chat.isPending && (
          <p
            role="status"
            className="mb-5 flex items-center gap-3 rounded-xl bg-secondary p-5 text-foreground"
          >
            <Loader2 className="size-5 animate-spin" />
            {a.thinking}
          </p>
        )}
        {failure && (
          <div
            role="alert"
            className="mb-6 rounded-xl bg-warning-muted p-5 text-warning"
          >
            <p>{failure}</p>
            <button
              type="button"
              disabled={chat.isPending}
              onClick={() => lastRequest && void request(lastRequest)}
              className="mt-3 font-bold underline"
            >
              {a.retry}
            </button>
          </div>
        )}
        {result && (
          <div
            className={chat.isPending ? "opacity-50" : ""}
            aria-busy={chat.isPending}
          >
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                  {t.request}
                </p>
                <p
                  dir="auto"
                  className="mt-2 max-w-3xl break-words font-semibold"
                >
                  {lastMessage}
                </p>
              </div>
              <button
                type="button"
                disabled={chat.isPending}
                onClick={() => {
                  setResult(null);
                  setHistory([]);
                  setLastRequest(null);
                  setFailure("");
                  setDraft("");
                  field.current?.focus();
                }}
                className="inline-flex items-center gap-2 text-sm font-bold text-secondary-foreground"
              >
                <RotateCcw className="size-4" />
                {a.clear}
              </button>
            </div>
            <div className="mb-5 flex flex-wrap gap-2 text-xs font-semibold">
              {[
                result.request.platform,
                result.request.category
                  ? localizeData(locale, result.request.category)
                  : null,
                result.request.countryCode,
                result.quantity
                  ? `${t.quantity}: ${result.quantity.toLocaleString(locale)}`
                  : null,
                result.request.minRefillDays
                  ? `${t.refillDays}: ${result.request.minRefillDays}`
                  : null,
                result.request.budget
                  ? `${t.budget}: ${result.request.budget} ${result.displayCurrency}`
                  : null,
              ]
                .filter(Boolean)
                .map((value, index) => (
                  <span
                    key={index}
                    className="rounded-full border border-border bg-card px-3 py-2"
                  >
                    {value}
                  </span>
                ))}
            </div>
            <div className="mb-6 rounded-2xl border border-border bg-card p-5">
              <p dir="auto" className="whitespace-pre-wrap text-sm leading-8">
                {result.answer || a.explanationUnavailable}
              </p>
            </div>
            {result.offers.length > 0 && (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-extrabold">{t.choices}</h2>
                  <span className="text-xs text-muted-foreground">
                    {a.currency}: <bdi>{result.displayCurrency}</bdi>
                  </span>
                </div>
                <div className="mb-6 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {result.offers.map(offer => (
                    <DecisionOffer
                      key={offer.service.id}
                      {...offer}
                      quantity={result.quantity}
                      currency={result.displayCurrency}
                    />
                  ))}
                </div>
                {result.offers.length >= 2 && (
                  <>
                    <ComparisonExplanation
                      services={result.offers.map(o => o.service)}
                      quantity={result.quantity ?? 0}
                      comparable={comparable}
                    />
                    <div className="mb-5 flex flex-wrap gap-3">
                      <Link
                        href={comparisonHref}
                        className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white"
                      >
                        {a.compare}
                        <ArrowRight className="size-4 rtl:rotate-180" />
                      </Link>
                      <SaveComparison
                        serviceIds={result.offers.map(o => o.service.id)}
                        quantity={result.quantity ?? 0}
                        currency={result.displayCurrency as PriceCurrency}
                        name={lastMessage}
                      />
                    </div>
                  </>
                )}
                {result.partial && (
                  <p className="mb-3 text-xs leading-6 text-muted-foreground">
                    {a.partial}
                  </p>
                )}
              </>
            )}
            <Link
              href={result.catalogueUrl}
              className="inline-flex items-center gap-2 font-bold text-foreground"
            >
              {t.browse}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
