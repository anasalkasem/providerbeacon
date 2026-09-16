import { ArrowDown, Sparkles } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import type { Service } from "@/data/marketplace";
import { pageCopy } from "@/i18n/messages";
import { formatPrice, unitLabel } from "@/i18n/pricing";
import { priceHighlightCopy } from "@/i18n/priceHighlights";
import { hasPricingBasis } from "../../../shared/pricing";

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
  const unconfirmed = !hasPricingBasis(service);
  const showLowest = lowest && !unconfirmed;
  return (
    <div
      data-price-status={
        unconfirmed
          ? "unconfirmed"
          : showLowest
            ? "lowest"
            : service.featured
              ? "featured"
              : "regular"
      }
      className={
        showLowest
          ? "rounded-xl bg-emerald-100 p-3 text-emerald-900 ring-1 ring-inset ring-emerald-300"
          : service.featured
            ? "rounded-xl bg-violet-100 p-3 text-violet-900 ring-1 ring-inset ring-violet-300"
            : "rounded-xl bg-slate-50 p-3 text-slate-900 ring-1 ring-inset ring-slate-200"
      }
    >
      <bdi
        dir="ltr"
        className="whitespace-nowrap text-xl font-extrabold tabular-nums"
      >
        {formatPrice(locale, service)}
      </bdi>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        {unitLabel(locale, service)}
      </p>
      {(showLowest || service.featured) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
          {showLowest && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2 py-1 text-white">
              <ArrowDown aria-hidden="true" className="size-3.5 shrink-0" />
              <span>{pageCopy[locale].lowestPrice}</span>
            </span>
          )}
          {service.featured && (
            <span
              title={t.featuredHint}
              className="inline-flex items-center gap-1 rounded-md bg-violet-700 px-2 py-1 text-white"
            >
              <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
              <span>{t.featured}</span>
            </span>
          )}
        </div>
      )}
      {unconfirmed && (
        <details className="mt-2 max-w-64 text-xs leading-5 text-slate-600">
          <summary className="cursor-pointer font-semibold text-beacon-800">
            {t.unconfirmed}
          </summary>
          <p className="mt-2">
            {!service.priceCurrency
              ? t.currencyMissing
              : service.priceUnit === "package"
                ? t.packageMissing
                : t.unitMissing}
          </p>
          <p className="mt-1">{t.unconfirmedHint}</p>
          {service.sourceUrl && (
            <a
              className="mt-2 inline-block font-semibold text-beacon-800 underline underline-offset-4"
              href={service.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.sourceLink}
            </a>
          )}
        </details>
      )}
      {showLowest && (
        <p className="mt-2 max-w-56 text-xs leading-5">
          {scope === "visible" ? t.visibleScope : t.comparisonScope}
        </p>
      )}
    </div>
  );
}

export function PriceLegend({
  hasUnconfirmed = false,
}: {
  hasUnconfirmed?: boolean;
}) {
  const { locale } = useLocale();
  const t = priceHighlightCopy[locale];
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-bold text-slate-900">{t.legend}</p>
      <ul
        aria-label={t.legend}
        className="flex flex-wrap gap-2 text-xs font-bold"
      >
        <li className="flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">
          <ArrowDown aria-hidden="true" className="size-3.5" />
          {t.lowest}
        </li>
        <li
          title={t.featuredHint}
          className="flex items-center gap-1.5 rounded-lg bg-violet-100 px-3 py-2 text-violet-900"
        >
          <Sparkles aria-hidden="true" className="size-3.5" />
          {t.featured}
        </li>
        <li className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-slate-500"
          />
          {t.regular}
        </li>
      </ul>
      {hasUnconfirmed && (
        <p className="mt-3 text-xs leading-6 text-slate-500">
          {t.pendingNotice}
        </p>
      )}
    </div>
  );
}
