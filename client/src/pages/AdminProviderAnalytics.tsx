import { useState } from "react";
import { BarChart3, ExternalLink, Eye, RefreshCw, Send } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import ProviderPicker from "@/components/ProviderPicker";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/LocaleContext";
import { formatNumber } from "@/i18n/messages";
import { providerAnalyticsCopy } from "@/i18n/providerAnalytics";
import { trpc } from "@/lib/trpc";

export default function AdminProviderAnalytics() {
  return (
    <DashboardLayout>
      <ProviderAnalyticsPanel />
    </DashboardLayout>
  );
}

export function ProviderAnalyticsPanel() {
  const { locale } = useLocale();
  const t = providerAnalyticsCopy[locale];
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [provider, setProvider] = useState("");
  const [page, setPage] = useState(1);
  const access = trpc.admin.access.useQuery();
  const allowed = access.data?.permissions.includes("providers.read") ?? false;
  const query = trpc.admin.analytics.useQuery(
    { days, providerId: Number(provider) || undefined, page },
    { enabled: allowed, retry: false, staleTime: 30_000 }
  );
  const data = query.data;
  const n = (value: number) => formatNumber(locale, value);
  const date = (value: string | Date) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(value));
  const selectProvider = (value: string) => {
    setProvider(value);
    setPage(1);
  };
  const metrics = [
    {
      key: "views" as const,
      title: t.views,
      icon: Eye,
      color: "text-indigo-700",
      background: "bg-indigo-50",
    },
    {
      key: "website" as const,
      title: t.website,
      icon: ExternalLink,
      color: "text-beacon-700",
      background: "bg-beacon-50",
    },
    {
      key: "telegram" as const,
      title: t.telegram,
      icon: Send,
      color: "text-sky-700",
      background: "bg-sky-50",
    },
  ];
  const activity = data
    ? data.totals.views + data.totals.website + data.totals.telegram
    : 0;
  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <BarChart3 className="size-7 text-beacon-700" />
            <h1 className="text-2xl font-extrabold text-slate-950">
              {t.title}
            </h1>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{t.subtitle}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => void query.refetch()}
          disabled={!allowed || query.isFetching}
        >
          <RefreshCw
            className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
          />
          <span>{t.refresh}</span>
        </Button>
      </header>
      {allowed && (
        <section className="grid items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-6">
          <ProviderPicker
            value={provider}
            onChange={selectProvider}
            emptyLabel={t.all}
          />
          <label className="block text-sm font-semibold">
            {t.period}
            <select
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
              value={days}
              onChange={event => {
                setDays(Number(event.target.value) as 7 | 30 | 90);
                setPage(1);
              }}
            >
              <option value={7}>{t.days7}</option>
              <option value={30}>{t.days30}</option>
              <option value={90}>{t.days90}</option>
            </select>
          </label>
        </section>
      )}
      {access.isError || (access.data && !allowed) || query.isError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {t.failed}
        </p>
      ) : !data ? (
        <p role="status" className="p-6 text-sm text-slate-500">
          {t.loading}
        </p>
      ) : (
        <>
          {!data.collectionEnabled && (
            <p
              role="alert"
              className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
            >
              {t.unavailable}
            </p>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs leading-6 text-slate-500">
            {data.startedAt && (
              <p>
                {t.started}: <bdi>{date(data.startedAt)}</bdi>
              </p>
            )}
            <p>
              {t.updated}:{" "}
              <bdi>
                {new Intl.DateTimeFormat(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "UTC",
                }).format(new Date(data.generatedAt))}{" "}
                UTC
              </bdi>
            </p>
            <p>{t.utc}</p>
          </div>
          <section className="grid gap-3 sm:grid-cols-3" aria-label={t.title}>
            {metrics.map(metric => (
              <article
                key={metric.key}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {metric.title}
                  </p>
                  <p className="mt-3 text-3xl font-extrabold tabular-nums text-slate-950">
                    <bdi>{n(data.totals[metric.key])}</bdi>
                  </p>
                </div>
                <span
                  className={`rounded-xl p-3 ${metric.background} ${metric.color}`}
                >
                  <metric.icon className="size-5" />
                </span>
              </article>
            ))}
          </section>
          {activity === 0 && (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <h2 className="font-bold text-slate-800">{t.empty}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                {t.emptyBody}
              </p>
            </section>
          )}
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">{t.trend}</h2>
            <p className="mt-1 text-xs text-slate-500">
              <bdi>
                {date(data.from)} — {date(data.to)}
              </bdi>
            </p>
            <div
              className="mt-6 h-64 w-full min-w-0"
              dir="ltr"
              aria-hidden="true"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.daily.map(row =>
                    row.measured
                      ? row
                      : { ...row, views: null, website: null, telegram: null }
                  )}
                  margin={{ left: -12, right: 12, top: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={value =>
                      new Intl.DateTimeFormat(locale, {
                        day: "numeric",
                        month: "short",
                        timeZone: "UTC",
                      }).format(new Date(value))
                    }
                    minTickGap={40}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickFormatter={n}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    labelFormatter={value => date(String(value))}
                    formatter={(value: number) => n(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="linear"
                    dataKey="views"
                    name={t.views}
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={data.daily.filter(row => row.measured).length < 8}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="website"
                    name={t.website}
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="telegram"
                    name={t.telegram}
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    strokeDasharray="2 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold text-slate-600">
                {t.dailyTable}
              </summary>
              <div className="mt-3 max-h-80 overflow-auto">
                <table className="w-full text-start text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 text-start">{t.date}</th>
                      {metrics.map(metric => (
                        <th key={metric.key} className="p-2 text-end">
                          {metric.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map(row => (
                      <tr key={row.day} className="border-t border-slate-100">
                        <th scope="row" className="p-2 text-start font-normal">
                          <bdi>{date(row.day)}</bdi>
                        </th>
                        {row.measured ? (
                          metrics.map(metric => (
                            <td
                              key={metric.key}
                              className="p-2 text-end tabular-nums"
                            >
                              <bdi>{n(row[metric.key])}</bdi>
                            </td>
                          ))
                        ) : (
                          <td
                            colSpan={3}
                            className="p-2 text-end text-slate-400"
                          >
                            {t.beforeStart}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <h2 className="p-5 text-lg font-bold text-slate-900">
              {t.providers}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="p-4 text-start">{t.provider}</th>
                    {metrics.map(metric => (
                      <th key={metric.key} className="p-4 text-end">
                        {metric.title}
                      </th>
                    ))}
                    <th className="p-4 text-end">{t.clicks}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.providers.map(row => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <th scope="row" className="max-w-60 p-4 text-start">
                        <button
                          type="button"
                          className="break-words text-start font-bold text-ink underline-offset-4 hover:underline"
                          onClick={() => selectProvider(String(row.id))}
                          aria-label={`${t.details}: ${row.name}`}
                        >
                          <bdi>{row.name}</bdi>
                        </button>
                      </th>
                      {metrics.map(metric => (
                        <td
                          key={metric.key}
                          className="p-4 text-end tabular-nums"
                        >
                          <bdi>{n(row[metric.key])}</bdi>
                        </td>
                      ))}
                      <td className="p-4 text-end font-bold tabular-nums text-beacon-800">
                        <bdi>{n(row.website + row.telegram)}</bdi>
                      </td>
                    </tr>
                  ))}
                  {!data.providers.length && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-6 text-center text-slate-500"
                      >
                        {t.noProviders}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <nav
              aria-label={t.page}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4"
            >
              <p className="text-xs text-slate-500">
                {t.page} <bdi>{n(data.page)}</bdi> {t.of}{" "}
                <bdi>{n(data.pageCount)}</bdi>
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={data.page <= 1 || query.isFetching}
                  onClick={() => setPage(data.page - 1)}
                >
                  {t.previous}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={data.page >= data.pageCount || query.isFetching}
                  onClick={() => setPage(data.page + 1)}
                >
                  {t.next}
                </Button>
              </div>
            </nav>
          </section>
          <details className="rounded-xl bg-slate-100 p-5 text-sm text-slate-600">
            <summary className="cursor-pointer font-semibold">
              {t.method}
            </summary>
            <p className="mt-3 leading-7">{t.methodBody}</p>
            <p className="mt-2 leading-7">{t.scope}</p>
          </details>
        </>
      )}
    </div>
  );
}
