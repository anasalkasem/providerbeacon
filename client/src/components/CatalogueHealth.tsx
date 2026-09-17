import { Link } from "wouter";
import {
  ArrowUpRight,
  ClipboardCheck,
  Clock3,
  FileWarning,
  Layers3,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { useAdminText } from "@/i18n/admin";
import { Button } from "./ui/button";

export default function CatalogueHealth() {
  const text = useAdminText();
  const { locale } = useLocale();
  const query = trpc.admin.overview.useQuery(undefined, {
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const data = query.data?.operations;
  const metrics = [
    {
      key: "pending",
      value: data?.pending,
      icon: ClipboardCheck,
      style: "text-warning bg-warning-muted",
    },
    {
      key: "approved",
      value: data?.approved,
      icon: Layers3,
      style: "text-success bg-success-muted",
    },
    {
      key: "incomplete",
      value: data?.incomplete,
      icon: FileWarning,
      style: "text-warning bg-warning-muted",
    },
    {
      key: "stale",
      value: data?.stale,
      icon: Clock3,
      style: "text-secondary-foreground bg-secondary",
    },
    {
      key: "price_changed",
      value: data?.priceChanged,
      icon: RefreshCw,
      style: "text-foreground bg-secondary",
    },
    {
      key: "missing",
      value: data?.missing,
      icon: Unplug,
      style: "text-danger bg-danger-muted",
    },
  ] as const;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">
          {text("catalogueHealth")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {text("catalogueHealthBody")}
        </p>
      </div>
      {query.isError && (
        <p role="alert" className="text-danger">
          {text("loadError")}{" "}
          <Button variant="outline" onClick={() => void query.refetch()}>
            {text("retry")}
          </Button>
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(metric => (
          <Link
            key={metric.key}
            href={`/admin/review?view=${metric.key}&lang=${locale}`}
            className="group rounded-2xl border border-border bg-card p-5 shadow-none transition-colors hover:border-ring"
          >
            <div className="flex items-center justify-between">
              <span
                className={`grid size-10 place-items-center rounded-xl ${metric.style}`}
              >
                <metric.icon className="size-5" />
              </span>
              <ArrowUpRight className="size-4 text-muted-foreground rtl:-scale-x-100" />
            </div>
            <p className="mt-4 text-3xl font-extrabold text-foreground">
              {metric.value == null
                ? "—"
                : new Intl.NumberFormat(locale).format(metric.value)}
            </p>
            <p className="mt-1 text-sm font-semibold text-secondary-foreground">
              {text(metric.key)}
            </p>
          </Link>
        ))}
      </div>
      {Boolean(data?.normalizationPending) && (
        <p
          role="status"
          className="rounded-xl border border-input bg-secondary p-4 text-sm text-foreground"
        >
          {text("classificationRunning")} {text("normalizationPending")}:{" "}
          {new Intl.NumberFormat(locale).format(data!.normalizationPending)}
        </p>
      )}
    </section>
  );
}
