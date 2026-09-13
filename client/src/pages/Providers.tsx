import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { PublicLayout } from "@/components/SiteChrome";
import { ReferenceGrid } from "@/components/Discovery";
import { ProviderCard } from "@/components/Marketplace";
import { CataloguePagination } from "@/components/CataloguePagination";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { discoveryText } from "@/i18n/discovery";
export default function Providers() {
  const { locale } = useLocale();
  const t = discoveryText(locale);
  const [query, setQuery] = useState("");
  const { providers, setFilters } = useMarketplaceData();
  useEffect(() => {
    const timer = setTimeout(() => setFilters({ q: query.trim() }), 300);
    return () => clearTimeout(timer);
  }, [query, setFilters]);
  return (
    <PublicLayout>
      <div className="container py-12" lang={locale === "ar" ? "ar" : "en"}>
        <p className="section-kicker">{t.referenceLabel}</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-relaxed text-slate-950 sm:text-5xl">
          {t.providersTitle}
        </h1>
        <p className="mt-5 max-w-3xl leading-8 text-slate-500">
          {t.referenceBody}
        </p>
        <label className="relative my-8 block max-w-xl">
          <span className="sr-only">{t.providerSearch}</span>
          <Search className="absolute start-4 top-4 size-5 text-slate-400" />
          <input
            className="h-14 w-full rounded-xl border border-slate-200 bg-white ps-12 pe-4"
            placeholder={t.providerSearch}
            maxLength={100}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </label>
        <ReferenceGrid query={query} />
        {providers.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-6 text-2xl font-extrabold">{t.liveProfiles}</h2>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {providers.map(p => (
                <ProviderCard key={p.id} provider={p} />
              ))}
            </div>
            <CataloguePagination />
          </section>
        )}
        <section
          id="join"
          className="mt-14 scroll-mt-24 rounded-2xl bg-[#0B2A48] p-8 text-white"
        >
          <h2 className="text-2xl font-extrabold">{t.join}</h2>
          <p className="mt-4 max-w-3xl leading-8 text-slate-300">
            {t.joinBody}
          </p>
        </section>
      </div>
    </PublicLayout>
  );
}
