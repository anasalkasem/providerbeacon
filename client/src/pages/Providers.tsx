import { ProviderCard, ProviderTableRow } from "@/components/Marketplace";
import { PublicLayout } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { providers, type Provider } from "@/data/marketplace";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Check,
  CreditCard,
  DollarSign,
  Filter,
  Gauge,
  Layers,
  LayoutGrid,
  RefreshCw,
  Scale,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Table as TableIcon,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ApiStatusBadge, PaymentMethodPill, ProviderAvatar, ScoreRing } from "@/components/Marketplace";

export default function Providers() {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"score" | "apiLatency" | "successRate" | "rating">("score");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedForCompare, setSelectedForCompare] = useState<Provider[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const filtered = useMemo(() => {
    return providers
      .filter((p) => {
        if (tierFilter !== "all" && p.tier !== tierFilter) return false;
        if (platformFilter !== "all" && !p.specialties.includes(platformFilter)) return false;
        if (
          paymentFilter !== "all" &&
          !p.paymentMethods.some((m) => m.toLowerCase().includes(paymentFilter.toLowerCase()))
        )
          return false;

        if (query.trim()) {
          const needle = query.toLowerCase();
          const matchName = p.name.toLowerCase().includes(needle);
          const matchLocation = p.location.toLowerCase().includes(needle);
          const matchDesc = p.description.toLowerCase().includes(needle);
          const matchSpecialty = p.specialties.some((s) => s.toLowerCase().includes(needle));
          const matchTier = p.tier.toLowerCase().includes(needle);
          if (!matchName && !matchLocation && !matchDesc && !matchSpecialty && !matchTier) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "score") return b.score - a.score;
        if (sortBy === "apiLatency") return parseInt(a.apiLatency) - parseInt(b.apiLatency);
        if (sortBy === "successRate") return b.successRate - a.successRate;
        if (sortBy === "rating") return b.rating - a.rating;
        return 0;
      });
  }, [query, tierFilter, platformFilter, paymentFilter, sortBy]);

  const toggleCompare = (provider: Provider) => {
    setSelectedForCompare((current) => {
      if (current.some((p) => p.id === provider.id)) {
        return current.filter((p) => p.id !== provider.id);
      }
      if (current.length >= 3) {
        return [...current.slice(1), provider];
      }
      return [...current, provider];
    });
  };

  const resetFilters = () => {
    setQuery("");
    setTierFilter("all");
    setPlatformFilter("all");
    setPaymentFilter("all");
    setSortBy("score");
  };

  return (
    <PublicLayout>
      {/* Directory Header Banner */}
      <section className="border-b border-slate-200/80 bg-white">
        <div className="container py-12 lg:py-16">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="eyebrow light">
                <Sparkles className="size-4" />
                Verified SMM Infrastructure Directory
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Know who you are buying from.
              </h1>
              <p className="mt-3 text-base leading-8 text-slate-600 sm:text-lg">
                Compare verified wholesale SMM panels, direct source server clusters, real-time API latency,
                and refill guarantee policies in one transparent registry.
              </p>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">{providers.length} Panels Verified</p>
                  <p className="text-xs text-slate-500">Live Continuous Auditing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Directory Filter & Search Toolbar */}
      <section className="container py-8">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs lg:flex-row lg:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search panel name, location, country, or keyword..."
              className="h-11 rounded-xl border-slate-200 ps-10 text-xs"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Tier Filter */}
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 text-xs sm:w-[180px]">
              <SelectValue placeholder="Panel Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Panel Tiers</SelectItem>
              <SelectItem value="Tier 1 Direct Source">Tier 1 Direct Source</SelectItem>
              <SelectItem value="Verified Enterprise">Verified Enterprise</SelectItem>
              <SelectItem value="Certified Wholesale">Certified Wholesale</SelectItem>
              <SelectItem value="Specialized Partner">Specialized Partner</SelectItem>
            </SelectContent>
          </Select>

          {/* Platform Focus Filter */}
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 text-xs sm:w-[160px]">
              <SelectValue placeholder="Platform Focus" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {["Instagram", "TikTok", "YouTube", "Telegram", "Twitter/X", "Spotify", "Facebook"].map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Payment Gateways Filter */}
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 text-xs sm:w-[160px]">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="crypto">Crypto / USDT</SelectItem>
              <SelectItem value="card">Credit Card</SelectItem>
              <SelectItem value="paypal">PayPal</SelectItem>
              <SelectItem value="wise">Wise</SelectItem>
              <SelectItem value="binance">Binance Pay</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort By */}
          <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
            <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 text-xs sm:w-[170px]">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Highest Trust Score</SelectItem>
              <SelectItem value="apiLatency">Fastest API Ping</SelectItem>
              <SelectItem value="successRate">Order Success Rate</SelectItem>
              <SelectItem value="rating">Customer Rating</SelectItem>
            </SelectContent>
          </Select>

          {/* Grid/Table Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`grid size-9 place-items-center rounded-lg transition-colors ${
                viewMode === "grid" ? "bg-white text-slate-950 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`grid size-9 place-items-center rounded-lg transition-colors ${
                viewMode === "table" ? "bg-white text-slate-950 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
              title="Table View"
            >
              <TableIcon className="size-4" />
            </button>
          </div>
        </div>

        {/* Results Metadata & Reset */}
        <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
          <p>
            Showing <strong className="text-slate-900">{filtered.length}</strong> of {providers.length} audited providers
          </p>
          {(tierFilter !== "all" || platformFilter !== "all" || paymentFilter !== "all" || query) && (
            <button onClick={resetFilters} className="font-bold text-blue-700 hover:underline">
              Clear all filters
            </button>
          )}
        </div>

        {/* View Rendering */}
        {viewMode === "grid" ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                selectedForCompare={selectedForCompare.some((p) => p.id === provider.id)}
                onToggleCompare={toggleCompare}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-start">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="w-12 px-4 py-3.5 text-center">Compare</th>
                    <th className="px-4 py-3.5 text-start">SMM Panel & Tier</th>
                    <th className="px-4 py-3.5 text-center">Beacon Score</th>
                    <th className="px-4 py-3.5 text-start">Live API Latency</th>
                    <th className="px-4 py-3.5 text-start">Fulfillment SLA</th>
                    <th className="px-4 py-3.5 text-start">Refill Policy</th>
                    <th className="px-4 py-3.5 text-start">Min Deposit</th>
                    <th className="px-4 py-3.5 text-start">Payments</th>
                    <th className="px-4 py-3.5 text-end">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((provider) => (
                    <ProviderTableRow
                      key={provider.id}
                      provider={provider}
                      selectedForCompare={selectedForCompare.some((p) => p.id === provider.id)}
                      onToggleCompare={toggleCompare}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="mt-12 rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <Filter className="mx-auto size-10 text-slate-300" />
            <h2 className="mt-4 text-base font-bold text-slate-900">No providers match your criteria</h2>
            <p className="mt-1 text-xs text-slate-500">Try loosening your filters or search keywords.</p>
            <Button onClick={resetFilters} className="mt-4 rounded-xl text-xs font-bold bg-[#0B2A68]">
              Reset All Filters
            </Button>
          </div>
        )}
      </section>

      {/* Floating Comparison Dock */}
      {selectedForCompare.length > 0 && (
        <aside
          className="fixed bottom-5 inset-x-4 z-40 mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/95 p-3.5 text-white shadow-2xl backdrop-blur-xl sm:inset-x-auto"
          aria-label="Panel Comparison Bar"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-400 text-xs font-black text-slate-950">
              {selectedForCompare.length}
            </div>
            <div>
              <p className="text-xs font-black">
                {selectedForCompare.length === 1 ? "1 Panel Selected" : `${selectedForCompare.length} Panels Selected`}
              </p>
              <p className="text-[11px] text-slate-400 truncate max-w-[260px] sm:max-w-xs">
                {selectedForCompare.map((p) => p.name).join(", ")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedForCompare([])}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              title="Clear selection"
            >
              <X className="size-4" />
            </button>
            <Button
              onClick={() => setCompareModalOpen(true)}
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 text-xs font-black text-slate-950 hover:from-cyan-300 hover:to-teal-300 shadow-sm"
            >
              <Scale className="size-3.5 mr-1.5" />
              Compare Side-by-Side
            </Button>
          </div>
        </aside>
      )}

      {/* Side-by-Side Panel Comparison Dialog */}
      <Dialog open={compareModalOpen} onOpenChange={setCompareModalOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-slate-200">
          <DialogHeader className="p-6 bg-slate-900 text-white">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              <Scale className="size-4" />
              <span>Direct SMM Infrastructure Comparison</span>
            </div>
            <DialogTitle className="text-2xl font-black text-white mt-1">
              Side-by-Side Panel Audit
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 overflow-x-auto max-h-[75vh]">
            <table className="w-full min-w-[650px] border-collapse">
              <thead>
                <tr>
                  <th className="w-48 p-3 text-start text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50 rounded-l-xl">
                    Evaluation Signal
                  </th>
                  {selectedForCompare.map((p) => (
                    <th key={p.id} className="p-3 text-start bg-slate-50 last:rounded-r-xl">
                      <div className="flex items-center gap-2.5">
                        <ProviderAvatar provider={p} />
                        <div>
                          <p className="font-extrabold text-slate-900 text-sm">{p.name}</p>
                          <p className="text-[11px] text-slate-500 font-medium">{p.tier}</p>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                <tr>
                  <td className="p-3.5 font-bold text-slate-700 bg-slate-50/50">Beacon Trust Score</td>
                  {selectedForCompare.map((p) => (
                    <td key={p.id} className="p-3.5">
                      <div className="flex items-center gap-2">
                        <ScoreRing score={p.score} size="sm" />
                        <span className="font-extrabold text-slate-900 text-sm">{p.score}/100</span>
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-700 bg-slate-50/50">Live API Latency</td>
                  {selectedForCompare.map((p) => (
                    <td key={p.id} className="p-3.5">
                      <ApiStatusBadge latency={p.apiLatency} uptime={p.apiUptime} compact />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-700 bg-slate-50/50">Order Success Rate</td>
                  {selectedForCompare.map((p) => (
                    <td key={p.id} className="p-3.5">
                      <div className="flex items-center gap-1.5 font-black text-slate-900">
                        <Gauge className="size-3.5 text-cyan-600" />
                        <span>{p.successRate}%</span>
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-700 bg-slate-50/50">Refill Policy</td>
                  {selectedForCompare.map((p) => (
                    <td key={p.id} className="p-3.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-emerald-800 font-bold">
                        <RefreshCw className="size-3" />
                        {p.refillPolicy}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-700 bg-slate-50/50">Minimum Deposit</td>
                  {selectedForCompare.map((p) => (
                    <td key={p.id} className="p-3.5 font-black text-slate-900 text-sm">
                      {p.minDeposit}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-700 bg-slate-50/50">Active Services Count</td>
                  {selectedForCompare.map((p) => (
                    <td key={p.id} className="p-3.5 font-bold text-slate-800">
                      {p.activeServicesCount.toLocaleString()} services
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-700 bg-slate-50/50">Accepted Payments</td>
                  {selectedForCompare.map((p) => (
                    <td key={p.id} className="p-3.5">
                      <div className="flex flex-wrap gap-1">
                        {p.paymentMethods.map((m) => (
                          <PaymentMethodPill key={m} method={m} />
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-700 bg-slate-50/50">Direct Profile Audit</td>
                  {selectedForCompare.map((p) => (
                    <td key={p.id} className="p-3.5">
                      <Button
                        asChild
                        size="sm"
                        className="w-full rounded-xl bg-[#0B2A68] hover:bg-blue-900 text-white font-bold"
                      >
                        <Link href={`/providers/${p.slug}`}>
                          <span>View Full Profile</span>
                          <ArrowRight className="size-3.5 ml-1" />
                        </Link>
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Onboarding Section */}
      <section id="join" className="container pb-20 pt-8">
        <div className="cta-panel">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">
              Provider Onboarding & Verification
            </p>
            <h2 className="mt-3 text-3xl font-black text-white">
              Get your SMM panel verified on ProviderBeacon.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
              Pass our automated API uptime check, confirm business contacts, and earn the Tier 1 Direct
              badge to unlock direct agency volume.
            </p>
          </div>
          <Button
            asChild
            className="h-12 rounded-xl bg-white px-6 font-black text-[#0B2A68] hover:bg-cyan-50 shadow-md"
          >
            <a href="mailto:providers@providerbeacon.com?subject=SMM%20Panel%20Verification%20Application">
              <BadgeCheck className="size-4 mr-1.5" />
              <span>Start Panel Verification</span>
              <ArrowRight className="size-4 ml-1" />
            </a>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
