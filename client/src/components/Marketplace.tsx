import OfferEvidence, { serviceName, serviceScope, serviceTerms } from "./OfferEvidence";
import { ProviderLogo } from "./ProviderMedia";
import { ProviderRatingLink } from "./ProviderRatingLink";
import { formatPrice, unitLabel, pricingCopy } from "@/i18n/pricing";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { catalogueCopy, percentLabel } from "@/i18n/catalogue";
import { Button } from "@/components/ui/button";
import { copy, useLocale } from "@/contexts/LocaleContext";
import { platformColor, type Provider, type Service } from "@/data/marketplace";
import { formatNumber, localizeData, localizeDuration, pageCopy } from "@/i18n/messages";
import { ArrowUpRight, Check, Clock3, CreditCard, DollarSign, Gauge, RefreshCw, Scale, ShieldCheck, Star, Zap } from "lucide-react";
import { Link } from "wouter";

export function ScoreRing({ score, size = "md", showLabel = false }: { score: number | null; size?: "sm" | "md" | "lg" | "xl"; showLabel?: boolean }) {
  const { locale } = useLocale();
  if (score == null) return <div className="inline-flex flex-col items-center gap-1" aria-label={`${pageCopy[locale].beaconScore}: ${catalogueCopy[locale].insufficient}`} title={catalogueCopy[locale].noScore}><span className="grid size-14 place-items-center rounded-full border-4 border-border text-xl font-bold text-muted-foreground">—</span>{showLabel && <span className="max-w-28 text-center text-xs text-muted-foreground">{catalogueCopy[locale].insufficient}</span>}</div>;
  const radius = size === "xl" ? 54 : size === "lg" ? 40 : size === "sm" ? 18 : 26;
  const strokeWidth = size === "xl" ? 8 : size === "lg" ? 6 : size === "sm" ? 3.5 : 4.5;
  const dimension = (radius + strokeWidth) * 2 + 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const badge = score >= 95 ? "Elite" : score >= 90 ? "High" : "Good";
  return <div className="relative inline-flex flex-col items-center justify-center" aria-label={`${pageCopy[locale].beaconScore} ${score}/100`}>
    <div className="relative inline-grid place-items-center" style={{ width: dimension, height: dimension }}><svg viewBox={`0 0 ${dimension} ${dimension}`} className="absolute inset-0 -rotate-90" aria-hidden="true"><circle cx={dimension/2} cy={dimension/2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth}/><circle cx={dimension/2} cy={dimension/2} r={radius} fill="none" stroke="var(--chart-1)" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}/></svg><div className="flex flex-col items-center justify-center leading-none"><bdi className={`${size === "xl" ? "text-3xl" : size === "lg" ? "text-xl" : size === "sm" ? "text-[11px]" : "text-base"} font-black text-foreground`}>{score}</bdi>{size !== "sm" && <span className="mt-0.5 text-[8px] font-bold uppercase text-muted-foreground">{pageCopy[locale].score}</span>}</div></div>
    {showLabel && <span className="mt-1 rounded-full bg-success-muted px-2 py-0.5 text-[10px] font-bold uppercase text-success">{localizeData(locale, badge)}</span>}
  </div>;
}

export function VerifiedBadge({ tier, compact = false }: { tier?: string; compact?: boolean }) {
  const { locale } = useLocale();
  const direct = tier?.includes("Direct Source");
  const enterprise = tier?.includes("Enterprise");
  return <span className={`inline-flex items-center gap-1.5 rounded-full font-bold ring-1 ring-inset ${direct ? "bg-success-muted text-success ring-success-border" : enterprise ? "bg-secondary text-foreground ring-ring" : "bg-secondary text-foreground ring-border"} ${compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"}`}><ShieldCheck className={compact ? "size-3" : "size-3.5"}/>{compact || !tier ? pageCopy[locale].verified : localizeData(locale, tier)}</span>;
}

export function ApiStatusBadge({ latency, uptime = "—", compact = false }: { latency: string; uptime?: string; compact?: boolean }) {
  const { locale } = useLocale();
  if (latency === "—" || uptime === "—") return <span className="text-xs text-muted-foreground">{catalogueCopy[locale].unknown}</span>;
  return <div className={`inline-flex items-center gap-2 rounded-xl border border-border bg-card font-medium text-secondary-foreground ${compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"}`} title={`${localizeData(locale,"Live API Latency")}: ${latency}`}><span className="relative flex size-2"><span className="absolute inline-flex size-2 animate-ping rounded-full bg-success-muted opacity-75"/><span className="relative inline-flex size-2 rounded-full bg-success-muted"/></span><bdi dir="ltr" className="font-semibold text-foreground">{latency}</bdi><span className="text-muted-foreground">·</span><bdi dir="ltr" className="text-muted-foreground">{uptime}</bdi></div>;
}

export function ProviderAvatar({ provider, large = false, xlarge = false }: { provider: Provider; large?: boolean; xlarge?: boolean }) {
  return <ProviderLogo src={provider.logoUrl} name={provider.name} initials={provider.initials} className={xlarge ? "size-20 rounded-3xl text-2xl" : large ? "size-14 text-lg" : "size-11 text-sm"}/>;
}

export function PaymentMethodPill({ method }: { method: string }) {
  const lower = method.toLowerCase(); const crypto = lower.includes("crypto") || lower.includes("usdt"); const card = lower.includes("card") || lower.includes("stripe");
  return <span dir="ltr" className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${crypto ? "border-warning-border bg-warning-muted text-warning" : card ? "border-input bg-secondary text-foreground" : "border-border bg-secondary text-secondary-foreground"}`}>{card ? <CreditCard className="size-2.5"/> : crypto ? <Zap className="size-2.5"/> : null}{method}</span>;
}

export function ProviderCard({ provider, selectedForCompare = false, onToggleCompare, showCompareToggle = true }: { provider: Provider; selectedForCompare?: boolean; onToggleCompare?: (provider: Provider) => void; showCompareToggle?: boolean }) {
  const { locale } = useLocale(); const t = copy[locale]; const p = pageCopy[locale];
  const href = `/providers/${provider.slug}`;
  return <article className="provider-summary provider-poster group overflow-hidden rounded-2xl border border-border bg-card">
    <Link href={href} className="provider-poster-art relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden bg-muted p-6 text-foreground">
      <div className="relative z-10 flex w-full flex-col items-center text-center">
        <div className="provider-poster-logo"><ProviderLogo src={provider.logoUrl} name={provider.name} initials={provider.initials} className="size-24 rounded-2xl text-3xl sm:size-28"/></div>
        <h2 className="mt-4 max-w-full break-words text-xl font-extrabold" dir="auto">{provider.name}</h2>
        {provider.websiteUrl && <bdi dir="ltr" className="mt-2 max-w-full truncate text-xs text-muted-foreground">{provider.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</bdi>}
      </div>
    </Link>
    <div className="border-b border-border px-4 py-4 text-center"><p className="text-2xl font-extrabold text-foreground"><bdi>{formatNumber(locale, provider.activeServicesCount)}</bdi></p><p className="mt-1 text-xs text-muted-foreground">{locale === "ar" ? "خدمة متاحة للعرض" : "listed services"}</p></div>
    <div className="flex justify-center px-3 pt-2"><ProviderRatingLink slug={provider.slug} name={provider.name} rating={provider.rating} reviews={provider.reviews} summary/></div>
    <div className="flex items-center gap-2 p-3">{showCompareToggle && onToggleCompare && <button onClick={() => onToggleCompare(provider)} aria-pressed={selectedForCompare} className={`flex min-h-11 items-center gap-1 rounded-xl border px-3 text-xs font-bold ${selectedForCompare ? "border-ring bg-secondary text-foreground" : "border-border text-secondary-foreground"}`} title={p.comparison}><Scale className="size-3.5"/>{selectedForCompare ? localizeData(locale,"Added") : t.compare}</button>}<Button variant="outline" asChild className="min-h-11 flex-1 justify-between rounded-xl text-xs font-bold"><Link href={href}>{locale === "ar" ? "عرض الخدمات والأسعار" : "View services and rates"}<ArrowUpRight className="size-4 rtl:-scale-x-100"/></Link></Button></div>
  </article>;
}

function Metric({icon,value,label}:{icon:React.ReactNode;value:string;label:string}) { return <div className="min-w-0 px-1"><div className="flex items-center justify-center gap-1 text-xs font-black text-foreground"><span className="[&_svg]:size-3 [&_svg]:text-foreground">{icon}</span><bdi dir="ltr" className="truncate">{value}</bdi></div><p className="mt-1 truncate text-[9px] font-bold uppercase text-muted-foreground">{label}</p></div>; }

export function ProviderTableRow({ provider, selectedForCompare = false, onToggleCompare }: { provider: Provider; selectedForCompare?: boolean; onToggleCompare?: (provider: Provider) => void }) {
  const { locale } = useLocale(); const p = pageCopy[locale];
  return <tr className="border-b border-border hover:bg-muted"><td className="px-4 py-4">{onToggleCompare && <button onClick={() => onToggleCompare(provider)} className={`grid size-5 place-items-center rounded border ${selectedForCompare ? "border-ring bg-graphite text-white" : "border-input bg-card"}`} aria-label={`${selectedForCompare ? p.removeFromComparison : p.addToComparison}: ${provider.name}`}>{selectedForCompare && <Check className="size-3.5"/>}</button>}</td><td className="min-w-[240px] px-4 py-4"><Link href={`/providers/${provider.slug}`} className="flex items-center gap-3"><ProviderAvatar provider={provider}/><div><p className="font-extrabold text-foreground">{provider.name}</p><p className="text-xs text-muted-foreground">{localizeData(locale,provider.tier)}</p></div></Link></td><td className="px-4 py-4 text-center"><ScoreRing score={provider.score} size="sm"/></td><td className="px-4 py-4"><ApiStatusBadge latency={provider.apiLatency} uptime={provider.apiUptime} compact/></td><td className="px-4 py-4"><bdi dir="ltr" className="font-bold">{percentLabel(provider.successRate)}</bdi><p className="text-[10px] text-muted-foreground">{localizeData(locale,"Order success")}</p></td><td className="px-4 py-4 text-xs font-bold text-success">{localizeData(locale,provider.refillPolicy)}</td><td className="px-4 py-4"><bdi dir="ltr" className="font-bold">{provider.minDeposit}</bdi><p className="text-[10px] text-muted-foreground">{localizeData(locale,"Min deposit")}</p></td><td className="px-4 py-4"><div className="flex gap-1">{provider.paymentMethods.slice(0,2).map(method => <PaymentMethodPill key={method} method={method}/>)}</div></td><td className="px-4 py-4 text-end"><Button asChild size="sm" className="rounded-xl text-xs"><Link href={`/providers/${provider.slug}`}>{localizeData(locale,"View Profile")}</Link></Button></td></tr>;
}

export function ServiceRow({ service, selected, onToggle }: { service: Service; selected: boolean; onToggle: (service: Service) => void }) {
  const { providerFor } = useMarketplaceData();
  const provider = providerFor(service); const { locale } = useLocale(); const p = pageCopy[locale];
  return <tr className="service-row"><td className="px-4 py-4"><button onClick={() => onToggle(service)} className={`grid size-5 place-items-center rounded border ${selected ? "border-ring bg-graphite text-white" : "border-input bg-card"}`} aria-label={`${selected ? p.removeFromComparison : p.addToComparison}: ${serviceName(locale,service)}`}>{selected && <Check className="size-3.5"/>}</button></td><td className="min-w-[280px] px-4 py-4"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl text-xs font-extrabold text-white" style={{background:platformColor[service.platform]}}>{service.platform.slice(0,2).toUpperCase()}</div><div><p className="font-bold text-foreground">{serviceName(locale,service)}</p><p className="mt-1 text-xs text-muted-foreground">{localizeData(locale,service.category)}{!service.billingCycle && <> · {localizeData(locale,service.quality)}</>}</p><OfferEvidence service={service}/></div></div></td><td className="px-4 py-4"><Link href={`/providers/${provider.slug}`} className="flex min-w-[180px] items-center gap-2"><ProviderAvatar provider={provider}/><div><p className="font-semibold text-foreground">{provider.name}</p><p className="text-xs text-success">{p.score} <bdi>{provider.score ?? catalogueCopy[locale].insufficient}</bdi></p></div></Link></td><td className="px-4 py-4"><bdi dir="ltr" className="text-lg font-black">{formatPrice(locale, service)}</bdi><p className="text-[10px] text-muted-foreground">{unitLabel(locale, service)}</p>{service.packageDescription && <p className="mt-1 max-w-xs text-xs text-muted-foreground" dir="auto">{serviceScope(locale,service)}</p>}{serviceTerms(locale,service) && <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">{serviceTerms(locale,service)}</p>}</td><td className="px-4 py-4 text-sm"><p className="flex items-center gap-1"><Clock3 className="size-3.5 text-foreground"/><bdi dir="ltr">{localizeDuration(locale,service.startTime)}</bdi></p><p className="mt-1 text-xs text-muted-foreground"><bdi dir="ltr">{localizeDuration(locale,service.delivery)}</bdi></p></td><td className="px-4 py-4"><p className="flex items-center gap-1 text-sm font-semibold"><RefreshCw className="size-3.5 text-foreground"/>{localizeData(locale,service.refill)}</p><p className="mt-1 text-xs text-muted-foreground"><bdi dir="ltr">{service.retention == null ? "—" : `${formatNumber(locale,service.retention)}%`}</bdi> {p.retention}</p></td></tr>;
}
