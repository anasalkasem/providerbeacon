import { ArrowDown, Sparkles } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import type { Service } from "@/data/marketplace";
import { pageCopy } from "@/i18n/messages";
import { formatPrice } from "@/i18n/pricing";
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
          ? "rounded-xl bg-success-muted p-3 text-success ring-1 ring-inset ring-success-border"
          : service.featured
            ? "rounded-xl bg-secondary p-3 text-foreground ring-1 ring-inset ring-ring"
            : "rounded-xl bg-muted p-3 text-foreground ring-1 ring-inset ring-border"
      }
    >
      <bdi
        dir="ltr"
        className="whitespace-nowrap text-xl font-extrabold tabular-nums"
      >
        {formatPrice(locale, service)}
      </bdi>

      {(showLowest || service.featured) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
          {showLowest && (
            <span className="inline-flex items-center gap-1 rounded-md bg-success-muted px-2 py-1 text-success">
              <ArrowDown aria-hidden="true" className="size-3.5 shrink-0" />
              <span>{pageCopy[locale].lowestPrice}</span>
            </span>
          )}
          {service.featured && (
            <span
              title={t.featuredHint}
              className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-foreground"
            >
              <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
              <span>{t.featured}</span>
            </span>
          )}
        </div>
      )}
      {unconfirmed && (
        <details className="mt-2 max-w-64 text-xs leading-5 text-secondary-foreground">
          <summary className="cursor-pointer font-semibold text-foreground">
            {t.unconfirmed}
          </summary>
          <p className="mt-2">
            {!service.priceCurrency
              ? t.currencyMissing
              : service.priceUnit === "package"
                ? t.packageMissing
                : t.currencyMissing}
          </p>
          <p className="mt-1">{t.unconfirmedHint}</p>
          {service.sourceUrl && (
            <a
              className="mt-2 inline-block font-semibold text-foreground underline underline-offset-4"
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
    <div className="mb-4 rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-bold text-foreground">{t.legend}</p>
      <ul
        aria-label={t.legend}
        className="flex flex-wrap gap-2 text-xs font-bold"
      >
        <li className="flex items-center gap-1.5 rounded-lg bg-success-muted px-3 py-2 text-success">
          <ArrowDown aria-hidden="true" className="size-3.5" />
          {t.lowest}
        </li>
        <li
          title={t.featuredHint}
          className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-foreground"
        >
          <Sparkles aria-hidden="true" className="size-3.5" />
          {t.featured}
        </li>
        <li className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-secondary-foreground">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-smoke"
          />
          {t.regular}
        </li>
      </ul>
      {hasUnconfirmed && (
        <p className="mt-3 text-xs leading-6 text-muted-foreground">
          {t.pendingNotice}
        </p>
      )}
    </div>
  );
}
