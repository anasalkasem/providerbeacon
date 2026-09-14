import OfferEvidence, { serviceName, serviceScope } from "@/components/OfferEvidence";
import { GuideGrid } from "@/components/Discovery";
import { discoveryText } from "@/i18n/discovery";
import { priceCurrencies, priceUnits, type PriceCurrency, type PriceUnit } from "../../../shared/pricing";
import { platforms } from "../../../shared/serviceReview";
import { formatPrice, unitLabel, pricingCopy } from "@/i18n/pricing";
import { CataloguePagination } from "@/components/CataloguePagination";
import { ProviderAvatar, ServiceRow } from "@/components/Marketplace";
import { PublicLayout } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { type Service } from "@/data/marketplace";
import { formatNumber, localizeData, localizeDuration, pageCopy } from "@/i18n/messages";
import { ArrowRight, Check, Clock3, ListFilter, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function Services() {
  const { locale } = useLocale();
  const t = pageCopy[locale];
  const discovery = discoveryText(locale);
  const { services, providerFor, setFilters, pagination, isLoading } = useMarketplaceData();
  const params = new URLSearchParams(window.location.search);
  const [, navigate] = useLocation();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState("recommended");
  const [priceCurrency, setPriceCurrency] = useState<PriceCurrency | "">("");
  const [priceUnit, setPriceUnit] = useState<PriceUnit | "">("");
  const canSortPrice = !!priceCurrency && !!priceUnit && priceUnit !== "package";
  const pricing = pricingCopy[locale];
  const [quality, setQuality] = useState("all");
  const [refillOnly, setRefillOnly] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selected, setSelected] = useState<Service[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => setFilters({ q: query.trim(), platform: platform === "all" ? undefined : platform,
      quality: quality === "all" ? undefined : quality.toLowerCase() as "standard" | "premium" | "elite", refillOnly,
      priceCurrency: priceCurrency || undefined, priceUnit: priceUnit || undefined,
      sort: (sort === "price" && !canSortPrice ? "recommended" : sort) as "recommended" | "price" | "retention" }), 300);
    return () => clearTimeout(timer);
  }, [query, platform, quality, refillOnly, sort, priceCurrency, priceUnit, canSortPrice, setFilters]);
  const filtered = services;
  const toggle = (service: Service) => setSelected(current => current.some(item => item.id === service.id) ? current.filter(item => item.id !== service.id) : current.length < 4 ? [...current, service] : current);
  const compare = () => navigate(`/compare?services=${selected.map(service => service.id).join(",")}`);

  return <PublicLayout>
    <section className="border-b border-slate-200 bg-white"><div className="container py-12"><div className="eyebrow light"><Sparkles className="size-4"/>{discovery.guides}</div><h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">{pagination.total > 0 ? (locale === "ar" ? "خدمات وأسعار من مصادرها." : "Services and prices, with sources.") : discovery.guideTitle}</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">{discovery.guideBody}</p></div></section>
    <section className="container py-8"><div className="mb-6 flex max-w-3xl flex-wrap items-center gap-3"><label className="relative block min-w-0 flex-1"><span className="sr-only">{discovery.find}</span><Search className="absolute start-4 top-4 size-5 text-slate-400"/><Input value={query} maxLength={100} onChange={e=>setQuery(e.target.value)} placeholder={discovery.find} className="h-14 rounded-xl bg-white ps-12"/></label>{query && <button type="button" className="h-12 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-teal-700" onClick={()=>setQuery("")}>{discovery.clear}</button>}</div><details className="mb-6 rounded-xl border border-slate-200 bg-white p-4" open={pagination.total === 0 ? true : undefined}><summary className="cursor-pointer text-sm font-bold">{discovery.guides}</summary><div className="mt-4"><GuideGrid query={query}/></div></details>
    <details className="mt-10 rounded-2xl border border-slate-200 bg-white p-5" open={pagination.total>0?true:undefined}><summary className="cursor-pointer text-lg font-extrabold">{discovery.offers}</summary>{pagination.total > 0 && <p className="mt-4 text-sm leading-7 text-slate-500">{locale === "ar" ? "راجعنا الأسعار المعلنة ونطاق الباقات. اعتماد بيانات العرض لا يعني توثيق جودة التنفيذ؛ أكّد السعر والشروط مع المزود قبل التعاقد." : "We reviewed advertised prices and package scope. Listing review does not verify delivery quality; confirm the price and terms with the provider before engaging."}</p>}{!isLoading && pagination.total===0 && <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500">{discovery.noOffers}</p>}<div className="filter-bar mt-5">
      <Select value={platform} onValueChange={setPlatform}><SelectTrigger className="h-12 w-full rounded-xl border-slate-200 sm:w-[190px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">{t.allPlatforms}</SelectItem>{platforms.filter(value => value !== "Unknown").map(item => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Select value={sort} onValueChange={setSort}><SelectTrigger className="h-12 w-full rounded-xl border-slate-200 sm:w-[190px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="recommended">{t.recommended}</SelectItem><SelectItem value="price" disabled={!canSortPrice}>{t.lowestPrice}</SelectItem><SelectItem value="retention">{t.bestRetention}</SelectItem></SelectContent></Select>
      <Button variant="outline" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(!advancedOpen)} className="h-12 rounded-xl"><SlidersHorizontal className="size-4"/>{t.moreFilters}</Button></div>
      <div className="mt-3 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">{pricing.currency}<select aria-label={pricing.currency} className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3" value={priceCurrency} onChange={event => {setPriceCurrency(event.target.value as PriceCurrency | ""); setSort("recommended");}}><option value="">{pricing.allCurrencies}</option>{priceCurrencies.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-semibold">{pricing.unit}<select aria-label={pricing.unit} className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3" value={priceUnit} onChange={event => {setPriceUnit(event.target.value as PriceUnit | ""); setSort("recommended");}}><option value="">{pricing.allUnits}</option>{priceUnits.map(value => <option key={value} value={value}>{pricing[value]}</option>)}</select></label>
        {!canSortPrice && <p className="text-xs text-slate-500 sm:col-span-2">{pricing.sortHint}</p>}
      </div>
      {advancedOpen && <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"><Select value={quality} onValueChange={setQuality}><SelectTrigger className="h-11 w-full rounded-xl sm:w-[220px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">{t.allQuality}</SelectItem>{["Standard","Premium","Elite"].map(item => <SelectItem value={item} key={item}>{localizeData(locale, item)}</SelectItem>)}</SelectContent></Select><label className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"><input type="checkbox" checked={refillOnly} onChange={event => setRefillOnly(event.target.checked)} className="size-4 accent-cyan-600"/>{t.refillOnly}</label><button onClick={() => { setQuality("all"); setRefillOnly(false); }} className="h-11 px-3 text-sm font-semibold text-slate-500 hover:text-slate-900">{t.resetFilters}</button></div>}
      <div className="mt-6 flex items-center justify-between gap-4"><p className="text-sm text-slate-500"><strong className="text-slate-900">{formatNumber(locale, pagination.total)}</strong> {t.servicesFound}</p><div className="flex items-center gap-2 text-xs text-slate-500"><ListFilter className="size-4"/>{t.updatedContinuously}</div></div>
      <div className="mt-5 grid gap-3 md:hidden">{filtered.map(service => { const provider = providerFor(service); const checked = selected.some(item => item.id === service.id); return <article key={service.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><ProviderAvatar provider={provider}/><div className="min-w-0"><p className="text-xs font-semibold text-slate-500">{provider.name}</p><h2 className="mt-1 text-sm font-extrabold text-slate-900">{serviceName(locale, service)}</h2></div></div><button onClick={() => toggle(service)} aria-label={`${checked ? t.removeFromComparison : t.addToComparison}: ${serviceName(locale, service)}`} className={`grid size-8 shrink-0 place-items-center rounded-lg border ${checked ? "border-cyan-500 bg-cyan-500 text-white" : "border-slate-200"}`}>{checked ? <Check className="size-4"/> : <span className="text-lg leading-none">+</span>}</button></div>
        <div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{unitLabel(locale, service)}</p><bdi dir="ltr" className="mt-1 block text-xl font-extrabold">{formatPrice(locale, service)}</bdi>{service.packageDescription && <p className="mt-2 text-sm text-slate-600">{serviceScope(locale,service)}</p>}
        {!service.billingCycle && <p className="mt-2 text-xs text-slate-500">{t.start}: {localizeDuration(locale,service.startTime)} · {t.refill}: {localizeData(locale,service.refill)}</p>}
        <OfferEvidence service={service} showTerms/>
        </div></article>; })}</div>
      <div className="mt-5 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block"><div className="overflow-x-auto"><table className="w-full border-collapse text-start"><thead><tr className="border-b border-slate-200 bg-slate-50 text-start text-[11px] uppercase tracking-wider text-slate-500"><th className="w-12 px-4 py-3"><span className="sr-only">{t.comparison}</span></th><th className="px-4 py-3 text-start">{t.service}</th><th className="px-4 py-3 text-start">{t.provider}</th><th className="px-4 py-3 text-start">{t.price}</th><th className="px-4 py-3 text-start">{t.delivery}</th><th className="px-4 py-3 text-start">{t.protection}</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(service => <ServiceRow key={service.id} service={service} selected={selected.some(item => item.id === service.id)} onToggle={toggle}/>)}</tbody></table></div></div>
      {!isLoading && filtered.length === 0 && <div className="grid place-items-center px-6 py-20 text-center"><Search className="size-8 text-slate-300"/><h2 className="mt-4 font-bold text-slate-900">{t.noMatches}</h2><p className="mt-2 text-sm text-slate-500">{t.noMatchesBody}</p></div>}
      <CataloguePagination/>
    </details></section>
    {selected.length > 0 && <aside className="compare-dock" aria-label={t.comparison}><div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-400 font-extrabold text-[#071321]">{formatNumber(locale, selected.length)}</div><div className="hidden min-w-0 sm:block"><p className="font-bold text-white">{t.readyCompare}</p><p className="truncate text-xs text-slate-400">{selected.map(item => serviceName(locale, item)).join(" · ")}</p></div></div><div className="flex items-center gap-2"><button className="rounded-lg p-2 text-slate-400 hover:text-white" onClick={() => setSelected([])} aria-label={t.clearComparison}><X className="size-5"/></button><Button onClick={compare} className="rounded-xl bg-cyan-400 font-bold text-[#071321] hover:bg-cyan-300">{t.comparison} {formatNumber(locale, selected.length)}<ArrowRight className="size-4 rtl:rotate-180"/></Button></div></aside>}
  </PublicLayout>;
}
