import type { Service } from "@/data/marketplace";
import { useState } from "react";
import { Link } from "wouter";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  Bell,
  Bookmark,
  History,
  Layers2,
  Loader2,
  RefreshCw,
  Settings2,
  Trash2,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { useMember } from "@/hooks/useMember";
import { useLocale } from "@/contexts/LocaleContext";
import { workspaceCopy } from "@/i18n/workspace";
import { communityCopy } from "@/i18n/community";
import { businessText } from "@/i18n/providerBusiness";
import { PublicLayout } from "@/components/SiteChrome";
import { unitLabel } from "@/i18n/pricing";
import OfferEvidence from "@/components/OfferEvidence";
import { toast } from "sonner";
import PriceTargetForm from "@/components/PriceTargetForm";
import { priceAlertCopy, priceAlertStatus } from "@/i18n/priceAlerts";

type Watch =
  inferRouterOutputs<AppRouter>["workspace"]["dashboard"]["watches"][number];
export default function MemberWorkspace() {
  const me = useMember();
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  return (
    <PublicLayout showCatalogueNotice={false}>
      {me.isLoading ? (
        <div className="container py-20">
          <Loader2 className="size-6 animate-spin text-beacon-700" />
        </div>
      ) : !me.data?.member ? (
        <section className="container max-w-2xl py-20">
          <h1 className="text-3xl font-extrabold">{t.workspace}</h1>
          <p className="mt-4 leading-8 text-slate-600">
            {me.isError ? t.error : t.signedOut}
          </p>
          <Link
            href="/sign-in?next=/account"
            className="mt-6 inline-flex rounded-xl bg-ink px-6 py-3 font-bold text-white"
          >
            {t.signIn}
          </Link>
        </section>
      ) : (
        <Workspace
          key={me.data.member.id}
          accountId={me.data.member.id}
          name={me.data.member.name}
        />
      )}
    </PublicLayout>
  );
}
function Workspace({ accountId, name }: { accountId: number; name: string }) {
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  const utils = trpc.useUtils();
  const data = trpc.workspace.dashboard.useQuery(
    { accountId },
    { staleTime: 15000, retry: false }
  );
  const remove = trpc.workspace.remove.useMutation({
    onSuccess: async () => {
      toast.success(t.removed);
      await utils.workspace.invalidate();
    },
    onError: () => toast.error(t.error),
  });
  const watches = data.data?.watches ?? [];
  const comparisons = data.data?.comparisons ?? [];
  const stats = [
    { label: t.watchlist, count: watches.length, icon: Bookmark },
    { label: t.comparisons, count: comparisons.length, icon: Layers2 },
    {
      label: t.decreaseCount,
      count: watches.filter(w => w.change.status === "lower").length,
      icon: ArrowDownRight,
    },
    {
      label: t.targetCount,
      count: watches.filter(w => w.change.targetReached).length,
      icon: Bell,
    },
  ];
  return (
    <div className="container py-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold tracking-widest text-beacon-700">
            PROVIDERBEACON
          </p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            {t.workspace}
          </h1>
          <p className="mt-3 font-semibold text-slate-700" dir="auto">
            {name}
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
            {t.dashboardIntro}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/account/provider" className="inline-flex items-center gap-2 rounded-xl border border-beacon-200 bg-beacon-50 px-4 py-3 text-sm font-bold text-beacon-800">{businessText(locale).title}</Link>
          <Link
            href="/find"
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white"
          >
            {t.newSearch}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
          <Link
            href="/account/groups"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
          >
            {communityCopy[locale].mine}
          </Link>
          <Link
            href="/account/settings"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
          >
            <Settings2 className="size-4" />
            {t.settings}
          </Link>
        </div>
      </header>
      {data.isLoading ? (
        <p role="status" className="py-10">
          <Loader2 className="size-6 animate-spin text-beacon-700" />
        </p>
      ) : data.isError ? (
        <div role="alert" className="rounded-xl bg-amber-50 p-5">
          <p>{t.error}</p>
          <button
            className="mt-3 font-bold text-beacon-800 underline"
            onClick={() => void data.refetch()}
          >
            {t.refreshed}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-9 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map(({ label, count, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <Icon className="mb-4 size-5 text-beacon-700" />
                <p className="text-3xl font-extrabold text-ink">
                  {count.toLocaleString(locale)}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold">{t.watchlist}</h2>
            <button
              disabled={data.isFetching}
              onClick={() => void data.refetch()}
              className="inline-flex items-center gap-2 text-xs font-bold text-beacon-800 disabled:opacity-40"
            >
              <RefreshCw
                className={`size-4 ${data.isFetching ? "animate-spin" : ""}`}
              />
              {t.refreshed}
            </button>
          </div>
          {watches.length ? (
            <div className="grid items-start gap-5 lg:grid-cols-2">
              {watches.map(watch => (
                <WatchCard key={watch.id} watch={watch} accountId={accountId} />
              ))}
            </div>
          ) : (
            <section className="rounded-2xl border border-dashed border-beacon-300 bg-beacon-50/40 p-7 sm:p-10">
              <Bookmark className="size-8 text-beacon-700" />
              <h3 className="mt-4 text-xl font-extrabold">{t.empty}</h3>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                {t.emptyBody}
              </p>
              <Link
                href="/find"
                className="mt-5 inline-flex items-center gap-2 font-bold text-beacon-800"
              >
                {t.newSearch}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            </section>
          )}
          <section className="mt-10">
            <h2 className="mb-5 text-xl font-extrabold">{t.comparisons}</h2>
            {comparisons.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {comparisons.map(c => (
                  <article
                    key={c.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <h3 className="break-words font-bold" dir="auto">
                      {c.name}
                    </h3>
                    <p className="mt-2 text-xs text-slate-500">
                      {t.quantity}:{" "}
                      <bdi>{c.quantity.toLocaleString(locale)}</bdi> ·{" "}
                      <bdi>{c.currency}</bdi>
                    </p>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <Link
                        href={`/compare?services=${c.serviceIds.join(",")}&quantity=${c.quantity}&currency=${c.currency}`}
                        className="text-sm font-bold text-beacon-800"
                      >
                        {t.open} →
                      </Link>
                      <button
                        type="button"
                        disabled={remove.isPending}
                        onClick={() =>
                          remove.mutate({ id: c.id, kind: "comparison" })
                        }
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        aria-label={`${t.remove}: ${c.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-500">
                {t.noComparisons}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
function WatchCard({ watch, accountId }: { watch: Watch; accountId: number }) {
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);
  const remove = trpc.workspace.remove.useMutation({
    onSuccess: async () => {
      toast.success(t.removed);
      await utils.workspace.invalidate();
    },
    onError: () => toast.error(t.error),
  });
  const { candidate, change, baseline } = watch;
  const service = candidate?.service;
  const color =
    change.status === "lower" || change.targetReached
      ? "text-emerald-800 bg-emerald-50"
      : change.status === "same"
        ? "text-slate-600 bg-slate-100"
        : "text-amber-900 bg-amber-50";
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        {candidate ? (
          <Link
            href={`/providers/${candidate.provider.slug}`}
            className="truncate text-sm font-extrabold text-beacon-800"
          >
            {candidate.provider.name}
          </Link>
        ) : (
          <p className="text-sm font-bold text-slate-500">
            {watch.providerName}
          </p>
        )}
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => remove.mutate({ id: watch.id, kind: "watch" })}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
          aria-label={`${t.remove}: ${baseline.name}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <h3
        className="mt-2 line-clamp-2 break-words text-sm font-bold leading-6"
        dir="auto"
        title={service?.name ?? baseline.name}
      >
        {service?.name ?? baseline.name}
      </h3>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${color}`}>
          {t[change.status]}
          {(change.status === "lower" || change.status === "higher") &&
            change.percentage != null && (
              <bdi className="ms-1">
                {change.percentage < 0.01
                  ? "<0.01"
                  : change.percentage.toLocaleString(locale, {
                      maximumFractionDigits: 2,
                    })}
                %
              </bdi>
            )}
        </span>
        {change.targetReached && (
          <span className="inline-flex items-center gap-1 rounded-full bg-beacon-700 px-3 py-1.5 text-xs font-bold text-white">
            <Bell className="size-3" />
            {t.targetHit}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {t.quantity}: <bdi>{watch.quantity.toLocaleString(locale)}</bdi> ·{" "}
        {t.sinceSaved}:{" "}
        <bdi>{new Date(watch.createdAt).toLocaleDateString(locale)}</bdi>
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
        <div>
          <dt className="text-xs text-slate-500">{t.original}</dt>
          <dd className="mt-2 break-all text-sm font-semibold">
            <bdi>
              {change.original ?? "—"} {baseline.priceCurrency}
            </bdi>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">{t.current}</dt>
          <dd className="mt-2 break-all text-lg font-extrabold text-ink">
            <bdi>
              {change.now ?? "—"} {service?.priceCurrency}
            </bdi>
          </dd>
        </div>
      </dl>
      {service && (
        <div className="mt-3">
          <OfferEvidence service={service} />
        </div>
      )}
      {change.status === "terms_changed" && (
        <p className="mt-3 text-xs leading-6 text-amber-900">
          {t.targetPaused}
        </p>
      )}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-beacon-800"
      >
        <History className="size-4" />
        {t.history} · <Bell className="size-4" />
        {t.saveTarget} · {priceAlertCopy[locale].title}
      </button>
      {watch.emailAlert.enabled && !expanded && (
        <p className="mt-2 text-xs leading-6 text-beacon-800">
          {priceAlertStatus(watch.emailAlert.status, locale)}
        </p>
      )}
      {expanded && (
        <div className="mt-4 border-t border-slate-100 pt-5">
          <PriceHistory accountId={accountId} id={watch.id} service={service} />
          <PriceTargetForm
            key={`${watch.target}:${watch.emailAlert.revision}`}
            id={watch.id}
            target={watch.target}
            currency={baseline.priceCurrency}
            current={change.now}
            emailAlert={watch.emailAlert}
            canSetTarget={
              change.original != null &&
              change.status !== "terms_changed" &&
              !!candidate
            }
          />
        </div>
      )}
    </article>
  );
}
function PriceHistory({
  accountId,
  id,
  service,
}: {
  accountId: number;
  id: number;
  service: Service | undefined;
}) {
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  const history = trpc.workspace.history.useQuery(
    { accountId, id },
    { staleTime: 15000, retry: false }
  );
  if (history.isLoading)
    return <Loader2 className="size-5 animate-spin text-beacon-700" />;
  if (history.isError)
    return <p className="text-xs text-amber-900">{t.error}</p>;
  const points = history.data?.points ?? [];
  const data = points.map(p => ({
    at: new Date(p.at).getTime(),
    value: Number(p.rate),
    rate: p.rate,
  }));
  return (
    <div>
      <p className="text-xs leading-6 text-slate-500">{t.historyNote}</p>
      {data.length >= 2 ? (
        <div
          className="mt-4 h-44 w-full min-w-0"
          dir="ltr"
          role="img"
          aria-label={t.history}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="at"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={value =>
                  new Date(value).toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                  })
                }
                minTickGap={50}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                width={60}
                domain={["auto", "auto"]}
                tick={{ fontSize: 10 }}
                tickFormatter={value =>
                  Number(value).toLocaleString(locale, {
                    maximumFractionDigits: 6,
                  })
                }
              />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.[0] ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow">
                      <p>{new Date(Number(label)).toLocaleString(locale)}</p>
                      <bdi>
                        {payload[0].payload.rate} {history.data?.currency}
                      </bdi>
                    </div>
                  ) : null
                }
              />
              <Area
                type="stepAfter"
                dataKey="value"
                stroke="var(--chart-1)"
                fill="var(--color-brand-soft)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-600">
          {t.noHistory}
        </p>
      )}
      {service && (
        <p className="mt-2 text-xs text-slate-500">
          {unitLabel(locale, service)} · <bdi>{history.data?.currency}</bdi>
        </p>
      )}
      {points.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-600">
            {t.observed}
          </summary>
          <div className="mt-2 max-h-48 overflow-auto">
            <table className="w-full text-start">
              <thead>
                <tr>
                  <th className="p-2 text-start">{t.historyDate}</th>
                  <th className="p-2 text-start">{t.historyRate}</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="p-2">
                      <bdi>{new Date(p.at).toLocaleString(locale)}</bdi>
                    </td>
                    <td className="p-2">
                      <bdi>
                        {p.rate} {history.data?.currency}
                      </bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
