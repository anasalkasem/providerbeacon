import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Diamond, ImagePlus } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { vipText } from "@/i18n/providerVip";
import { businessText } from "@/i18n/providerBusiness";
import { trpc } from "@/lib/trpc";
import { useBusinessClock } from "./BusinessUi";
import { VipCard } from "./VipCard";
import { VipRibbon } from "./VipRibbon";
export { VipCard, type VipCardData } from "./VipCard";

export function VipAlbum({ full = false }: { full?: boolean }) {
  const { locale } = useLocale();
  const t = vipText(locale),
    b = businessText(locale);
  const [page, setPage] = useState(1);
  const [rotation, setRotation] = useState<number | undefined>();
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
  return (
    <section
      className="editorial-section container"
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
              className="display-heading mt-3 text-4xl sm:text-5xl"
            >
              {t.title}
            </h1>
          ) : (
            <h2
              id="vip-album-title"
              className="display-heading mt-3 text-4xl sm:text-5xl"
            >
              {t.title}
            </h2>
          )}
          <p className="mt-2 text-sm leading-7 text-secondary-foreground">{t.intro}</p>
        </div>
        {!full && Boolean(items.length) && (
          <Link
            href="/vip"
            className="flex min-h-11 items-center gap-2 text-sm text-heading"
          >
            {t.all}
            <ArrowUpRight className="size-4 rtl:-scale-x-100" />
          </Link>
        )}
      </div>
      {query.isError ? (
        <div className="rounded-2xl border bg-card p-6">
          <p role="alert" className="text-sm text-secondary-foreground">
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
          className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground"
        >
          {b.loading}
        </div>
      ) : !items.length ? (
        <div className="vip-empty flex flex-col items-start gap-6 rounded-3xl border border-input bg-card p-7 sm:flex-row sm:items-center sm:p-10">
          <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-ink text-brand">
            <ImagePlus className="size-9" />
          </span>
          <div className="max-w-2xl">
            <h3 className="text-xl font-bold">{t.empty}</h3>
            <p className="mt-2 text-sm leading-7 text-secondary-foreground">
              {t.emptyBody}
            </p>
            <Link
              href="/account/provider?tab=vip"
              className="mt-4 inline-flex items-center gap-2 font-bold text-foreground"
            >
              {t.join}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
      ) : (
        <>
          {full ? (
            <div className="vip-gallery">
              {items.map(card => (
                <VipCard
                  key={`${card.providerId}:${card.revision}`}
                  card={card}
                />
              ))}
            </div>
          ) : (
            <VipRibbon
              key={items
                .map(card => `${card.providerId}:${card.revision}`)
                .join(",")}
              cards={items}
            />
          )}
          {full && data.pages > 1 && (
            <nav
              aria-label={t.title}
              className="mt-8 flex flex-wrap items-center justify-center gap-4"
            >
              <button
                disabled={data.page === 1}
                className="rounded-xl border bg-card px-4 py-2 disabled:opacity-40"
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
                className="rounded-xl border bg-card px-4 py-2 disabled:opacity-40"
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
      <p className="mt-5 max-w-3xl text-xs leading-6 text-muted-foreground">
        {t.disclosure}
      </p>
    </section>
  );
}
