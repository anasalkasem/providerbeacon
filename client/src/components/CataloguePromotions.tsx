import { Link } from "wouter";
import { Megaphone, ArrowUpRight } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { adText } from "@/i18n/advertising";
import { trpc } from "@/lib/trpc";
import { useBusinessClock } from "./BusinessUi";

export default function CataloguePromotions() {
  const { locale } = useLocale();
  const t = adText(locale),
    now = useBusinessClock();
  const query = trpc.business.promotions.list.useQuery(
    { explorer: true },
    { retry: false, staleTime: 30_000, refetchInterval: 30_000 }
  );
  const ads = query.isError
    ? []
    : (query.data?.items ?? [])
        .filter(
          ad =>
            new Date(ad.startsAt).getTime() <= now &&
            new Date(ad.endsAt).getTime() > now
        )
        .slice(0, 2);
  if (!ads.length) return null;
  return (
    <aside
      className="my-5 rounded-2xl border border-border bg-secondary/30 p-4"
      aria-label={t.title}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Megaphone className="size-4 text-primary" />
          {t.sponsored}
        </p>
        <Link
          href="/ads"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
        >
          {t.viewAll}
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        {ads.map(ad => (
          <a
            key={ad.id}
            href={ad.destinationUrl}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card p-3"
          >
            {ad.coverUrl && (
              <img
                src={ad.coverUrl}
                alt=""
                className="h-24 w-28 shrink-0 rounded-lg object-contain sm:w-36"
                loading="lazy"
              />
            )}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t.ad}</p>
              <h2 className="mt-1 break-words text-base font-bold" dir="auto">
                {ad.title}
              </h2>
              <p className="mt-2 text-xs text-muted-foreground">
                <bdi>{ad.provider.name}</bdi>
              </p>
            </div>
          </a>
        ))}
      </div>
    </aside>
  );
}
