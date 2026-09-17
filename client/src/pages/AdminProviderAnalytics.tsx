import { useState } from "react";
import { RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import ProviderPicker from "@/components/ProviderPicker";
import {
  AnalyticsHeader,
  AnalyticsPeriodSelect,
  AnalyticsReport,
} from "@/components/ProviderAnalyticsVisuals";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/LocaleContext";
import { formatNumber } from "@/i18n/messages";
import { providerAnalyticsCopy } from "@/i18n/providerAnalytics";
import { analyticsSeries } from "@/lib/analyticsPresentation";
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
  return (
    <div className="provider-analytics min-w-0 space-y-5">
      <AnalyticsHeader
        title={t.title}
        subtitle={t.subtitle}
        level="h1"
        controls={
          allowed ? (
            <>
              <div className="min-w-48 flex-1 sm:max-w-80">
                <ProviderPicker
                  value={provider}
                  onChange={selectProvider}
                  emptyLabel={t.all}
                />
              </div>
              <AnalyticsPeriodSelect
                days={days}
                onChange={value => {
                  setDays(value);
                  setPage(1);
                }}
              />
              <Button
                className="ms-auto border-[#D9E1ED] bg-white text-[#243650] hover:bg-[#EEF3FB]"
                variant="outline"
                onClick={() => void query.refetch()}
                disabled={!allowed || query.isFetching}
              >
                <RefreshCw
                  className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span>{t.refresh}</span>
              </Button>
            </>
          ) : null
        }
      />
      {access.isError || (access.data && !allowed) || query.isError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {t.failed}
        </p>
      ) : !data ? (
        <p role="status" className="analytics-panel text-sm text-slate-500">
          {t.loading}
        </p>
      ) : (
        <>
          <AnalyticsReport data={data} />
          <section className="overflow-hidden rounded-2xl border border-[#E3E8F0] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 p-5">
              <h2 className="text-lg font-extrabold text-[#243650]">
                {t.providers}
              </h2>
              <span className="rounded-lg bg-[#EEF3FB] px-3 py-1 text-xs font-semibold text-[#507DB7]">
                {t.page} <bdi>{n(data.page)}</bdi> {t.of}{" "}
                <bdi>{n(data.pageCount)}</bdi>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="analytics-table min-w-[540px]">
                <thead>
                  <tr>
                    <th className="text-start">{t.provider}</th>
                    {analyticsSeries.map(series => (
                      <th key={series.key} className="text-end">
                        {t[series.key]}
                      </th>
                    ))}
                    <th className="text-end">{t.clicks}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.providers.map(row => (
                    <tr key={row.id}>
                      <th scope="row" className="max-w-60 text-start">
                        <button
                          type="button"
                          className="break-words text-start font-bold text-[#243650] underline-offset-4 hover:underline"
                          onClick={() => selectProvider(String(row.id))}
                          aria-label={`${t.details}: ${row.name}`}
                        >
                          <bdi>{row.name}</bdi>
                        </button>
                      </th>
                      {analyticsSeries.map(series => (
                        <td
                          key={series.key}
                          className="text-end font-medium tabular-nums"
                          style={{ color: series.color }}
                        >
                          <bdi>{n(row[series.key])}</bdi>
                        </td>
                      ))}
                      <td className="text-end font-extrabold tabular-nums text-[#327D70]">
                        <bdi>{n(row.website + row.telegram)}</bdi>
                      </td>
                    </tr>
                  ))}
                  {!data.providers.length && (
                    <tr>
                      <td
                        colSpan={5}
                        className="!p-6 text-center text-slate-500"
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
              className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E3E8F0] p-4"
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
          <details className="rounded-xl border border-[#E3E8F0] bg-[#F3F6FA] p-5 text-xs leading-6 text-slate-500">
            <summary className="cursor-pointer font-semibold text-[#4E617E]">
              {t.method}
            </summary>
            <p className="mt-3">{t.methodBody}</p>
            <p className="mt-2">{t.scope}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#E3E8F0] pt-3">
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
            </div>
          </details>
        </>
      )}
    </div>
  );
}
