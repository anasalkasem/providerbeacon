import { CataloguePagination } from "@/components/CataloguePagination";
import { ProviderCard } from "@/components/Marketplace";
import { PublicLayout } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { formatNumber, localizeData, pageCopy } from "@/i18n/messages";
import { ArrowRight, BadgeCheck, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

export default function Providers() {
  const { locale } = useLocale();
  const t = pageCopy[locale];
  const { providers, setFilters, pagination } = useMarketplaceData();
  const [query, setQuery] = useState("");
  useEffect(() => { const timer = setTimeout(() => setFilters({ q: query.trim() }), 300); return () => clearTimeout(timer); }, [query, setFilters]);
  const visible = providers;
  return <PublicLayout>
    <section className="border-b border-slate-200 bg-white"><div className="container grid gap-8 py-14 lg:grid-cols-[1fr_420px] lg:items-end"><div><div className="eyebrow light"><Sparkles className="size-4"/>{t.providersEyebrow}</div><h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">{t.providersTitle}</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">{t.providersBody}</p></div><label className="relative"><span className="sr-only">{t.searchProviders}</span><Search className="absolute start-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"/><input value={query} maxLength={100} onChange={event => setQuery(event.target.value)} className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 ps-12 pe-4 text-sm outline-none focus:border-blue-500 focus:bg-white" placeholder={t.searchProviders}/></label></div></section>
    <section className="container py-12"><div className="flex items-center justify-between"><div><p className="section-kicker">{t.evaluatedProfiles}</p><h2 className="mt-2 text-2xl font-extrabold text-slate-950">{formatNumber(locale, pagination.total)} {t.providersFound}</h2></div><div className="hidden items-center gap-2 text-sm font-semibold text-emerald-700 sm:flex"><ShieldCheck className="size-4"/>{t.identityRanking}</div></div><div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{visible.map(provider => <ProviderCard key={provider.id} provider={provider}/>)}</div><CataloguePagination/></section>
    <section id="join" className="container pb-20"><div className="cta-panel"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-cyan-200">{t.onboarding}</p><h2 className="mt-3 text-3xl font-extrabold text-white">{t.buildProfile}</h2><p className="mt-4 max-w-xl leading-7 text-slate-300">{t.onboardingBody}</p></div><Button asChild className="h-12 rounded-xl bg-white px-6 font-bold text-[#0B2A68] hover:bg-cyan-50"><a href="mailto:providers@providerbeacon.com?subject=Provider%20profile%20claim"><BadgeCheck className="size-4"/>{t.startVerification}<ArrowRight className="size-4 rtl:rotate-180"/></a></Button></div></section>
  </PublicLayout>;
}
