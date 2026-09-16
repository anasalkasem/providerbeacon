import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { catalogueCopy } from "@/i18n/catalogue";
import { Link } from "wouter";

export function CatalogueNotice() {
  const { source, isLoading, retry } = useMarketplaceData();
  const { locale } = useLocale(); const t = catalogueCopy[locale];
  if (isLoading || source === "database") return null;
  return <div role="alert" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm text-amber-950">
    {t.unavailable}
    {source === "unavailable" && <button onClick={retry} className="ms-3 font-bold underline">{t.retry}</button>}
  </div>;
}

export function CatalogueState({ kind = "empty" }: { kind?: "empty" | "providerMissing" | "comparisonEmpty" | "comparisonMissing" }) {
  const { isLoading, source } = useMarketplaceData();
  const { locale } = useLocale(); const t = catalogueCopy[locale];
  const title = isLoading ? t.loading : source === "unavailable" ? t.unavailable : t[kind];
  return <section className="container flex min-h-[50vh] flex-col items-center justify-center gap-5 py-16 text-center" role="status">
    <h1 className="max-w-3xl text-3xl font-extrabold text-slate-900">{title}</h1>
    {!isLoading && source !== "unavailable" && <>
      {kind === "empty" && <p className="max-w-xl text-slate-600">{t.emptyBody}</p>}
      {kind !== "empty" && <Link href="/services" className="rounded-xl bg-ink px-6 py-3 font-bold text-white">{t.latestCatalogue}</Link>}
    </>}
  </section>;
}
