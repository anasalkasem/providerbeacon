import { adText } from "@/i18n/advertising";
import { promotionCategories } from "../../../shared/providerBusiness";
import { MobileDisclosure } from "./MobileDisclosure";
import { mobileLayoutCopy } from "@/i18n/mobileLayout";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ExternalLink, Tag, Search, Megaphone } from "lucide-react";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { businessError, businessText } from "@/i18n/providerBusiness";

export const businessField =
  "mt-2 block w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground disabled:bg-secondary";
export const businessPrimary =
  "beacon-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50";
export const businessSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
export function BusinessCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`beacon-surface min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}
export function BusinessError({ message }: { message?: string }) {
  const { locale } = useLocale();
  return (
    <p
      role="alert"
      className="rounded-xl border border-danger-border bg-danger-muted p-4 text-sm leading-7 text-danger"
    >
      {businessError(message ?? "", locale)}
    </p>
  );
}
export function BusinessStatus({ value }: { value: string }) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const good = value === "active" || value === "approved";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${good ? "bg-secondary text-foreground" : value === "pending" || value === "scheduled" ? "bg-warning-muted text-warning" : "bg-secondary text-secondary-foreground"}`}
    >
      {t[value as keyof typeof t] ?? t.status}
    </span>
  );
}
export const businessDateInput = (value: Date | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 16) : "";
export const businessParseDate = (value: string) =>
  value ? new Date(`${value}:00Z`) : null;
export function useBusinessClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function BusinessPager({
  cursor,
  nextCursor,
  onChange,
}: {
  cursor?: number;
  nextCursor?: number;
  onChange: (value?: number) => void;
}) {
  const { locale } = useLocale();
  const t = businessText(locale);
  return (
    <div className="mt-5 flex flex-wrap gap-3">
      {cursor && (
        <button
          className={businessSecondary}
          onClick={() => onChange(undefined)}
        >
          {t.first}
        </button>
      )}
      {nextCursor && (
        <button
          className={businessSecondary}
          onClick={() => onChange(nextCursor)}
        >
          {t.next}
        </button>
      )}
    </div>
  );
}

type PublicPromotion =
  inferRouterOutputs<AppRouter>["business"]["promotions"]["list"]["items"][number];
export function PublicPromotionCard({ offer }: { offer: PublicPromotion }) {
  const { locale } = useLocale();
  const t = businessText(locale),
    a = adText(locale);
  return (
    <article className="promotion-card flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {offer.coverUrl && (
        <a
          href={offer.destinationUrl}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          aria-label={offer.title}
          className="block aspect-[16/10] border-b border-border bg-secondary/30"
        >
          <img
            src={offer.coverUrl}
            alt={offer.title}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </a>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
            <Tag className="size-3" />
            {offer.couponCode ? a.coupon : a.ad}
          </span>
          {offer.category && offer.category !== "all" && (
            <span>{offer.category === "Other" ? a.other : offer.category}</span>
          )}
        </div>
        <h3
          dir="auto"
          className="mt-3 break-words text-xl font-extrabold leading-snug text-foreground"
        >
          {offer.title}
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          {a.provider}:{" "}
          <Link
            href={`/providers/${offer.provider.slug}`}
            className="font-semibold underline underline-offset-4"
          >
            <bdi>{offer.provider.name}</bdi>
          </Link>
        </p>
        <MobileDisclosure label={mobileLayoutCopy[locale].details}>
          <p
            dir="auto"
            className="mt-4 whitespace-pre-line break-words text-sm leading-7 text-secondary-foreground"
          >
            {offer.description}
          </p>
        </MobileDisclosure>
        {offer.couponCode && (
          <p
            className="mt-5 rounded-xl border border-dashed border-input bg-secondary p-3 text-center font-mono font-bold text-foreground"
            dir="ltr"
          >
            {offer.couponCode}
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          {t.endsAt}:{" "}
          <bdi>
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeZone: "UTC",
            }).format(new Date(offer.endsAt))}{" "}
            UTC
          </bdi>
        </p>
        <div className="mt-auto pt-5">
          <a
            className={`${businessPrimary} w-full`}
            href={offer.destinationUrl}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
          >
            {a.open}
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>
    </article>
  );
}
export function PublicPromotions({
  providerId,
  directory = false,
}: {
  providerId?: number;
  directory?: boolean;
}) {
  const { locale } = useLocale();
  const t = businessText(locale),
    a = adText(locale);
  const [search, setSearch] = useState("");
  const [category, setCategory] =
    useState<(typeof promotionCategories)[number]>("all");
  const now = useBusinessClock();
  const [cursor, setCursor] = useState<number>();
  const query = trpc.business.promotions.list.useQuery(
    { providerId, cursor, q: search || undefined, category },
    {
      retry: false,
      staleTime: 0,
      refetchInterval: 30_000,
      placeholderData: previous => previous,
    }
  );
  if (query.isError) return <BusinessError message={query.error.message} />;
  if (!query.data) return <p role="status">{t.loading}</p>;
  const visible = query.data.items.filter(
    o =>
      new Date(o.startsAt).getTime() <= now &&
      new Date(o.endsAt).getTime() > now
  );
  if (!visible.length && providerId && !cursor) return null;
  return (
    <section className="mt-8">
      {directory ? (
        <div className="mb-6 grid gap-4 rounded-2xl border border-border bg-secondary/30 p-4 md:grid-cols-[1fr_220px]">
          <label className="text-sm font-semibold">
            {a.search}
            <input
              type="search"
              maxLength={100}
              placeholder={a.searchHint}
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setCursor(undefined);
              }}
              className={businessField}
            />
          </label>
          <label className="text-sm font-semibold">
            {a.category}
            <select
              value={category}
              onChange={e => {
                setCategory(e.target.value as typeof category);
                setCursor(undefined);
              }}
              className={businessField}
            >
              {promotionCategories.map(c => (
                <option key={c} value={c}>
                  {c === "all" ? a.all : c === "Other" ? a.other : c}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : providerId ? (
        <h2 className="text-2xl font-extrabold text-foreground">{t.offers}</h2>
      ) : (
        <h1 className="text-3xl font-extrabold text-foreground">{t.offers}</h1>
      )}
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        {directory ? a.latest : t.offerIntro}
      </p>
      {!visible.length ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center sm:p-12">
          <Megaphone className="mx-auto size-8 text-primary" />
          <h2 className="mt-4 text-xl font-bold">
            {search || category !== "all" ? a.noMatch : a.empty}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            {a.emptyHelp}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {(search || category !== "all") && (
              <button
                className={businessSecondary}
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                  setCursor(undefined);
                }}
              >
                {a.clear}
              </button>
            )}
            <Link href="/providers" className={businessSecondary}>
              {a.directory}
            </Link>
          </div>
        </div>
      ) : (
        <div
          className={`mt-6 grid gap-5 ${providerId ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}
        >
          {visible.map(offer => (
            <PublicPromotionCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
      <BusinessPager
        cursor={cursor}
        nextCursor={query.data.nextCursor}
        onChange={setCursor}
      />
    </section>
  );
}
