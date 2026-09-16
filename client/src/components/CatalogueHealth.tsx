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
      style: "text-amber-800 bg-amber-50",
    },
    {
      key: "approved",
      value: data?.approved,
      icon: Layers3,
      style: "text-emerald-800 bg-emerald-50",
    },
    {
      key: "incomplete",
      value: data?.incomplete,
      icon: FileWarning,
      style: "text-orange-800 bg-orange-50",
    },
    {
      key: "stale",
      value: data?.stale,
      icon: Clock3,
      style: "text-slate-700 bg-slate-100",
    },
    {
      key: "price_changed",
      value: data?.priceChanged,
      icon: RefreshCw,
      style: "text-blue-800 bg-blue-50",
    },
    {
      key: "missing",
      value: data?.missing,
      icon: Unplug,
      style: "text-red-800 bg-red-50",
    },
  ] as const;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-950">
          {text("catalogueHealth")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          {text("catalogueHealthBody")}
        </p>
      </div>
      {query.isError && (
        <p role="alert" className="text-red-700">
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
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-beacon-500"
          >
            <div className="flex items-center justify-between">
              <span
                className={`grid size-10 place-items-center rounded-xl ${metric.style}`}
              >
                <metric.icon className="size-5" />
              </span>
              <ArrowUpRight className="size-4 text-slate-400 rtl:-scale-x-100" />
            </div>
            <p className="mt-4 text-3xl font-extrabold text-slate-950">
              {metric.value == null
                ? "—"
                : new Intl.NumberFormat(locale).format(metric.value)}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {text(metric.key)}
            </p>
          </Link>
        ))}
      </div>
      {Boolean(data?.normalizationPending) && (
        <p
          role="status"
          className="rounded-xl border border-beacon-200 bg-beacon-50 p-4 text-sm text-beacon-900"
        >
          {text("classificationRunning")} {text("normalizationPending")}:{" "}
          {new Intl.NumberFormat(locale).format(data!.normalizationPending)}
        </p>
      )}
    </section>
  );
}
