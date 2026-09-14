import OfferEvidence, { serviceName, serviceScope, serviceTerms } from "@/components/OfferEvidence";
import QuoteWorkbench from "./QuoteWorkbench";
import { comparablePrices } from "../../../shared/pricing";
import { formatPrice, unitLabel, pricingCopy } from "@/i18n/pricing";
import { CatalogueState } from "@/components/CatalogueState";
import { catalogueCopy, percentLabel } from "@/i18n/catalogue";
import { comparisonSelection } from "@/lib/catalogue";
import { ProviderAvatar, ScoreRing, VerifiedBadge } from "@/components/Marketplace";
import { PublicLayout } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { type Service } from "@/data/marketplace";
import { formatNumber, localizeData, localizeDuration, pageCopy } from "@/i18n/messages";
import { ArrowLeft, CheckCircle2, Clock3, DollarSign, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";

export default function Compare() {
  const { locale } = useLocale();
  const t = pageCopy[locale];
  const { providerFor, serviceFor } = useMarketplaceData();
  const { selected: compared, missing } = comparisonSelection(new URLSearchParams(window.location.search).get("services"), serviceFor);
  if (!new URLSearchParams(window.location.search).get("services")) return <QuoteWorkbench/>;
  if (missing || compared.length < 2) return <PublicLayout><CatalogueState kind={missing ? "comparisonMissing" : "comparisonEmpty"} /></PublicLayout>;
  const comparable = comparablePrices(compared);
  const lowest = Math.min(...compared.map(service => service.priceAmount));
  const bestScore = Math.max(...compared.flatMap(service => { const score = providerFor(service).score; return score == null ? [] : [score]; }));
  const rows: [string, React.ReactNode, (service: Service) => React.ReactNode][] = [
    [t.beaconScore, <ShieldCheck/>, service => <div className="flex items-center gap-3"><ScoreRing score={providerFor(service).score}/><div><p className="font-bold text-slate-900">{providerFor(service).score == null ? catalogueCopy[locale].insufficient : t.explainableScore}</p><p className="text-xs text-slate-400">{providerFor(service).score == null ? catalogueCopy[locale].noScore : t.explainableScore}</p></div></div>],
    [t.priceAmount, <DollarSign/>, service => <div><bdi dir="ltr" className="text-2xl font-extrabold text-slate-950">{formatPrice(locale, service)}</bdi><p className="mt-1 text-xs text-slate-500">{unitLabel(locale, service)}</p>{service.packageDescription && <p className="mt-2 text-sm text-slate-600" dir="auto">{serviceScope(locale,service)}</p>}{comparable && service.priceAmount === lowest && <p className="mt-1 text-xs font-bold text-emerald-600">{t.lowestPrice}</p>}</div>],
    [t.startDelivery, <Clock3/>, service => <div><bdi dir="ltr" className="font-bold text-slate-900">{localizeDuration(locale, service.startTime)}</bdi><p className="text-xs text-slate-400">{t.delivery}: <bdi dir="ltr">{localizeDuration(locale, service.delivery)}</bdi></p></div>],
    [t.refillProtection, <RefreshCw/>, service => <div><p className="font-bold text-slate-900">{localizeData(locale, service.refill)}</p><p className="text-xs text-slate-400">{t.providerPolicy}</p></div>],
    [t.retention, <CheckCircle2/>, service => <div><bdi dir="ltr" className="font-bold text-slate-900">{percentLabel(service.retention)}</bdi><div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-400" style={{width:`${service.retention ?? 0}%`}}/></div></div>],
    [t.orderRange, <Sparkles/>, service => <bdi dir="ltr" className="font-bold text-slate-900">{formatNumber(locale, service.min)}–{formatNumber(locale, service.max)}</bdi>],
  ];

  if (compared.some(service => service.billingCycle === "monthly")) {
    rows.splice(2, rows.length - 2,
      [locale === "ar" ? "شروط وتكاليف إضافية" : "Terms and extra costs", <CheckCircle2/>, service => <p className="max-w-xs text-sm leading-6">{serviceTerms(locale, service) ?? "—"}</p>],
      [locale === "ar" ? "المصدر وتاريخ الفحص" : "Source and checked date", <Clock3/>, service => <OfferEvidence service={service}/>]);
  }
  return <PublicLayout>
    <section className="border-b border-slate-200 bg-white"><div className="container py-10"><Button variant="ghost" asChild className="mb-5 -ms-3 text-slate-500"><Link href="/services"><ArrowLeft className="size-4 rtl:rotate-180"/>{t.backServices}</Link></Button><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><div className="eyebrow light"><Sparkles className="size-4"/>{t.compareEyebrow}</div><h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">{t.compareTitle}</h1><p className="mt-3 max-w-2xl text-slate-600">{t.compareBody}</p></div><p className="text-sm font-semibold text-slate-500"><bdi>{formatNumber(locale, compared.length)}</bdi> {t.selectedServices}</p></div></div></section>
    <section className="container py-10">{!comparable && <p role="note" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{pricingCopy[locale].mixed}</p>}<div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[960px]"><thead><tr><th className="w-[220px] bg-slate-50 p-6 text-start align-bottom"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.comparison}</p><p className="mt-2 text-lg font-extrabold text-slate-900">{t.serviceSignals}</p></th>{compared.map(service => { const provider = providerFor(service); return <th key={service.id} className="border-s border-slate-100 p-6 text-start align-top"><div className="flex items-center gap-3"><ProviderAvatar provider={provider}/><div><div className="flex items-center gap-2"><p className="font-extrabold text-slate-950">{provider.name}</p>{provider.verified && <VerifiedBadge compact/>}</div><p className="mt-1 text-xs font-medium text-slate-500">{service.platform} · {localizeData(locale, service.category)}</p></div></div><h2 className="mt-5 max-w-[250px] text-base font-bold text-slate-800">{serviceName(locale, service)}</h2>{provider.score === bestScore && <span className="mt-4 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">{t.bestOverallScore}</span>}</th>})}</tr></thead>
      <tbody>{rows.map(([label, icon, render]) => <tr key={label} className="border-t border-slate-100"><th className="bg-slate-50 px-6 py-5 text-start"><div className="flex items-center gap-2 text-sm font-bold text-slate-700"><span className="text-cyan-600 [&_svg]:size-4">{icon}</span>{label}</div></th>{compared.map(service => <td key={service.id} className="border-s border-slate-100 px-6 py-5">{render(service)}</td>)}</tr>)}</tbody>
      <tfoot><tr className="border-t border-slate-200"><th className="bg-slate-50 p-6 text-start text-sm text-slate-500">{t.chooseConfidence}</th>{compared.map(service => { const provider = providerFor(service); return <td key={service.id} className="border-s border-slate-100 p-6"><Button asChild className="w-full rounded-xl bg-[#0B2A68]"><Link href={`/providers/${provider.slug}`}>{t.viewProvider}</Link></Button></td>; })}</tr></tfoot></table></div></section>
  </PublicLayout>;
}
