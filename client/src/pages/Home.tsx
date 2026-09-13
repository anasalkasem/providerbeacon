import { Button } from "@/components/ui/button";
import { ScoreRing, VerifiedBadge } from "@/components/Marketplace";
import { PublicLayout } from "@/components/SiteChrome";
import { TrustedProvidersSection } from "@/components/TrustedProvidersSection";
import { copy, useLocale } from "@/contexts/LocaleContext";
import { providerFor, services } from "@/data/marketplace";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function Home() {
  const { locale } = useLocale();
  const t = copy[locale];
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const featured = services.filter((service) => service.featured);

  const runSearch = () =>
    navigate(`/services${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="hero-shell overflow-hidden">
        <div className="hero-grid" aria-hidden="true" />
        <div className="container relative grid items-center gap-12 py-16 lg:grid-cols-[1.04fr_.96fr] lg:py-24">
          <div>
            <div className="eyebrow">
              <Sparkles className="size-4" />
              {t.heroEyebrow}
            </div>
            <h1 className="mt-6 max-w-3xl text-balance text-[clamp(2.5rem,5.5vw,5.2rem)] font-black leading-[1.02] tracking-tight text-white">
              {t.heroTitle}
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-base leading-8 text-slate-300 sm:text-lg">
              {t.heroBody}
            </p>

            {/* Smart Search Bar */}
            <div className="mt-9 max-w-2xl rounded-2xl border border-white/15 bg-white/10 p-2 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative flex-1">
                  <span className="sr-only">Search services</span>
                  <Search className="absolute start-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && runSearch()}
                    placeholder={t.searchPlaceholder}
                    className="h-14 w-full rounded-xl border-0 bg-white ps-12 pe-4 text-sm font-medium text-slate-900 outline-none ring-cyan-400 transition focus:ring-2"
                  />
                </label>
                <Button
                  onClick={runSearch}
                  className="h-14 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-6 font-black text-[#071321] hover:from-cyan-300 hover:to-teal-300 shadow-sm"
                >
                  <Sparkles className="size-4 mr-1.5" />
                  {t.askAi}
                </Button>
              </div>
            </div>

            {/* Popular Tags */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5 text-xs font-semibold text-slate-400">
              <span>Popular searches:</span>
              {[
                "Instagram followers",
                "TikTok views",
                "YouTube subscribers",
                "Telegram members",
                "Spotify plays",
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => navigate(`/services?q=${encodeURIComponent(item)}`)}
                  className="rounded-full border border-white/15 px-3 py-1 text-slate-300 hover:border-cyan-400 hover:text-white transition-colors"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Hero Featured AI Match Card */}
          <div className="relative mx-auto w-full max-w-xl">
            <div className="hero-orbit" aria-hidden="true" />
            <div className="relative rounded-[2rem] border border-white/15 bg-[#0D1C32]/95 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">
                    Live SMM Aggregator Index
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-white">Top Rated Direct Provider</h2>
                </div>
                <span className="live-pill">
                  <span />
                  Live Sync
                </span>
              </div>

              <div className="mt-5 rounded-2xl bg-white p-5 text-slate-950 shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black">Northstar Social</h3>
                      <VerifiedBadge tier="Tier 1 Direct Source" />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Instagram Followers — High Retention Non-Drop
                    </p>
                  </div>
                  <ScoreRing score={96} />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <MiniMetric label="Price" value="$2.42" sub="per 1K" />
                  <MiniMetric label="API Speed" value="94ms" sub="instant start" />
                  <MiniMetric label="Refill" value="30 Days" sub="automatic" />
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-4 border border-slate-100">
                  <p className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                    <Sparkles className="size-4 text-violet-600" />
                    Why Beacon Score ranks it #1
                  </p>
                  <ul className="mt-3 grid gap-2 text-xs text-slate-600">
                    <Reason>Lowest verified drop rate (&lt;1.1% over 90 days)</Reason>
                    <Reason>Direct server dispatch without third-party reseller margin</Reason>
                    <Reason>Real-time API ping verified 12 minutes ago</Reason>
                  </ul>
                </div>

                <Button
                  asChild
                  className="mt-5 w-full rounded-xl bg-[#0B2A68] hover:bg-[#10377F] text-white font-bold h-12"
                >
                  <Link href="/compare?services=s1,s2,s3">
                    <span>Compare with Other Wholesale Offers</span>
                    <ArrowRight className="size-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Global Live Stats Counters */}
        <div className="container relative -mb-10 grid gap-3 sm:grid-cols-3">
          <Stat icon={<ShieldCheck />} value="8 Verified" label="SMM Panels Audited" />
          <Stat icon={<Database />} value="22,800+" label="Services Monitored" />
          <Stat icon={<Clock3 />} value="99.94%" label="Average API Uptime" />
        </div>
      </section>

      {/* Featured SMM Services Matrix */}
      <section className="container py-24">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Live Wholesale Discovery</p>
            <h2 className="text-3xl font-black text-slate-950 sm:text-4xl">{t.bestMatches}</h2>
            <p className="mt-2 text-slate-600">{t.bestBody}</p>
          </div>
          <Button variant="outline" asChild className="rounded-xl border-slate-200 font-bold">
            <Link href="/services">
              <span>{t.viewAll}</span>
              <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        </div>

        <div className="mt-9 grid gap-5 lg:grid-cols-3">
          {featured.slice(0, 3).map((service, index) => {
            const provider = providerFor(service);
            return (
              <article key={service.id} className={`match-card ${index === 0 ? "best" : ""}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="platform-chip">{service.platform}</span>
                    <h3 className="mt-4 text-lg font-black text-slate-950">{service.name}</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      by <span className="text-slate-900">{provider.name}</span> ({provider.tier})
                    </p>
                  </div>
                  <ScoreRing score={provider.score} size="sm" />
                </div>

                <div className="mt-6 flex items-end justify-between border-y border-slate-100 py-4">
                  <div>
                    <span className="text-3xl font-black tracking-tight text-slate-950">
                      ${service.pricePerThousand.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400"> / 1,000</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                    {service.retention}% retention
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                  <Detail icon={<Clock3 />} label="Start time" value={service.startTime} />
                  <Detail icon={<ShieldCheck />} label="Refill protection" value={service.refill} />
                </div>

                <Button
                  asChild
                  className={`mt-6 w-full rounded-xl font-bold ${
                    index === 0 ? "bg-[#0B2A68] hover:bg-blue-900" : "bg-slate-900 hover:bg-slate-800"
                  }`}
                >
                  <Link href={`/compare?services=${service.id},s2,s3`}>
                    <span>Compare Rates</span>
                    <ArrowRight className="size-4 ml-1" />
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
      </section>

      {/* ULTRA-PROFESSIONAL "OUR TRUSTED PROVIDERS" SECTION */}
      <TrustedProvidersSection />

      {/* Methodology Section */}
      <section className="border-t border-slate-200 bg-white py-24" id="methodology">
        <div className="container">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_.75fr]">
            <div>
              <p className="section-kicker">Transparent Intelligence</p>
              <h2 className="max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                How ProviderBeacon audits SMM panels.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                Every Beacon Trust Score is computed from verified technical signals—never from sponsored
                kickbacks or biased advertising fees.
              </p>
            </div>
            <div className="flex lg:justify-end">
              <Button variant="outline" asChild className="rounded-xl border-slate-200 font-bold">
                <Link href="/providers">
                  <span>Explore All Audited Panels</span>
                  <ArrowRight className="size-4 ml-1" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <TrustPillar
              icon={<Zap />}
              title="Real-Time API Latency"
              body="We ping provider endpoints continuously to measure exact order dispatch speed, uptime, and server responsiveness."
            />
            <TrustPillar
              icon={<TrendingDown />}
              title="Direct Wholesale Price Index"
              body="We benchmark price per thousand across millions of orders to expose hidden reseller markups and ensure fair market pricing."
            />
            <TrustPillar
              icon={<ShieldCheck />}
              title="Automated Refill Verification"
              body="Providers are tested on their willingness and technical ability to fulfill drop refills automatically without ticket delays."
            />
          </div>
        </div>
      </section>

      {/* CTA For SMM Providers */}
      <section className="container py-20">
        <div className="cta-panel">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">
              For SMM Providers & Panel Owners
            </p>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              Connect your API to the transparent aggregator.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
              Submit your panel endpoint for automated uptime monitoring, claim your verified trust profile,
              and receive high-volume agency buyers.
            </p>
          </div>
          <Button
            asChild
            className="h-12 rounded-xl bg-white px-6 font-black text-[#0B2A68] hover:bg-cyan-50 shadow-md"
          >
            <Link href="/providers#join">
              <span>Claim Your Provider Profile</span>
              <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}

function MiniMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-2.5 bg-slate-50/50">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-900 text-sm">{value}</p>
      <p className="text-[10px] text-slate-400 font-medium">{sub}</p>
    </div>
  );
}

function Reason({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
      <span>{children}</span>
    </li>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <p className="text-2xl font-black text-slate-950">{value}</p>
        <p className="mt-0.5 text-xs font-bold text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-cyan-600 [&_svg]:size-4">{icon}</span>
      <div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function TrustPillar({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <article className="trust-pillar border border-slate-200/80 bg-white shadow-2xs">
      <span>{icon}</span>
      <h3 className="text-lg font-black">{title}</h3>
      <p className="text-xs leading-6 text-slate-600">{body}</p>
    </article>
  );
}
