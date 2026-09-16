import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link } from "wouter";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Diamond,
  ImagePlus,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { vipText } from "@/i18n/providerVip";
import { businessText } from "@/i18n/providerBusiness";
import { trpc } from "@/lib/trpc";
import { trackVipEvent, useVipImpression } from "@/lib/vipAnalytics";
import { useBusinessClock } from "./BusinessUi";
import { ProviderLogo } from "./ProviderMedia";

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
};
export function VipCard({
  card,
  preview = false,
}: {
  card: VipCardData;
  preview?: boolean;
}) {
  const { locale } = useLocale();
  const t = vipText(locale);
  const now = useBusinessClock();
  const [failed, setFailed] = useState<string | null>(null);
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
  return (
    <article
      ref={ref}
      className="vip-card group flex h-full min-w-0 flex-col overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white"
      aria-label={card.name}
    >
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
          <div className="grid size-full place-items-center bg-[radial-gradient(ellipse_at_top_right,#526c31,transparent)] p-5 text-center text-white">
            <div>
              <Diamond className="mx-auto mb-3 size-10 text-brand" />
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
      <div className="flex flex-1 flex-col p-5">
        <p className="mb-3 text-[11px] font-semibold text-slate-500">
          {t.paid}
        </p>
        <div className="flex items-center gap-3">
          <ProviderLogo
            src={card.logoUrl}
            name={card.name}
            initials={card.name.slice(0, 2).toUpperCase()}
            className="size-11 text-sm"
          />
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-ink" dir="auto">
              {card.name}
            </h3>
            {card.ownershipVerified && (
              <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-600">
                <ShieldCheck className="size-3.5 shrink-0" />
                {t.verified}
              </span>
            )}
          </div>
        </div>
        <p
          dir="auto"
          className="mt-4 line-clamp-3 min-h-[4.5rem] break-words text-sm leading-6 text-slate-600"
        >
          {card.tagline}
        </p>
        <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
          {card.specialties.map(tag => (
            <span
              key={tag}
              dir="auto"
              className="max-w-full break-words rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"
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
              className="mt-4 flex items-start gap-2 rounded-lg border border-beacon-200 bg-beacon-50 p-3 text-xs leading-6 text-beacon-900"
            >
              <Tag className="mt-1 size-3.5 shrink-0" />
              {card.offer}
            </p>
          )}
        {preview ? (
          <span className="beacon-button mt-5 flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold">
            {t.explore}
            <ArrowUpRight className="size-4 rtl:-scale-x-100" />
          </span>
        ) : (
          <div className="mt-auto pt-5">
            <Link
              href={`/providers/${card.slug}`}
              onClick={click}
              onAuxClick={click}
              className="beacon-button mt-auto flex min-h-11 items-center justify-between rounded-xl px-4 py-3 text-sm font-bold group-hover:shadow-sm"
            >
              <span className="pt-0.5">{t.explore}</span>
              <ArrowUpRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

export function VipAlbum({ full = false }: { full?: boolean }) {
  const { locale } = useLocale();
  const t = vipText(locale),
    b = businessText(locale);
  const [page, setPage] = useState(1);
  const [rotation, setRotation] = useState<number | undefined>();
  const rail = useRef<HTMLDivElement>(null);
  const now = useBusinessClock();
  const query = trpc.business.vip.list.useQuery(
    { page, rotation },
    {
      retry: false,
      staleTime: 0,
      refetchInterval: 60000,
      refetchOnWindowFocus: true,
    }
  );
  const data = query.isError ? undefined : query.data;
  useEffect(() => {
    if (rotation === undefined && data) setRotation(data.rotation);
  }, [data, rotation]);
  const items =
    data?.items.filter(card => new Date(card.endsAt).getTime() > now) ?? [];
  const move = (direction: number) => {
    const container = rail.current;
    if (!container) return;
    const children = Array.from(container.children) as HTMLElement[];
    const bounds = container.getBoundingClientRect();
    const index = children.findIndex(child => {
      const r = child.getBoundingClientRect();
      return r.left >= bounds.left - 2 && r.right <= bounds.right + 2;
    });
    const next = Math.max(
      0,
      Math.min(children.length - 1, Math.max(0, index) + direction)
    );
    children[next]?.scrollIntoView({
      block: "nearest",
      inline: "start",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };
  return (
    <section
      className="container py-12 sm:py-16"
      aria-labelledby="vip-album-title"
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="section-kicker flex items-center gap-2">
            <Diamond className="size-4" />
            {t.kicker}
          </p>
          {full ? (
            <h1
              id="vip-album-title"
              className="mt-3 text-3xl font-extrabold sm:text-4xl"
            >
              {t.title}
            </h1>
          ) : (
            <h2
              id="vip-album-title"
              className="mt-3 text-2xl font-extrabold sm:text-3xl"
            >
              {t.title}
            </h2>
          )}
          <p className="mt-2 text-sm leading-7 text-slate-600">{t.intro}</p>
        </div>
        {!full && Boolean(items.length) && (
          <Link
            href="/vip"
            className="flex min-h-11 items-center gap-2 text-sm font-bold text-beacon-800"
          >
            {t.all}
            <ArrowUpRight className="size-4 rtl:-scale-x-100" />
          </Link>
        )}
      </div>
      {query.isError ? (
        <div className="rounded-2xl border bg-white p-6">
          <p role="alert" className="text-sm text-slate-600">
            {b.failed}
          </p>
          <button
            className="mt-3 font-semibold underline"
            onClick={() => query.refetch()}
          >
            {b.retry}
          </button>
        </div>
      ) : !data ? (
        <div
          role="status"
          className="rounded-2xl border bg-white p-8 text-sm text-slate-500"
        >
          {b.loading}
        </div>
      ) : !items.length ? (
        <div className="vip-empty flex flex-col items-start gap-6 rounded-3xl border border-beacon-200 bg-white p-7 sm:flex-row sm:items-center sm:p-10">
          <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-ink text-brand">
            <ImagePlus className="size-9" />
          </span>
          <div className="max-w-2xl">
            <h3 className="text-xl font-bold">{t.empty}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              {t.emptyBody}
            </p>
            <Link
              href="/account/provider?tab=vip"
              className="mt-4 inline-flex items-center gap-2 font-bold text-beacon-800"
            >
              {t.join}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={rail}
            className={
              full
                ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
                : "vip-rail grid auto-cols-[88%] grid-flow-col gap-4 overflow-x-auto overscroll-x-contain snap-x snap-mandatory pb-3 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:gap-5 sm:overflow-visible xl:grid-cols-4"
            }
          >
            {items.map(card => (
              <div
                key={`${card.providerId}:${card.revision}`}
                className="min-w-0 snap-start"
              >
                <VipCard card={card} />
              </div>
            ))}
          </div>
          {!full && items.length > 1 && (
            <div className="mt-3 flex gap-2 sm:hidden">
              <button
                aria-label={t.previous}
                onClick={() => move(-1)}
                className="touch-target grid place-items-center rounded-full border bg-white"
              >
                <ChevronLeft className="size-5 rtl:rotate-180" />
              </button>
              <button
                aria-label={t.next}
                onClick={() => move(1)}
                className="touch-target grid place-items-center rounded-full border bg-white"
              >
                <ChevronRight className="size-5 rtl:rotate-180" />
              </button>
            </div>
          )}
          {full && data.pages > 1 && (
            <nav
              aria-label={t.title}
              className="mt-8 flex flex-wrap items-center justify-center gap-4"
            >
              <button
                disabled={data.page === 1}
                className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40"
                onClick={() => {
                  setRotation(data.rotation);
                  setPage(data.page - 1);
                }}
              >
                {t.previous}
              </button>
              <span className="text-sm">
                {t.page} {data.page} / {data.pages}
              </span>
              <button
                disabled={data.page === data.pages}
                className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40"
                onClick={() => {
                  setRotation(data.rotation);
                  setPage(data.page + 1);
                }}
              >
                {t.next}
              </button>
            </nav>
          )}
        </>
      )}
      <p className="mt-5 max-w-3xl text-xs leading-6 text-slate-500">
        {t.disclosure}
      </p>
    </section>
  );
}
