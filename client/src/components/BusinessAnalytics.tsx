import { useState, type CSSProperties } from "react";
import { ExternalLink, Eye, Send, TrendingUp } from "lucide-react";
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
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { businessText } from "@/i18n/providerBusiness";
import { providerAnalyticsCopy } from "@/i18n/providerAnalytics";
import { dashboardText } from "@/i18n/providerDashboard";
import { formatNumber } from "@/i18n/messages";
import { BusinessCard, BusinessError, businessField } from "./BusinessUi";

export function BusinessAnalytics({
  accountId,
  providerId,
  compact = false,
}: {
  accountId: number;
  providerId: number;
  compact?: boolean;
}) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const a = providerAnalyticsCopy[locale];
  const d = dashboardText(locale);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const query = trpc.business.analytics.useQuery(
    { accountId, providerId, days },
    { retry: false, staleTime: 0, refetchInterval: 30_000 }
  );
  const data = query.data;
  const metrics = [
    { key: "views", label: a.views, icon: Eye, color: "var(--chart-1)" },
    { key: "website", label: a.website, icon: ExternalLink, color: "var(--chart-2)" },
    { key: "telegram", label: a.telegram, icon: Send, color: "var(--chart-3)" },
  ] as const;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-ink">
          {compact ? d.performance : t.analytics}
        </h2>
        <label className="text-sm font-medium">
          {a.period}
          <select
            aria-label={a.period}
            className={`${businessField} w-auto`}
            value={days}
            onChange={e => setDays(Number(e.target.value) as 7 | 30 | 90)}
          >
            <option value={7}>{a.days7}</option>
            <option value={30}>{a.days30}</option>
            <option value={90}>{a.days90}</option>
          </select>
        </label>
      </div>
      {query.isError ? (
        <BusinessError message={query.error.message} />
      ) : !data ? (
        <p className="mt-5" role="status">
          {t.loading}
        </p>
      ) : (
        <>
          {!data.collectionEnabled && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-amber-50 p-3 text-amber-900"
            >
              {a.unavailable}
            </p>
          )}
          <p className="text-xs text-slate-500">
            <bdi>
              {data.from} — {data.to}
            </bdi>{" "}
            · {t.utc}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {metrics.map(m => (
              <article
                key={m.key}
                className="beacon-metric p-5"
                style={{ "--metric-color": m.color } as CSSProperties}
              >
                <div className="flex justify-between gap-3 text-sm text-slate-600">
                  <span>{m.label}</span>
                  <span className="rounded-xl bg-slate-50 p-2.5">
                    <m.icon className="size-4" style={{ color: m.color }} />
                  </span>
                </div>
                <p className="mt-3 text-3xl font-extrabold text-ink">
                  <bdi>{formatNumber(locale, data.totals[m.key])}</bdi>
                </p>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  {data.previous.fullyMeasured &&
                  data.daily.every(row => row.measured) ? (
                    <>
                      {data.previous.totals[m.key] > 0 ? (
                        <bdi
                          className={`me-1 font-bold ${data.totals[m.key] >= data.previous.totals[m.key] ? "text-beacon-700" : "text-amber-800"}`}
                        >
                          {new Intl.NumberFormat(locale, {
                            style: "percent",
                            maximumFractionDigits: 1,
                            signDisplay: "exceptZero",
                          }).format(
                            (data.totals[m.key] - data.previous.totals[m.key]) /
                              data.previous.totals[m.key]
                          )}
                        </bdi>
                      ) : null}
                      {d.comparisonHelp}:{" "}
                      <bdi>
                        {formatNumber(locale, data.previous.totals[m.key])}
                      </bdi>
                    </>
                  ) : (
                    t.comparisonPending
                  )}
                </p>
              </article>
            ))}
          </div>
          {data.previous.fullyMeasured && (
            <p className="mt-3 text-xs text-slate-500">
              {t.previous}:{" "}
              <bdi>
                {data.previous.from} — {data.previous.to}
              </bdi>
            </p>
          )}
          <BusinessCard>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-ink">{a.trend}</h3>
              <TrendingUp className="size-4 text-beacon-600" />
            </div>
            {data.totals.views + data.totals.website + data.totals.telegram ===
            0 ? (
              <div className="grid min-h-52 place-items-center rounded-xl bg-slate-50 px-6 py-8 text-center">
                <div>
                  <span className="mx-auto grid size-12 place-items-center rounded-xl border border-slate-200 bg-white text-beacon-600">
                    <Eye className="size-5" />
                  </span>
                  <h4 className="mt-4 text-sm font-bold text-slate-700">
                    {d.noActivity}
                  </h4>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-slate-500">
                    {d.noActivityHelp}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-60 min-w-0" dir="ltr" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.daily.map(row =>
                      row.measured
                        ? row
                        : { ...row, views: null, website: null, telegram: null }
                    )}
                    margin={{ left: -18, right: 10, top: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10 }}
                      minTickGap={40}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", boxShadow: "0 8px 24px rgb(32 36 31 / 8%)", fontFamily: "var(--font-sans)" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {metrics.map(m => (
                      <Line
                        key={m.key}
                        dataKey={m.key}
                        name={m.label}
                        stroke={m.color}
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <details className="mt-5">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                {a.dailyTable}
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 text-start">UTC</th>
                      {metrics.map(m => (
                        <th className="p-2 text-start" key={m.key}>
                          {m.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map(row => (
                      <tr key={row.day} className="border-t border-slate-100">
                        <th className="p-2 text-start font-normal">
                          <bdi>{row.day}</bdi>
                        </th>
                        {metrics.map(m => (
                          <td className="p-2" key={m.key}>
                            {row.measured
                              ? formatNumber(locale, row[m.key])
                              : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <details className="mt-4 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500">
              <summary className="cursor-pointer font-semibold">
                {a.method}
              </summary>
              <p className="mt-2">{a.methodBody}</p>
              <p className="mt-2">{a.utc}</p>
            </details>
          </BusinessCard>
        </>
      )}
    </div>
  );
}
