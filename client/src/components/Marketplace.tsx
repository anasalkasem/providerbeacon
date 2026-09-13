import { Button } from "@/components/ui/button";
import { copy, useLocale } from "@/contexts/LocaleContext";
import { platformColor, providerFor, type Provider, type Service } from "@/data/marketplace";
import { ArrowUpRight, Check, CheckCircle2, Clock3, Gauge, RefreshCw, ShieldCheck, Star } from "lucide-react";
import { Link } from "wouter";

export function ScoreRing({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const radius = size === "lg" ? 42 : size === "sm" ? 20 : 28;
  const dimension = radius * 2 + 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: dimension, height: dimension }} aria-label={`Beacon Score ${score} out of 100`}>
      <svg viewBox={`0 0 ${dimension} ${dimension}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={dimension / 2} cy={dimension / 2} r={radius} fill="none" stroke="#E8EDF5" strokeWidth="5" />
        <circle cx={dimension / 2} cy={dimension / 2} r={radius} fill="none" stroke="url(#scoreGradient)" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
        <defs><linearGradient id="scoreGradient"><stop stopColor="#2F6BFF"/><stop offset="1" stopColor="#18B88F"/></linearGradient></defs>
      </svg>
      <span className={`${size === "lg" ? "text-2xl" : size === "sm" ? "text-xs" : "text-base"} font-extrabold text-slate-900`}>{score}</span>
    </div>
  );
}

export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200 ${compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1 text-xs"}`}><ShieldCheck className={compact ? "size-3" : "size-3.5"}/>Verified</span>;
}

export function ProviderCard({ provider }: { provider: Provider }) {
  const { locale } = useLocale();
  const t = copy[locale];
  return (
    <article className="provider-card group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3"><ProviderAvatar provider={provider}/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-bold text-slate-950">{provider.name}</h3>{provider.verified && <VerifiedBadge compact />}</div><p className="mt-1 text-xs text-slate-500">{provider.location} · Since {provider.since}</p></div></div>
        <ScoreRing score={provider.score} size="sm" />
      </div>
      <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 py-3 text-center rtl:divide-x-reverse">
        <Metric value={`${provider.rating}`} label="Rating" icon={<Star/>}/><Metric value={`${provider.successRate}%`} label="Success" icon={<Gauge/>}/><Metric value={provider.responseTime} label="Response" icon={<Clock3/>}/>
      </div>
      <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{provider.description}</p>
      <Button variant="ghost" asChild className="mt-3 w-full justify-between rounded-xl text-[#0B2A68]"><Link href={`/providers/${provider.slug}`}>{t.viewProvider}<ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"/></Link></Button>
    </article>
  );
}

function Metric({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return <div className="px-2"><div className="flex items-center justify-center gap-1.5 text-sm font-bold text-slate-900"><span className="[&_svg]:size-3.5 [&_svg]:text-cyan-600">{icon}</span>{value}</div><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">{label}</p></div>;
}

export function ProviderAvatar({ provider, large = false }: { provider: Provider; large?: boolean }) {
  return <div className={`grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#0B2A68] to-[#2476D8] font-extrabold text-white shadow-lg shadow-blue-900/10 ${large ? "size-20 text-2xl" : "size-11 text-sm"}`}>{provider.initials}</div>;
}

export function ServiceRow({ service, selected, onToggle }: { service: Service; selected: boolean; onToggle: (service: Service) => void }) {
  const provider = providerFor(service);
  return (
    <tr className="service-row">
      <td className="px-4 py-4"><button onClick={() => onToggle(service)} className={`grid size-5 place-items-center rounded border transition ${selected ? "border-cyan-500 bg-cyan-500 text-white" : "border-slate-300 bg-white"}`} aria-label={`${selected ? "Remove" : "Add"} ${service.name} ${selected ? "from" : "to"} comparison`}>{selected && <Check className="size-3.5"/>}</button></td>
      <td className="min-w-[280px] px-4 py-4"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl text-xs font-extrabold text-white" style={{ background: platformColor[service.platform] }}>{service.platform.slice(0, 2).toUpperCase()}</div><div><p className="font-bold text-slate-900">{service.name}</p><div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><span>{service.category}</span><span>•</span><span>{service.quality}</span></div></div></div></td>
      <td className="px-4 py-4"><Link href={`/providers/${provider.slug}`} className="group flex min-w-[180px] items-center gap-2"><ProviderAvatar provider={provider}/><div><span className="font-semibold text-slate-800 group-hover:text-blue-700">{provider.name}</span><div className="mt-0.5 flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="size-3"/>Score {provider.score}</div></div></Link></td>
      <td className="px-4 py-4"><span className="text-lg font-extrabold text-slate-950">${service.pricePerThousand.toFixed(2)}</span><p className="text-[10px] uppercase tracking-wide text-slate-400">per 1,000</p></td>
      <td className="px-4 py-4 text-sm text-slate-600"><div className="flex items-center gap-1.5"><Clock3 className="size-3.5 text-cyan-600"/>{service.startTime}</div><p className="mt-1 text-xs text-slate-400">{service.delivery}</p></td>
      <td className="px-4 py-4"><div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><RefreshCw className="size-3.5 text-blue-600"/>{service.refill}</div><p className="mt-1 text-xs text-slate-400">{service.retention}% retention</p></td>
    </tr>
  );
}
