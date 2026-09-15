import { useState } from "react";
import { ExternalLink, Eye, Send } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { businessText } from "@/i18n/providerBusiness";
import { providerAnalyticsCopy } from "@/i18n/providerAnalytics";
import { formatNumber } from "@/i18n/messages";
import { BusinessCard, BusinessError, businessField } from "./BusinessUi";

export function BusinessAnalytics({
  accountId,
  providerId,
}: {
  accountId: number;
  providerId: number;
}) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const a = providerAnalyticsCopy[locale];
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const query = trpc.business.analytics.useQuery(
    { accountId, providerId, days },
    { retry: false, staleTime: 0, refetchInterval: 30_000 }
  );
  const data = query.data;
  const metrics = [
    { key: "views", label: a.views, icon: Eye, color: "#4338ca" },
    { key: "website", label: a.website, icon: ExternalLink, color: "#0f766e" },
    { key: "telegram", label: a.telegram, icon: Send, color: "#0284c7" },
  ] as const;
  return (
    <BusinessCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-[#0B2A68]">{t.analytics}</h2>
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
          <p className="mt-4 text-xs text-slate-500">
            <bdi>
              {data.from} — {data.to}
            </bdi>{" "}
            · {t.utc}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {metrics.map(m => (
              <article key={m.key} className="rounded-xl bg-slate-50 p-4">
                <div className="flex justify-between gap-3 text-sm text-slate-600">
                  <span>{m.label}</span>
                  <m.icon className="size-4" />
                </div>
                <p className="mt-3 text-3xl font-extrabold text-[#0B2A68]">
                  <bdi>{formatNumber(locale, data.totals[m.key])}</bdi>
                </p>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  {data.previous.fullyMeasured ? (
                    <>
                      {t.previous}:{" "}
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
          <div className="mt-6 h-60 min-w-0" dir="ltr" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.daily.map(row =>
                  row.measured
                    ? row
                    : { ...row, views: null, website: null, telegram: null }
                )}
                margin={{ left: -18, right: 10, top: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {metrics.map(m => (
                  <Line
                    key={m.key}
                    dataKey={m.key}
                    name={m.label}
                    stroke={m.color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-semibold text-[#0B2A68]">
              {a.trend}
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
          <p className="mt-5 text-xs leading-6 text-slate-500">
            {a.methodBody}
          </p>
        </>
      )}
    </BusinessCard>
  );
}

