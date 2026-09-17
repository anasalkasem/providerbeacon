import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { businessText } from "@/i18n/providerBusiness";
import { providerAnalyticsCopy } from "@/i18n/providerAnalytics";
import { dashboardText } from "@/i18n/providerDashboard";
import { usePageVisible } from "@/hooks/usePageVisible";
import { BusinessError } from "./BusinessUi";
import {
  AnalyticsHeader,
  AnalyticsPeriodSelect,
  AnalyticsReport,
} from "./ProviderAnalyticsVisuals";

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
  const t = businessText(locale),
    a = providerAnalyticsCopy[locale];
  const visible = usePageVisible();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const query = trpc.business.analytics.useQuery(
    { accountId, providerId, days },
    {
      retry: false,
      staleTime: 0,
      refetchInterval: visible ? 30_000 : false,
      refetchIntervalInBackground: false,
    }
  );
  return (
    <div className="provider-analytics min-w-0 space-y-5">
      <AnalyticsHeader
        title={compact ? dashboardText(locale).performance : t.analytics}
        subtitle={a.subtitle}
        controls={
          <>
            <AnalyticsPeriodSelect days={days} onChange={setDays} />
            <button
              type="button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              className="ms-auto inline-flex items-center gap-2 rounded-xl border border-[var(--input)] bg-card px-3 py-2.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50"
            >
              <RefreshCw
                className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {a.refresh}
            </button>
          </>
        }
      />
      {query.isError ? (
        <BusinessError message={query.error.message} />
      ) : !query.data ? (
        <p className="analytics-panel text-sm text-muted-foreground" role="status">
          {t.loading}
        </p>
      ) : (
        <>
          <AnalyticsReport data={query.data} compact={compact} />
          <details className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4 text-xs leading-6 text-muted-foreground">
            <summary className="cursor-pointer font-semibold text-[var(--secondary-foreground)]">
              {a.method}
            </summary>
            <p className="mt-2">{a.methodBody}</p>
            <p className="mt-2">{a.scope}</p>
          </details>
        </>
      )}
    </div>
  );
}
