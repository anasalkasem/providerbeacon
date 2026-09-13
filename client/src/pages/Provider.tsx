import {
  ApiStatusBadge,
  PaymentMethodPill,
  ProviderAvatar,
  ScoreRing,
  VerifiedBadge,
} from "@/components/Marketplace";
import { PublicLayout } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { providerBySlug, services, type Service } from "@/data/marketplace";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  ExternalLink,
  Flag,
  Gauge,
  Globe,
  Layers,
  MapPin,
  MessageSquareText,
  RefreshCw,
  Scale,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";

export default function Provider() {
  const [, params] = useRoute("/providers/:slug");
  const provider = providerBySlug(params?.slug ?? "") ?? providerBySlug("northstar-social")!;
  const providerServices = useMemo(
    () => services.filter((service) => service.providerId === provider.id),
    [provider.id]
  );

  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("all");

  const filteredServices = useMemo(() => {
    return providerServices.filter((s) => {
      if (selectedPlatform !== "all" && s.platform !== selectedPlatform) return false;
      if (serviceSearch.trim()) {
        const needle = serviceSearch.toLowerCase();
        return `${s.name} ${s.category} ${s.platform}`.toLowerCase().includes(needle);
      }
      return true;
    });
  }, [providerServices, selectedPlatform, serviceSearch]);

  const platformsInCatalogue = useMemo(() => {
    return Array.from(new Set(providerServices.map((s) => s.platform)));
  }, [providerServices]);

  return (
    <PublicLayout>
      {/* Top Breadcrumb & Profile Header */}
      <section className="border-b border-slate-200/80 bg-white">
        <div className="container py-8 lg:py-12">
          <Button variant="ghost" asChild className="mb-6 -ms-3 text-slate-500 hover:text-slate-900">
            <Link href="/providers">
              <ArrowLeft className="size-4 mr-1.5" />
              <span>Back to Provider Directory</span>
            </Link>
          </Button>

          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <ProviderAvatar provider={provider} xlarge />
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                    {provider.name}
                  </h1>
                  {provider.verified && <VerifiedBadge tier={provider.tier} />}
                </div>

                <p className="mt-3 max-w-2xl text-base text-slate-600 leading-7">
                  {provider.description}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4 text-slate-400" />
                    {provider.location}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="size-4 text-slate-400" />
                    Active since {provider.since}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="size-4 text-slate-400" />
                    Sync updated {provider.updatedMinutes}m ago
                  </span>
                  <span>•</span>
                  <span className="font-bold text-emerald-700">{provider.totalOrders} total orders</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <ApiStatusBadge latency={provider.apiLatency} uptime={provider.apiUptime} />
              <Button asChild className="h-12 rounded-xl bg-[#0B2A68] hover:bg-blue-900 px-6 font-bold shadow-md">
                <a
                  href={`#catalogue`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <Layers className="size-4 mr-1.5" />
                  <span>Browse {providerServices.length} Services</span>
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Audit Grid */}
      <section className="container grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
        {/* Left Column: Trust Assessment, Signals, Catalogue */}
        <div className="space-y-8">
          {/* Beacon Trust Score Breakdown Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:p-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div>
                <p className="section-kicker">Independent Trust Audit</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                  Beacon Score Assessment: {provider.score}/100
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Based on continuous API ping tests, refill fulfillment logs, and verified customer orders.
                </p>
              </div>
              <ScoreRing score={provider.score} size="xl" showLabel />
            </div>

            {/* Individual Audit Signals */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <AuditSignalBar
                title="API Latency & Uptime"
                value={`${provider.auditSignals.apiReliability}%`}
                score={provider.auditSignals.apiReliability}
                icon={<Zap className="size-4 text-amber-500" />}
                description="Sub-150ms order dispatch & 99.9% uptime"
              />
              <AuditSignalBar
                title="Wholesale Price Fairness"
                value={`${provider.auditSignals.priceFairness}%`}
                score={provider.auditSignals.priceFairness}
                icon={<DollarSign className="size-4 text-emerald-500" />}
                description="Direct wholesale pricing without reseller bloat"
              />
              <AuditSignalBar
                title="Refill Guarantee Fulfillment"
                value={`${provider.auditSignals.refillFulfillment}%`}
                score={provider.auditSignals.refillFulfillment}
                icon={<RefreshCw className="size-4 text-cyan-500" />}
                description="Automatic drop refills processed via API"
              />
              <AuditSignalBar
                title="Support SLA & Response"
                value={`${provider.auditSignals.customerSupport}%`}
                score={provider.auditSignals.customerSupport}
                icon={<Clock3 className="size-4 text-blue-500" />}
                description={`Average response time: ${provider.responseTime}`}
              />
            </div>

            {/* Verified Strengths Pill Badges */}
            <div className="mt-8 rounded-2xl bg-slate-50/80 p-5 border border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Verified SMM Capabilities
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {provider.strengths.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-800 ring-1 ring-slate-200/80 shadow-2xs"
                  >
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    <span>{item}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* SMM Services Catalogue for this Provider */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:p-8" id="catalogue">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="section-kicker">Live Catalog</p>
                <h2 className="text-2xl font-black text-slate-950">Indexed Services</h2>
                <p className="text-xs text-slate-500">
                  {filteredServices.length} of {providerServices.length} services shown
                </p>
              </div>

              {/* Service Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Filter services..."
                  className="h-10 rounded-xl border-slate-200 ps-9 text-xs"
                />
              </div>
            </div>

            {/* Platform pills */}
            {platformsInCatalogue.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-1.5 border-b border-slate-100 pb-4">
                <button
                  onClick={() => setSelectedPlatform("all")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    selectedPlatform === "all"
                      ? "bg-[#0B2A68] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All Platforms
                </button>
                {platformsInCatalogue.map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setSelectedPlatform(platform)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                      selectedPlatform === platform
                        ? "bg-[#0B2A68] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            )}

            {/* Services List */}
            <div className="mt-6 space-y-3">
              {filteredServices.map((service) => (
                <article
                  key={service.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="platform-chip">{service.platform}</span>
                      <span className="text-xs font-bold text-slate-500">{service.category}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {service.quality}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-black text-slate-900 sm:text-base">
                      {service.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 font-medium">
                      Start: {service.startTime} · Delivery: {service.delivery} · Refill: {service.refill} · Retention:{" "}
                      {service.retention}%
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:block sm:text-end shrink-0">
                    <div>
                      <span className="text-2xl font-black text-slate-950">
                        ${service.pricePerThousand.toFixed(2)}
                      </span>
                      <p className="text-[10px] uppercase font-bold text-slate-400">per 1,000</p>
                    </div>
                    <Button asChild size="sm" className="mt-2 rounded-xl bg-[#0B2A68] hover:bg-blue-900 text-white font-bold text-xs">
                      <Link href={`/compare?services=${service.id},s1,s2`}>
                        <Scale className="size-3.5 mr-1" />
                        <span>Compare Rate</span>
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}

              {filteredServices.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                  No services matched your filter keyword.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: SMM Specifications, Verification Card, Actions */}
        <aside className="space-y-6">
          {/* Identity Verification Audit Box */}
          <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-teal-50/70 p-6 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-700/20">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <p className="font-black text-emerald-950 text-base">Verified SMM Provider</p>
                <p className="text-xs text-emerald-700 font-medium">Independent ProviderBeacon Audit</p>
              </div>
            </div>

            <ul className="mt-5 space-y-3 text-xs font-semibold text-emerald-950">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>Direct API endpoint latency tested hourly</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>Business domain ownership authenticated</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>Refill guarantee claims validated on real orders</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>Customer support response SLA benchmarked</span>
              </li>
            </ul>
          </div>

          {/* SMM Technical Specifications Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xs">
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">
              Technical Specifications
            </h3>
            <div className="mt-4 divide-y divide-slate-100 text-xs">
              <SpecItem label="Provider Tier" value={provider.tier} highlight />
              <SpecItem label="Live API Ping" value={provider.apiLatency} />
              <SpecItem label="Network Uptime" value={provider.apiUptime} />
              <SpecItem label="Order Success" value={`${provider.successRate}%`} />
              <SpecItem label="Refill Policy" value={provider.refillPolicy} />
              <SpecItem label="Minimum Deposit" value={provider.minDeposit} />
              <SpecItem label="Support SLA" value={provider.responseTime} />
              <SpecItem label="Total Orders" value={provider.totalOrders} />
            </div>

            {/* Accepted Payments */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs font-bold text-slate-700">Accepted Payment Gateways</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {provider.paymentMethods.map((method) => (
                  <PaymentMethodPill key={method} method={method} />
                ))}
              </div>
            </div>
          </div>

          {/* Compare this provider button */}
          <Button
            asChild
            variant="outline"
            className="w-full rounded-2xl border-slate-200 bg-white p-4 font-bold text-slate-800 hover:bg-slate-50 shadow-2xs"
          >
            <Link href={`/compare`}>
              <Scale className="size-4 mr-2 text-cyan-600" />
              <span>Compare with Other SMM Panels</span>
            </Link>
          </Button>

          {/* Report Data Issue */}
          <a
            href={`mailto:trust@providerbeacon.com?subject=${encodeURIComponent(
              `Audit Report for ${provider.name}`
            )}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold text-slate-500 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <Flag className="size-3.5" />
            <span>Report inaccurate provider data</span>
          </a>
        </aside>
      </section>
    </PublicLayout>
  );
}

function AuditSignalBar({
  title,
  value,
  score,
  icon,
  description,
}: {
  title: string;
  value: string;
  score: number;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-black text-slate-900">{title}</span>
        </div>
        <strong className="text-sm font-black text-slate-950">{value}</strong>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-400 transition-all duration-500"
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-slate-500 font-medium">{description}</p>
    </div>
  );
}

function SpecItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-slate-500 font-medium">{label}</span>
      <span className={`font-bold ${highlight ? "text-blue-700 font-black" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}
