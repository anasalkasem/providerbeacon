import { ArrowDown, Sparkles } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import type { Service } from "@/data/marketplace";
import { pageCopy } from "@/i18n/messages";
import { formatPrice } from "@/i18n/pricing";
import { priceHighlightCopy } from "@/i18n/priceHighlights";

export default function OfferPrice({
  service,
  lowest = false,
  scope = "comparison",
}: {
  service: Service;
  lowest?: boolean;
  scope?: "visible" | "comparison";
}) {
  const { locale } = useLocale();
  const t = priceHighlightCopy[locale];
  return (
    <div
      className={
        lowest
          ? "rounded-xl bg-emerald-50 p-3 text-emerald-800 ring-1 ring-inset ring-emerald-200"
          : service.featured
            ? "rounded-xl bg-violet-50 p-3 text-violet-800 ring-1 ring-inset ring-violet-200"
            : "text-slate-900"
      }
    >
      <bdi
        dir="ltr"
        className="whitespace-nowrap text-xl font-extrabold tabular-nums"
      >
        {formatPrice(locale, service)}
      </bdi>
      {(lowest || service.featured) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
          {lowest && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-emerald-800">
              <ArrowDown aria-hidden="true" className="size-3.5 shrink-0" />
              <span>{pageCopy[locale].lowestPrice}</span>
            </span>
          )}
          {service.featured && (
            <span
              title={t.featuredHint}
              className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-1 text-violet-800"
            >
              <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
              <span>{t.featured}</span>
            </span>
          )}
        </div>
      )}
      {lowest && (
        <p className="mt-2 max-w-56 text-xs leading-5">
          {scope === "visible" ? t.visibleScope : t.comparisonScope}
        </p>
      )}
    </div>
  );
}

export function PriceLegend() {
  const { locale } = useLocale();
  const t = priceHighlightCopy[locale];
  return (
    <ul
      aria-label={t.legend}
      className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium"
    >
      <li className="flex items-center gap-1.5 text-emerald-800">
        <ArrowDown aria-hidden="true" className="size-3.5" />
        {t.lowest}
      </li>
      <li
        title={t.featuredHint}
        className="flex items-center gap-1.5 text-violet-800"
      >
        <Sparkles aria-hidden="true" className="size-3.5" />
        {t.featured}
      </li>
      <li className="flex items-center gap-1.5 text-slate-600">
        <span aria-hidden="true" className="size-2 rounded-full bg-slate-500" />
        {t.regular}
      </li>
    </ul>
  );
}
