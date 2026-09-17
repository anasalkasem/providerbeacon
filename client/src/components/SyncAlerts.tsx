import { Link } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { useAdminText } from "@/i18n/admin";
import { Button } from "./ui/button";
import CatalogueHealth from "./CatalogueHealth";
import ProviderSourceIssues from "./ProviderSourceIssues";

export default function SyncAlerts() {
  const text = useAdminText();
  const { locale } = useLocale();
  const [openJobId, setOpenJobId] = useState<number | null>(null);
  const access = trpc.admin.access.useQuery();
  const canRead = access.data?.permissions.includes("integrations.read");
  const query = trpc.admin.integrations.alerts.useQuery(undefined, {
    enabled: Boolean(canRead),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
  return (
    <div className="space-y-6">
      {access.data?.permissions.includes("services.read") && (
        <CatalogueHealth />
      )}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">
            {text("alertsTitle")}{" "}
            {query.data
              ? `(${new Intl.NumberFormat(locale).format(query.data.total)})`
              : ""}
          </h2>
          {canRead && (
            <Button variant="outline" asChild>
              <Link href="/admin/integrations">{text("openVault")}</Link>
            </Button>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{text("alertLimit")}</p>
        {!canRead ? (
          <p className="mt-4">{text("noAlertsPermission")}</p>
        ) : query.isError ? (
          <p className="mt-4" role="alert">
            {text("loadError")}{" "}
            <Button variant="outline" onClick={() => void query.refetch()}>
              {text("retry")}
            </Button>
          </p>
        ) : query.isLoading ? (
          <p className="mt-4">{text("loading")}</p>
        ) : !query.data?.items.length ? (
          <p className="mt-5 rounded-xl bg-muted p-5 text-sm text-secondary-foreground">
            {text("noSyncAlerts")}
          </p>
        ) : (
          <div className="mt-4 divide-y">
            {query.data.items.map(item => (
              <article key={item.id} className="py-4">
                <h3 dir="auto" className="font-semibold">
                  {item.providerName} · {item.name}
                </h3>
                {item.hasFailure && (
                  <p className="mt-1 text-sm text-danger">
                    {text("syncError")}
                    {item.failures > 0 && (
                      <>
                        {" "}
                        · {text("failures")}:{" "}
                        {item.failures.toLocaleString(locale)}
                      </>
                    )}
                  </p>
                )}
                {item.isOverdue && (
                  <p className="mt-1 text-sm text-warning">
                    {text("overdueSync")}
                  </p>
                )}
                {item.hasFailure && item.lastError && (
                  <p
                    dir="auto"
                    className="mt-2 break-words text-sm text-danger"
                  >
                    {item.lastError}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {text("lastSync")}:{" "}
                  {item.lastSyncedAt
                    ? new Date(item.lastSyncedAt).toLocaleString(locale)
                    : text("never")}
                </p>
                {item.sourceIssues && (
                  <div className="mt-4 rounded-xl border border-warning-border bg-warning-muted/60 p-4">
                    <p className="font-semibold text-warning">
                      {text("syncQuarantined")}:{" "}
                      {item.sourceIssues.count.toLocaleString(locale)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-secondary-foreground">
                      {text("sourceAlertBody")}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {text("sourceAlertSnapshot")}:{" "}
                      {item.sourceIssues.completedAt
                        ? new Date(
                            item.sourceIssues.completedAt
                          ).toLocaleString(locale)
                        : text("never")}
                    </p>
                    <Button
                      className="mt-3"
                      variant="outline"
                      size="sm"
                      aria-expanded={openJobId === item.sourceIssues.jobId}
                      aria-controls={`source-issues-${item.sourceIssues.jobId}`}
                      onClick={() =>
                        setOpenJobId(value =>
                          value === item.sourceIssues!.jobId
                            ? null
                            : item.sourceIssues!.jobId
                        )
                      }
                    >
                      {text("syncViewIssues")} (
                      {item.sourceIssues.count.toLocaleString(locale)})
                    </Button>
                    {openJobId === item.sourceIssues.jobId && (
                      <div
                        id={`source-issues-${item.sourceIssues.jobId}`}
                        role="region"
                        aria-label={text("syncViewIssues")}
                      >
                        <ProviderSourceIssues
                          key={item.sourceIssues.jobId}
                          jobId={item.sourceIssues.jobId}
                        />
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
