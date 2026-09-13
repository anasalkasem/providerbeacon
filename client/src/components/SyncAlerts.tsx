import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { useAdminText } from "@/i18n/admin";
import { Button } from "./ui/button";
import CatalogueHealth from "./CatalogueHealth";

export default function SyncAlerts() {
  const text = useAdminText();
  const { locale } = useLocale();
  const access = trpc.admin.access.useQuery();
  const canRead = access.data?.permissions.includes("integrations.read");
  const query = trpc.admin.integrations.alerts.useQuery(undefined, {
    enabled: Boolean(canRead),
    staleTime: 15_000,
    retry: false,
  });
  return (
    <div className="space-y-6">
      {access.data?.permissions.includes("services.read") && (
        <CatalogueHealth />
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
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
        <p className="mt-2 text-sm text-slate-500">{text("alertLimit")}</p>
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
          <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
            {text("noSyncAlerts")}
          </p>
        ) : (
          <div className="mt-4 divide-y">
            {query.data.items.map(item => (
              <article key={item.id} className="py-4">
                <h3 dir="auto" className="font-semibold">
                  {item.providerName} · {item.name}
                </h3>
                <p className="mt-1 text-sm text-amber-800">
                  {item.failures
                    ? `${text("syncError")} · ${text("failures")}: ${item.failures}`
                    : text("overdueSync")}
                </p>
                {item.lastError && (
                  <p
                    dir="auto"
                    className="mt-2 break-words text-sm text-red-700"
                  >
                    {item.lastError}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  {text("lastSync")}:{" "}
                  {item.lastSyncedAt
                    ? new Date(item.lastSyncedAt).toLocaleString(locale)
                    : text("never")}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
