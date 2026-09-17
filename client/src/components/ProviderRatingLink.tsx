import { Star } from "lucide-react";
import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { ratingsCopy } from "@/i18n/ratings";

/** Public entry point; summaries come from the real catalogue aggregates. */
export function ProviderRatingLink({
  slug,
  name,
  rating,
  reviews = 0,
  summary = false,
}: {
  slug: string;
  name: string;
  rating?: number | null;
  reviews?: number;
  summary?: boolean;
}) {
  const { locale } = useLocale();
  const t = ratingsCopy[locale];
  const hasRatings = rating != null && reviews > 0;
  return (
    <Link
      href={`/providers/${slug}#visitor-ratings`}
      className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-1 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="inline-flex items-center gap-1.5">
        <Star
          aria-hidden="true"
          className={`size-4 shrink-0 text-warning ${hasRatings ? "fill-warning" : ""}`}
        />
        {summary ? (
          hasRatings ? (
            <span>
              <bdi>
                {rating.toLocaleString(locale, { maximumFractionDigits: 2 })} /
                5
              </bdi>
              {" · "}
              {reviews.toLocaleString(locale)} {t.votes}
            </span>
          ) : (
            t.noRatings
          )
        ) : (
          t.title
        )}
      </span>
      <span className="font-bold text-foreground underline underline-offset-4">
        {t.rateProvider}
        <span className="sr-only"> · {name}</span>
      </span>
    </Link>
  );
}
