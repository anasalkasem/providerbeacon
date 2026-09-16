import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ExternalLink, Tag } from "lucide-react";

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { businessError, businessText } from "@/i18n/providerBusiness";

export const businessField =
  "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100";
export const businessPrimary =
  "beacon-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50";
export const businessSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
export function BusinessCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`beacon-surface min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 ${className}`}
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
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-800"
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
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${good ? "bg-beacon-50 text-beacon-800" : value === "pending" || value === "scheduled" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}
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
  const t = businessText(locale);
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/providers/${offer.provider.slug}`}
          className="text-sm font-bold text-beacon-700"
        >
          {offer.provider.name}
        </Link>
        <Tag className="size-5 shrink-0 text-beacon-600" />
      </div>
      <h3
        dir="auto"
        className="mt-4 break-words text-xl font-extrabold text-ink"
      >
        {offer.title}
      </h3>
      <p
        dir="auto"
        className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-slate-600"
      >
        {offer.description}
      </p>
      {offer.couponCode && (
        <p
          className="mt-5 rounded-xl border border-dashed border-beacon-300 bg-beacon-50 p-3 text-center font-mono font-bold text-beacon-900"
          dir="ltr"
        >
          {offer.couponCode}
        </p>
      )}
      <p className="mt-4 text-xs text-slate-500">
        {t.endsAt}:{" "}
        <bdi>
          {new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC",
          }).format(new Date(offer.endsAt))}{" "}
          UTC
        </bdi>
      </p>
      <a
        className={`${businessPrimary} mt-5`}
        href={offer.destinationUrl}
        target="_blank"
        rel="noopener noreferrer nofollow sponsored"
      >
        {t.open}
        <ExternalLink className="size-4" />
      </a>
    </article>
  );
}
export function PublicPromotions({ providerId }: { providerId?: number }) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const now = useBusinessClock();
  const [cursor, setCursor] = useState<number>();
  const query = trpc.business.promotions.list.useQuery(
    { providerId, cursor },
    { retry: false, staleTime: 0, refetchInterval: 30_000 }
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
      {providerId ? (
        <h2 className="text-2xl font-extrabold text-ink">{t.offers}</h2>
      ) : (
        <h1 className="text-3xl font-extrabold text-ink">{t.offers}</h1>
      )}
      <p className="mt-2 text-sm leading-7 text-slate-500">{t.offerIntro}</p>
      {!visible.length ? (
        <p className="mt-6 rounded-xl bg-slate-50 p-6 text-slate-500">
          {t.noItems}
        </p>
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
