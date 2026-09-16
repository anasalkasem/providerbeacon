import { trpc } from "@/lib/trpc";
import { useAdminText } from "@/i18n/admin";
import { useLocale } from "@/contexts/LocaleContext";
import { reviewNeeds, type ReviewNeed } from "../../../shared/serviceReview";
import type { AdminServicesInput } from "../../../shared/catalogueQuery";
import { Button } from "./ui/button";

export default function ServiceReviewWorklist({
  filters,
  onSelect,
}: {
  filters: AdminServicesInput;
  onSelect: (need: ReviewNeed | undefined) => void;
}) {
  const text = useAdminText();
  const { locale } = useLocale();
  const access = trpc.admin.access.useQuery();
  const summary = trpc.admin.services.reviewSummary.useQuery(
    { ...filters, need: undefined, cursor: undefined, limit: 25 },
    {
      enabled: Boolean(access.data?.permissions.includes("services.read")),
      retry: false,
      staleTime: 15_000,
      refetchInterval: 30_000,
    }
  );
  const number = (value?: number) =>
    value == null ? "—" : value.toLocaleString(locale);
  return (
    <section
      aria-label={text("reviewWorklist")}
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-950">
          {text("reviewWorklist")}
        </h2>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={!filters.need}
          onClick={() => onSelect(undefined)}
        >
          {text("allReviewNeeds")} ({number(summary.data?.total)})
        </Button>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        {text("reviewWorklistBody")}
      </p>
      {summary.isError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {text("loadError")}{" "}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void summary.refetch()}
          >
            {text("retry")}
          </Button>
        </p>
      )}
      <div
        className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4"
        aria-busy={summary.isFetching}
      >
        {reviewNeeds.map(need => (
          <button
            key={need}
            type="button"
            aria-pressed={filters.need === need}
            disabled={!summary.data || summary.isError}
            onClick={() => onSelect(need)}
            className={`min-w-0 rounded-xl border px-3 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-beacon-600 disabled:opacity-50 ${filters.need === need ? "border-beacon-600 bg-beacon-50" : "border-slate-200 hover:border-beacon-400"}`}
          >
            <span
              className={`block text-xl font-extrabold ${need === "ready" ? "text-emerald-700" : "text-slate-950"}`}
            >
              {number(summary.data?.[need])}
            </span>
            <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">
              {text(`need_${need}`)}
            </span>
          </button>
        ))}
      </div>
      {filters.need && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-beacon-50 px-4 py-3 text-sm leading-6 text-beacon-950"
        >
          {text(`needHelp_${filters.need}`)}
        </p>
      )}
    </section>
  );
}
