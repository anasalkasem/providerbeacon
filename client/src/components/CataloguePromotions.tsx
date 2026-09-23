import { Link } from "wouter";
import { Diamond, ArrowUpRight } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { catalogueExperience } from "@/i18n/catalogueExperience";
import { vipText } from "@/i18n/providerVip";
import { trpc } from "@/lib/trpc";
import { trackVipEvent, useVipImpression } from "@/lib/vipAnalytics";
import { useBusinessClock } from "./BusinessUi";
import { ProviderImage } from "./ProviderMedia";
import type { VipCardData } from "./VipCard";

function Placement({ card }: { card: VipCardData }) {
  const { locale } = useLocale();
  const t = vipText(locale);
  const ref = useVipImpression(card.providerId, card.revision, true);
  return (
    <article
      ref={ref}
      className="min-w-0 rounded-xl border border-border bg-card"
    >
      <Link
        href={`/providers/${card.slug}`}
        onClick={event => {
          if (event.isTrusted && !event.defaultPrevented && event.button === 0)
            trackVipEvent(card.providerId, card.revision, "click");
        }}
        className="flex h-full items-center gap-3 p-3"
      >
        <ProviderImage
          src={card.coverUrl}
          alt={card.name}
          className="h-20 w-32 shrink-0 rounded-lg bg-ink object-contain"
        />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {card.placement === "complimentary" ? t.complimentary : t.paid}
          </p>
          <p className="mt-1 truncate font-extrabold" dir="auto">
            {card.name}
          </p>
          <p
            className="mt-1 line-clamp-2 text-xs text-secondary-foreground"
            dir="auto"
          >
            {card.tagline}
          </p>
        </div>
      </Link>
    </article>
  );
}

export default function CataloguePromotions() {
  const { locale } = useLocale();
  const t = catalogueExperience[locale];
  const now = useBusinessClock();
  const query = trpc.business.vip.list.useQuery(
    { page: 1 },
    { retry: false, staleTime: 60_000, refetchInterval: 60_000 }
  );
  const cards = query.isError
    ? []
    : (query.data?.items ?? [])
        .filter(card => new Date(card.endsAt).getTime() > now)
        .slice(0, 2);
  return (
    <aside
      className="my-5 rounded-2xl border border-border bg-secondary/40 p-4"
      aria-label={t.ads}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold">
            <Diamond className="size-4 text-primary" />
            {t.ads}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t.adsHelp}</p>
        </div>
        <Link
          href="/vip"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold"
        >
          {vipText(locale).all}
          <ArrowUpRight className="size-4 rtl:-scale-x-100" />
        </Link>
      </div>
      {cards.length > 0 && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {cards.map(card => (
            <Placement
              key={`${card.providerId}:${card.revision}`}
              card={card}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
