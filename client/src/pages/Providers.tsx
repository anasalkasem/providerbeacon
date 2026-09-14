import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { PublicLayout } from "@/components/SiteChrome";
import { ProviderCard } from "@/components/Marketplace";
import { CataloguePagination } from "@/components/CataloguePagination";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { discoveryText } from "@/i18n/discovery";
export default function Providers() {
  const { locale } = useLocale();
  const t = discoveryText(locale);
  const ar = locale === "ar";
  const [market, setMarket] = useState<"smm" | "packages">("smm");
  const [query, setQuery] = useState("");
  const { providers, setFilters } = useMarketplaceData();
  useEffect(() => {
    const timer = setTimeout(
      () => setFilters({ q: query.trim(), market }),
      300
    );
    return () => clearTimeout(timer);
  }, [query, market, setFilters]);
  return (
    <PublicLayout>
      <div className="container py-12" lang={locale === "ar" ? "ar" : "en"}>
        <p className="section-kicker">
          {ar ? "دليل مزودي الخدمات" : "Service provider directory"}
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-relaxed text-slate-950 sm:text-5xl">
          {market === "smm"
            ? ar
              ? "مزودو SMM وأسعارهم"
              : "SMM providers and their offers"
            : ar
              ? "وكالات التسويق"
              : "Marketing agencies"}
        </h1>
        <p className="mt-5 max-w-3xl leading-8 text-slate-500">
          {ar
            ? "اختر مزودًا لعرض خدماته المنشورة، أو قارن خدمات عدة مزودين من مستكشف العروض."
            : "Open a provider to see published services, or compare providers in the offer explorer."}
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
        <div className="flex gap-3">
          {(["smm", "packages"] as const).map(value => (
            <button
              key={value}
              aria-pressed={value === market}
              className={`rounded-xl border px-4 py-3 font-bold ${market === value ? "bg-[#0B2A48] text-white" : "bg-white"}`}
              onClick={() => setMarket(value)}
            >
              {value === "smm"
                ? "SMM"
                : ar
                  ? "باقات الوكالات"
                  : "Agency packages"}
            </button>
          ))}
        </div>
        {providers.length === 0 && <p className="mt-8 rounded-xl border p-6 text-slate-500">{ar ? "لا يوجد مزود منشور في هذه الفئة." : "No published providers in this category."}</p>}
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
