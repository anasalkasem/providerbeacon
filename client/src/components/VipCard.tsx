import { useState, type MouseEvent } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Diamond, ShieldCheck, Tag } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { vipText } from "@/i18n/providerVip";
import { trackVipEvent, useVipImpression } from "@/lib/vipAnalytics";
import { useBusinessClock } from "./BusinessUi";
import { ProviderLogo } from "./ProviderMedia";
import { ProviderRatingLink } from "./ProviderRatingLink";

export type VipCardData = {
  providerId: number;
  revision: number;
  name: string;
  slug: string;
  logoUrl?: string | null;
  coverUrl: string;
  tagline: string;
  specialties: string[];
  offer: string;
  offerEndsAt: Date | null;
  ownershipVerified: boolean;
  placement?: "subscription" | "complimentary";
};
export function VipCard({
  card,
  preview = false,
  compact = false,
}: {
  card: VipCardData;
  preview?: boolean;
  compact?: boolean;
}) {
  const { locale } = useLocale();
  const t = vipText(locale);
  const now = useBusinessClock();
  const [failed, setFailed] = useState<string | null>(null);
  const placementLabel =
    card.placement === "complimentary" ? t.complimentary : t.paid;
  const ref = useVipImpression(card.providerId, card.revision, !preview);
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      !preview &&
      event.isTrusted &&
      !event.defaultPrevented &&
      (event.type === "auxclick" ? event.button === 1 : event.button === 0)
    )
      trackVipEvent(card.providerId, card.revision, "click");
  };
  const artwork = (
    <div className="relative aspect-[16/10] overflow-hidden bg-ink">
      {card.coverUrl && failed !== card.coverUrl ? (
        <img
          src={card.coverUrl}
          alt={`${t.cover} · ${card.name}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(card.coverUrl)}
          className="size-full object-contain"
        />
      ) : (
        <div className="grid size-full place-items-center bg-carbon p-5 text-center text-white">
          <div>
            <ProviderLogo
              src={card.logoUrl}
              name={card.name}
              initials={card.name.slice(0, 2).toUpperCase()}
              className="mx-auto mb-4 size-24 text-3xl"
            />
            <span className="text-xl font-bold" dir="auto">
              {card.name}
            </span>
          </div>
        </div>
      )}
      <span className="absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-ink/95 px-3 py-1.5 text-[11px] font-bold tracking-wider text-brand">
        <Diamond className="size-3" aria-hidden="true" />
        VIP
      </span>
    </div>
  );
  if (compact && !preview)
    return (
      <article
        ref={ref}
        className="vip-card vip-spotlight flex w-full flex-col overflow-hidden rounded-3xl border border-border bg-card"
        aria-label={card.name}
      >
        <Link
          href={`/providers/${card.slug}`}
          onClick={click}
          onAuxClick={click}
          aria-label={`${t.explore}: ${card.name}`}
          className="flex flex-1 flex-col rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {artwork}
          <div className="flex flex-1 flex-col p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{placementLabel}</span>
              {card.ownershipVerified && (
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="size-3.5" />
                  {t.verified}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <ProviderLogo
                src={card.logoUrl}
                name={card.name}
                initials={card.name.slice(0, 2).toUpperCase()}
                className="size-10 text-sm"
              />
              <h3
                className="min-w-0 flex-1 truncate text-xl font-extrabold text-foreground"
                dir="auto"
              >
                {card.name}
              </h3>
              <span
                className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-foreground"
                aria-hidden="true"
              >
                <ArrowUpRight className="size-5 rtl:-scale-x-100" />
              </span>
            </div>
            <p
              dir="auto"
              className="mt-3 line-clamp-2 break-words text-sm leading-6 text-secondary-foreground"
            >
              {card.tagline}
            </p>
            {card.offer &&
              card.offerEndsAt &&
              new Date(card.offerEndsAt).getTime() > now && (
                <p
                  dir="auto"
                  className="mt-3 flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-xs leading-5 text-foreground"
                >
                  <Tag className="mt-1 size-3 shrink-0" />
                  {card.offer}
                </p>
              )}
          </div>
        </Link>
        <div className="mx-5 border-t border-border py-2">
          <ProviderRatingLink slug={card.slug} name={card.name} />
        </div>
      </article>
    );
  return (
    <article
      ref={ref}
      className="vip-card group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
      aria-label={card.name}
    >
      {artwork}
      <div className="flex flex-1 flex-col p-5">
        <p className="mb-3 text-[11px] font-semibold text-muted-foreground">
          {placementLabel}
        </p>
        <div className="flex items-center gap-3">
          <ProviderLogo
            src={card.logoUrl}
            name={card.name}
            initials={card.name.slice(0, 2).toUpperCase()}
            className="size-11 text-sm"
          />
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-foreground" dir="auto">
              {card.name}
            </h3>
            {card.ownershipVerified && (
              <span className="mt-1 flex items-center gap-1 text-[11px] text-secondary-foreground">
                <ShieldCheck className="size-3.5 shrink-0" />
                {t.verified}
              </span>
            )}
          </div>
        </div>
        <p
          dir="auto"
          className="mt-4 line-clamp-3 min-h-[4.5rem] break-words text-sm leading-6 text-secondary-foreground"
        >
          {card.tagline}
        </p>
        <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
          {card.specialties.map(tag => (
            <span
              key={tag}
              dir="auto"
              className="max-w-full break-words rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
        {card.offer &&
          card.offerEndsAt &&
          new Date(card.offerEndsAt).getTime() > now && (
            <p
              dir="auto"
              className="mt-4 flex items-start gap-2 rounded-lg border border-input bg-secondary p-3 text-xs leading-6 text-foreground"
            >
              <Tag className="mt-1 size-3.5 shrink-0" />
              {card.offer}
            </p>
          )}
        {preview ? (
          <span className="beacon-ghost mt-5 flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold">
            {t.explore}
            <ArrowUpRight className="size-4 rtl:-scale-x-100" />
          </span>
        ) : (
          <div className="mt-auto pt-5">
            <Link
              href={`/providers/${card.slug}`}
              onClick={click}
              onAuxClick={click}
              className="beacon-ghost mt-auto flex min-h-11 items-center justify-between rounded-xl px-4 py-3 text-sm font-bold shadow-none"
            >
              <span className="pt-0.5">{t.explore}</span>
              <ArrowUpRight className="size-4 rtl:-scale-x-100" />
            </Link>
            <div className="mt-3 border-t border-border pt-2">
              <ProviderRatingLink slug={card.slug} name={card.name} />
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
