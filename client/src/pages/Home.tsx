import { Button } from "@/components/ui/button";
import { ProviderCard, ScoreRing, VerifiedBadge } from "@/components/Marketplace";
import { PublicLayout } from "@/components/SiteChrome";
import { copy, useLocale } from "@/contexts/LocaleContext";
import { providerFor, providers, services } from "@/data/marketplace";
import { ArrowRight, BarChart3, CheckCircle2, Clock3, Database, Search, ShieldCheck, Sparkles, TrendingDown } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function Home() {
  const { locale } = useLocale();
  const t = copy[locale];
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const featured = services.filter((service) => service.featured);

  const runSearch = () => navigate(`/services${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);

  return (
    <PublicLayout>
      <section className="hero-shell overflow-hidden">
        <div className="hero-grid" aria-hidden="true" />
        <div className="container relative grid items-center gap-12 py-16 lg:grid-cols-[1.04fr_.96fr] lg:py-24">
          <div>
            <div className="eyebrow"><Sparkles className="size-4" />{t.heroEyebrow}</div>
            <h1 className="mt-6 max-w-3xl text-balance text-[clamp(2.8rem,6vw,5.8rem)] font-extrabold leading-[.96] tracking-[-.055em] text-white">{t.heroTitle}</h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-slate-300">{t.heroBody}</p>
            <div className="mt-9 max-w-2xl rounded-2xl border border-white/10 bg-white/10 p-2 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative flex-1"><span className="sr-only">Search services</span><Search className="absolute start-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && runSearch()} placeholder={t.searchPlaceholder} className="h-14 w-full rounded-xl border-0 bg-white ps-12 pe-4 text-sm text-slate-900 outline-none ring-cyan-400 transition focus:ring-2"/></label>
                <Button onClick={runSearch} className="h-14 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-6 font-bold text-[#071321] hover:from-cyan-300 hover:to-teal-300"><Sparkles className="size-4"/>{t.askAi}</Button>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-400"><span>Popular:</span>{["Instagram followers", "TikTok views", "YouTube subscribers"].map((item) => <button key={item} onClick={() => navigate(`/services?q=${encodeURIComponent(item)}`)} className="rounded-full border border-white/10 px-3 py-1.5 hover:border-cyan-400/50 hover:text-white">{item}</button>)}</div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="hero-orbit" aria-hidden="true" />
            <div className="relative rounded-[2rem] border border-white/10 bg-[#0D1C32]/90 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">AI recommendation</p><h2 className="mt-1 text-lg font-bold text-white">Best overall match</h2></div><span className="live-pill"><span/>Live data</span></div>
              <div className="mt-5 rounded-2xl bg-white p-5 text-slate-950">
                <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-extrabold">Northstar Social</h3><VerifiedBadge/></div><p className="mt-1 text-sm text-slate-500">Instagram Followers — Premium</p></div><ScoreRing score={96}/></div>
                <div className="mt-6 grid grid-cols-3 gap-2"><MiniMetric label="Price" value="$2.42" sub="per 1K"/><MiniMetric label="Start" value="0–15m" sub="fast"/><MiniMetric label="Retention" value="98%" sub="verified"/></div>
                <div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="flex items-center gap-2 text-sm font-bold text-slate-900"><Sparkles className="size-4 text-violet-600"/>Why Beacon AI chose it</p><ul className="mt-3 grid gap-2 text-xs text-slate-600"><Reason>Highest reliability in this price range</Reason><Reason>30-day refill protection</Reason><Reason>Price verified 12 minutes ago</Reason></ul></div>
                <Button asChild className="mt-5 w-full rounded-xl bg-[#0B2A68] hover:bg-[#10377F]"><Link href="/compare">Compare this match<ArrowRight className="size-4 rtl:rotate-180"/></Link></Button>
              </div>
            </div>
          </div>
        </div>
        <div className="container relative -mb-10 grid gap-3 sm:grid-cols-3">
          <Stat icon={<ShieldCheck/>} value="1,284" label={t.verified}/><Stat icon={<Database/>} value="48,621" label={t.services}/><Stat icon={<Clock3/>} value="96.4%" label={t.checked}/>
        </div>
      </section>

      <section className="container py-24">
        <div className="section-heading"><div><p className="section-kicker">Smart discovery</p><h2>{t.bestMatches}</h2><p>{t.bestBody}</p></div><Button variant="outline" asChild className="rounded-xl"><Link href="/services">{t.viewAll}<ArrowRight className="size-4 rtl:rotate-180"/></Link></Button></div>
        <div className="mt-9 grid gap-5 lg:grid-cols-3">
          {featured.map((service, index) => { const provider = providerFor(service); return <article key={service.id} className={`match-card ${index === 0 ? "best" : ""}`}><div className="flex items-start justify-between"><div><span className="platform-chip">{service.platform}</span><h3 className="mt-4 text-lg font-extrabold text-slate-950">{service.name}</h3><p className="mt-1 text-sm text-slate-500">by {provider.name}</p></div><ScoreRing score={provider.score} size="sm"/></div><div className="mt-6 flex items-end justify-between border-y border-slate-100 py-5"><div><span className="text-3xl font-extrabold tracking-tight text-slate-950">${service.pricePerThousand.toFixed(2)}</span><span className="text-xs text-slate-400"> / 1,000</span></div><span className="text-xs font-semibold text-emerald-700">{service.retention}% retention</span></div><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><Detail icon={<Clock3/>} label="Start time" value={service.startTime}/><Detail icon={<ShieldCheck/>} label="Refill" value={service.refill}/></div><Button asChild className={`mt-6 w-full rounded-xl ${index === 0 ? "bg-[#0B2A68]" : "bg-slate-900"}`}><Link href={`/compare?services=${service.id}`}>{t.compare}<ArrowRight className="size-4 rtl:rotate-180"/></Link></Button></article>})}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-24" id="methodology">
        <div className="container">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_.75fr]"><div><p className="section-kicker">Provider intelligence</p><h2 className="max-w-3xl text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">{t.trustedTitle}</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{t.trustedBody}</p></div><div className="flex lg:justify-end"><Button variant="outline" asChild className="rounded-xl"><Link href="/#methodology">{t.methodology}<ArrowRight className="size-4 rtl:rotate-180"/></Link></Button></div></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3"><TrustPillar icon={<TrendingDown/>} title="Verified pricing" body="Rate history and freshness signals make stale offers visible."/><TrustPillar icon={<BarChart3/>} title="Operational reliability" body="Completion, support and retention signals shape every score."/><TrustPillar icon={<ShieldCheck/>} title="Independent ranking" body="Sponsored placements never alter the core reliability score."/></div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{providers.map((provider) => <ProviderCard key={provider.id} provider={provider}/>)}</div>
        </div>
      </section>

      <section className="container py-20"><div className="cta-panel"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-cyan-200">For service providers</p><h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">Earn trust before asking for the click.</h2><p className="mt-4 max-w-xl leading-7 text-slate-300">Claim your profile, verify your business and keep your service data accurate.</p></div><Button asChild className="h-12 rounded-xl bg-white px-6 font-bold text-[#0B2A68] hover:bg-cyan-50"><Link href="/providers#join">Claim your provider profile<ArrowRight className="size-4"/></Link></Button></div></section>
    </PublicLayout>
  );
}

function MiniMetric({ label, value, sub }: { label: string; value: string; sub: string }) { return <div className="rounded-xl border border-slate-100 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-extrabold">{value}</p><p className="text-[10px] text-slate-400">{sub}</p></div> }
function Reason({ children }: { children: React.ReactNode }) { return <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 shrink-0 text-emerald-500"/>{children}</li> }
function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) { return <div className="stat-card"><div className="stat-icon">{icon}</div><div><p className="text-2xl font-extrabold text-slate-950">{value}</p><p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p></div></div> }
function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-start gap-2"><span className="mt-0.5 text-cyan-600 [&_svg]:size-4">{icon}</span><div><p className="text-xs text-slate-400">{label}</p><p className="font-semibold text-slate-700">{value}</p></div></div> }
function TrustPillar({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) { return <article className="trust-pillar"><span>{icon}</span><h3>{title}</h3><p>{body}</p></article> }
