import { useId, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ExternalLink,
  Eye,
  MousePointerClick,
  Send,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale } from "@/contexts/LocaleContext";
import { providerAnalyticsCopy } from "@/i18n/providerAnalytics";
import { formatNumber } from "@/i18n/messages";
import {
  analyticsPresentation,
  analyticsSeries,
  type AnalyticsMetric,
  type AnalyticsReportData,
} from "@/lib/analyticsPresentation";
import "./ProviderAnalyticsVisuals.css";

const icons = { views: Eye, website: ExternalLink, telegram: Send };
const accent = (color: string): CSSProperties =>
  ({ "--analytics-accent": color }) as CSSProperties;

export function AnalyticsHeader({
  title,
  subtitle,
  controls,
  level = "h2",
}: {
  title: string;
  subtitle: string;
  controls?: ReactNode;
  level?: "h1" | "h2";
}) {
  const { locale } = useLocale();
  const Heading = level;
  return (
    <header className="analytics-header">
      <div className="analytics-header-copy flex items-center gap-4">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 text-[var(--secondary-foreground)]"
          aria-hidden="true"
        >
          <BarChart3 className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted-foreground)]">
            ProviderBeacon · {providerAnalyticsCopy[locale].overview}
          </p>
          <Heading className="display-heading text-3xl text-white sm:text-4xl">
            {title}
          </Heading>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-[var(--secondary-foreground)] sm:text-sm">
            {subtitle}
          </p>
        </div>
      </div>
      {controls && <div className="analytics-header-controls">{controls}</div>}
    </header>
  );
}

export function AnalyticsPeriodSelect({
  days,
  onChange,
}: {
  days: 7 | 30 | 90;
  onChange: (value: 7 | 30 | 90) => void;
}) {
  const { locale } = useLocale();
  const t = providerAnalyticsCopy[locale];
  return (
    <label className="block min-w-40 flex-1 text-xs font-semibold sm:max-w-60">
      {t.period}
      <select
        aria-label={t.period}
        className="mt-2 w-full rounded-xl border border-[var(--border)] bg-card px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-2 focus:outline-offset-2 focus:outline-ring"
        value={days}
        onChange={e => onChange(Number(e.target.value) as 7 | 30 | 90)}
      >
        <option value={7}>{t.days7}</option>
        <option value={30}>{t.days30}</option>
        <option value={90}>{t.days90}</option>
      </select>
    </label>
  );
}

export function AnalyticsReport({
  data,
  compact = false,
}: {
  data: AnalyticsReportData;
  compact?: boolean;
}) {
  const { locale } = useLocale();
  const t = providerAnalyticsCopy[locale];
  const model = analyticsPresentation(data);
  const n = (value: number) => formatNumber(locale, value);
  const percent = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(value);
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
  const [selected, setSelected] = useState<AnalyticsMetric | "all">("all");
  const labelId = useId();
  const metrics = [
    ...analyticsSeries.map(series => ({
      ...series,
      label: t[series.key],
      icon: icons[series.key],
      value: data.totals[series.key],
      previous: model.comparable ? data.previous!.totals[series.key] : null,
    })),
    {
      key: "contacts",
      color: "var(--secondary-foreground)",
      tint: "var(--muted)",
      label: t.clicks,
      icon: MousePointerClick,
      value: model.contacts,
      previous: model.previousContacts,
    },
  ];
  const activity = data.totals.views + model.contacts;
  return (
    <>
      {!data.collectionEnabled && (
        <p
          role="alert"
          className="rounded-xl border border-warning-border bg-warning-muted p-4 text-sm text-warning"
        >
          {t.unavailable}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs leading-6 text-muted-foreground">
        <p>
          <bdi>
            {data.from} — {data.to}
          </bdi>
        </p>
        <p>{t.utc}</p>
      </div>
      <section className="analytics-metrics" aria-label={t.overview}>
        {metrics.map(metric => {
          const change =
            metric.previous !== null && metric.previous > 0
              ? (metric.value - metric.previous) / metric.previous
              : null;
          return (
            <article
              key={metric.key}
              className="analytics-metric"
              style={accent(metric.color)}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold leading-6 text-muted-foreground">
                  {metric.label}
                </p>
                <span
                  className="shrink-0 rounded-xl p-2"
                  style={{ color: "var(--secondary-foreground)", background: metric.tint }}
                  aria-hidden="true"
                >
                  <metric.icon className="size-4" />
                </span>
              </div>
              <p className="mt-3 analytics-number text-[clamp(1.75rem,4cqi,2.75rem)] leading-tight tabular-nums tracking-tight text-[var(--foreground)]">
                <bdi>{n(metric.value)}</bdi>
              </p>
              <div className="mt-3 flex min-h-5 flex-wrap items-center gap-1 text-[11px] leading-5 text-muted-foreground">
                {change !== null ? (
                  <>
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold ${change >= 0 ? "bg-success-muted text-success" : "bg-danger-muted text-danger"}`}
                    >
                      {change !== 0 &&
                        (change > 0 ? (
                          <ArrowUpRight className="size-3" aria-hidden="true" />
                        ) : (
                          <ArrowDownRight
                            className="size-3"
                            aria-hidden="true"
                          />
                        ))}
                      <bdi>
                        {new Intl.NumberFormat(locale, {
                          style: "percent",
                          maximumFractionDigits: 1,
                          signDisplay: "exceptZero",
                        }).format(change)}
                      </bdi>
                    </span>
                    <span>{t.previousPeriod}</span>
                  </>
                ) : metric.previous === 0 ? (
                  t.noBaseline
                ) : (
                  t.recorded
                )}
              </div>
            </article>
          );
        })}
      </section>
      <div className="analytics-chart-grid">
        <section
          className="analytics-panel analytics-trend"
          aria-labelledby={`${labelId}-trend`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 id={`${labelId}-trend`} className="analytics-panel-title">
                {t.trend}
              </h3>
              <p className="analytics-panel-note">{t.comparisonBody}</p>
            </div>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={t.trend}
            >
              <button
                type="button"
                aria-pressed={selected === "all"}
                onClick={() => setSelected("all")}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${selected === "all" ? "border-input bg-secondary text-secondary-foreground" : "border-[var(--border)] bg-card text-secondary-foreground"}`}
              >
                {t.allMetrics}
              </button>
              {analyticsSeries.map(series => (
                <button
                  type="button"
                  key={series.key}
                  aria-pressed={selected === series.key}
                  onClick={() =>
                    setSelected(selected === series.key ? "all" : series.key)
                  }
                  className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold text-[var(--foreground)]"
                  style={{
                    borderColor:
                      selected === series.key ? series.color : "var(--border)",
                    background: selected === series.key ? series.tint : "var(--card)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="analytics-key"
                    style={accent(series.color)}
                  />
                  {t[series.key]}
                </button>
              ))}
            </div>
          </div>
          {activity === 0 ? (
            <div className="mt-6 grid min-h-52 place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)] p-6 text-center">
              <div>
                <Eye
                  className="mx-auto size-7 text-[var(--muted-foreground)]"
                  aria-hidden="true"
                />
                <h4 className="mt-3 text-sm font-bold">{t.empty}</h4>
                <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted-foreground">
                  {t.emptyBody}
                </p>
              </div>
            </div>
          ) : (
            <div
              className={`mt-6 min-w-0 ${compact ? "h-56" : "h-72"}`}
              dir="ltr"
              aria-hidden="true"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={model.daily}
                  margin={{ left: 0, right: 14, top: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id={`${labelId}-gilded`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--chart-1)" />
                      <stop offset="40%" stopColor="var(--chart-2)" />
                      <stop offset="100%" stopColor="var(--chart-1)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="var(--border)"
                    strokeDasharray="3 5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={date}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={42}
                    tickMargin={12}
                  />
                  <YAxis
                    domain={[0, "auto"]}
                    allowDecimals={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickFormatter={value =>
                      new Intl.NumberFormat(locale, {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(value)
                    }
                    tickLine={false}
                    axisLine={false}
                    width={46}
                  />
                  <Tooltip
                    labelFormatter={value => date(String(value))}
                    formatter={(value: number) => n(value)}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--muted)", color: "var(--foreground)", boxShadow: "none",
                      fontSize: 12,
                      direction: locale === "ar" ? "rtl" : "ltr",
                    }}
                    labelStyle={{
                      color: "var(--foreground)",
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  />
                  {analyticsSeries
                    .filter(
                      series => selected === "all" || series.key === selected
                    )
                    .map((series, index) => (
                      <Line
                        key={series.key}
                        type="linear"
                        dataKey={series.key}
                        name={t[series.key]}
                        stroke={series.key === "views" ? `url(#${labelId}-gilded)` : series.color}
                        strokeWidth={2.75}
                        strokeDasharray={
                          series.key === "telegram" ? "5 4" : undefined
                        }
                        dot={
                          data.daily.filter(row => row.measured).length < 15
                            ? { r: 3, strokeWidth: 2, fill: "white" }
                            : false
                        }
                        activeDot={{ r: 5, stroke: "white", strokeWidth: 2 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section
          className="analytics-panel"
          aria-labelledby={`${labelId}-comparison`}
        >
          <h3 id={`${labelId}-comparison`} className="analytics-panel-title">
            {t.comparison}
          </h3>
          <p className="analytics-panel-note">{t.comparisonBody}</p>
          {model.comparable && (
            <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="analytics-key"
                  style={accent("var(--chart-1)")}
                  aria-hidden="true"
                />
                {t.currentPeriod}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="analytics-key"
                  style={accent("var(--steel)")}
                  aria-hidden="true"
                />
                {t.previousPeriod}
              </span>
            </div>
          )}
          <div className="mt-6 space-y-6">
            {analyticsSeries.map(series => (
              <div key={series.key} style={accent(series.color)}>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold">{t[series.key]}</span>
                  <bdi className="font-extrabold tabular-nums">
                    {n(data.totals[series.key])}
                  </bdi>
                </div>
                <div className="analytics-bar-track" aria-hidden="true">
                  <div
                    className="analytics-bar-fill"
                    style={{
                      width: `${(data.totals[series.key] / model.comparisonMax) * 100}%`,
                    }}
                  />
                </div>
                {model.comparable && (
                  <>
                    <div
                      className="analytics-bar-track analytics-previous-track"
                      aria-hidden="true"
                    >
                      <div
                        className="analytics-bar-fill analytics-previous-fill"
                        style={{
                          width: `${(data.previous!.totals[series.key] / model.comparisonMax) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {t.previousPeriod}:{" "}
                      <bdi>{n(data.previous!.totals[series.key])}</bdi>
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
          {data.previous && (
            <p className="mt-5 border-t border-[var(--border)] pt-3 text-[11px] leading-5 text-muted-foreground">
              {model.comparable ? (
                <>
                  {t.previousPeriod}:{" "}
                  <bdi>
                    {data.previous.from} — {data.previous.to}
                  </bdi>
                </>
              ) : (
                t.comparisonPending
              )}
            </p>
          )}
        </section>
        <section
          className="analytics-panel"
          aria-labelledby={`${labelId}-distribution`}
        >
          <h3 id={`${labelId}-distribution`} className="analytics-panel-title">
            {t.distribution}
          </h3>
          <p className="analytics-panel-note">{t.distributionBody}</p>
          <div className="relative mx-auto mt-3 h-56 w-full max-w-72">
            {model.contacts > 0 ? (
              <div className="h-full" aria-hidden="true" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={model.channels.filter(channel => channel.value > 0)}
                      dataKey="value"
                      nameKey="key"
                      innerRadius={72}
                      outerRadius={96}
                      startAngle={90}
                      endAngle={-270}
                      stroke="var(--card)"
                      strokeWidth={4}
                      paddingAngle={
                        model.channels.every(channel => channel.value > 0)
                          ? 2
                          : 0
                      }
                      isAnimationActive={false}
                    >
                      {model.channels
                        .filter(channel => channel.value > 0)
                        .map(channel => (
                          <Cell key={channel.key} fill={channel.color} />
                        ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0 m-auto size-48 rounded-full border-[24px] border-[var(--secondary)]"
              />
            )}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <bdi className="analytics-number text-3xl tabular-nums text-[var(--foreground)]">
                {n(model.contacts)}
              </bdi>
              <span className="mt-1 max-w-32 text-center text-[11px] text-muted-foreground">
                {t.clicks}
              </span>
            </div>
          </div>
          <ul className="space-y-3">
            {model.channels.map(channel => (
              <li key={channel.key} className="flex items-center gap-2 text-xs">
                <span
                  className="analytics-key"
                  style={accent(channel.color)}
                  aria-hidden="true"
                />
                <span className="flex-1 font-medium">{t[channel.key]}</span>
                <bdi className="font-bold tabular-nums">{n(channel.value)}</bdi>
                <bdi className="min-w-12 text-end tabular-nums text-muted-foreground">
                  {channel.share === null ? "—" : percent(channel.share)}
                </bdi>
              </li>
            ))}
          </ul>
          {model.contacts === 0 && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t.noContacts}
            </p>
          )}
        </section>
      </div>
      <details className="analytics-panel !p-0">
        <summary className="cursor-pointer px-5 py-4 text-sm font-bold">
          {t.dailyTable}
        </summary>
        <div className="max-h-80 overflow-auto rounded-b-2xl">
          <table className="analytics-table">
            <thead>
              <tr>
                <th className="text-start">{t.date} · UTC</th>
                {analyticsSeries.map(series => (
                  <th key={series.key} className="text-end">
                    {t[series.key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.daily.map(row => (
                <tr key={row.day}>
                  <th
                    scope="row"
                    className="whitespace-nowrap text-start font-normal"
                  >
                    <bdi>{row.day}</bdi>
                  </th>
                  {row.measured ? (
                    analyticsSeries.map(series => (
                      <td key={series.key} className="text-end tabular-nums">
                        <bdi>{n(row[series.key])}</bdi>
                      </td>
                    ))
                  ) : (
                    <td colSpan={3} className="text-end text-muted-foreground">
                      {t.beforeStart}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
