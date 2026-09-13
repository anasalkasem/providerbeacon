import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { providers, type Provider } from "@/data/marketplace";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  ExternalLink,
  Filter,
  Gauge,
  Layers,
  LayoutGrid,
  RefreshCw,
  Scale,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ApiStatusBadge,
  PaymentMethodPill,
  ProviderAvatar,
  ProviderCard,
  ProviderTableRow,
  ScoreRing,
  VerifiedBadge,
} from "./Marketplace";

type FilterTab = "all" | "direct" | "fast_api" | "refill" | "crypto";

export function TrustedProvidersSection({
  title = "Our Trusted SMM Providers & Verified Panels",
  subtitle = "Independent performance benchmarks across direct API latency, fulfillment rate, automatic refill guarantees, and payment transparency.",
  limit,
  showViewToggle = true,
}: {
  title?: string;
  subtitle?: string;
  limit?: number;
  showViewToggle?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedPanels, setSelectedPanels] = useState<Provider[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // Filtered providers logic
  const filtered = useMemo(() => {
    return providers.filter((p) => {
      // Tab filter
      if (activeTab === "direct" && !p.tier.includes("Direct Source")) return false;
      if (activeTab === "fast_api" && parseInt(p.apiLatency) > 120) return false;
      if (activeTab === "refill" && !p.refillPolicy.toLowerCase().includes("auto")) return false;
      if (
        activeTab === "crypto" &&
        !p.paymentMethods.some((m) => m.toLowerCase().includes("crypto") || m.toLowerCase().includes("usdt"))
      )
        return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesLocation = p.location.toLowerCase().includes(query);
        const matchesSpecialties = p.specialties.some((s) => s.toLowerCase().includes(query));
        const matchesPayment = p.paymentMethods.some((m) => m.toLowerCase().includes(query));
        if (!matchesName && !matchesLocation && !matchesSpecialties && !matchesPayment) return false;
      }

      return true;
    });
  }, [activeTab, searchQuery]);

  const displayedProviders = limit ? filtered.slice(0, limit) : filtered;

  const toggleCompare = (provider: Provider) => {
    setSelectedPanels((current) => {
      const exists = current.some((p) => p.id === provider.id);
      if (exists) {
        return current.filter((p) => p.id !== provider.id);
      }
      if (current.length >= 3) {
        return [...current.slice(1), provider];
      }
      return [...current, provider];
    });
  };

  return (
    <section className="relative overflow-hidden py-20 bg-slate-50/50" id="trusted-providers">
      <div className="container relative">
        {/* Section Header */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/80 px-3 py-1 text-xs font-black uppercase tracking-wider text-teal-800">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-teal-600" />
              </span>
              <span>Audited SMM Infrastructure</span>
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">{title}</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              asChild
              className="rounded-xl border-slate-200 bg-white font-bold text-slate-800 hover:bg-slate-50 shadow-2xs"
            >
              <Link href="/providers">
                <span>View Full Directory</span>
                <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Aggregate Network Live Pulse Bar */}
        <div className="mt-8 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:grid-cols-4 sm:p-5">
          <div className="flex items-center gap-3 border-r border-slate-100 pr-3 last:border-0">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <Server className="size-5" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900">{providers.length} Panels</p>
              <p className="text-xs font-semibold text-slate-500">Audited & Verified</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-r border-slate-100 pr-3 last:border-0">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Layers className="size-5" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900">22,800+</p>
              <p className="text-xs font-semibold text-slate-500">Indexed Services</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-r border-slate-100 pr-3 last:border-0">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
              <Activity className="size-5" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900">99.94%</p>
              <p className="text-xs font-semibold text-slate-500">Avg. Network Uptime</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <Zap className="size-5" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900">112ms</p>
              <p className="text-xs font-semibold text-slate-500">Avg. API Latency</p>
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs md:flex-row md:items-center md:justify-between">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "all"
                  ? "bg-[#0B2A68] text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              All Panels ({providers.length})
            </button>
            <button
              onClick={() => setActiveTab("direct")}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "direct"
                  ? "bg-[#0B2A68] text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Direct Wholesale ({providers.filter((p) => p.tier.includes("Direct Source")).length})
            </button>
            <button
              onClick={() => setActiveTab("fast_api")}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "fast_api"
                  ? "bg-[#0B2A68] text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Fastest API (&lt;120ms)
            </button>
            <button
              onClick={() => setActiveTab("refill")}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "refill"
                  ? "bg-[#0B2A68] text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Auto-Refill Guarantee
            </button>
            <button
              onClick={() => setActiveTab("crypto")}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "crypto"
                  ? "bg-[#0B2A68] text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Crypto & Instant Pay
            </button>
          </div>

          {/* Search + View Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-60">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search panels, crypto, etc."
                className="h-10 rounded-xl border-slate-200 ps-9 text-xs"
              />
            </div>

            {showViewToggle && (
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`grid size-8 place-items-center rounded-lg transition-colors ${
                    viewMode === "grid" ? "bg-white text-slate-950 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-900"
                  }`}
                  aria-label="Grid View"
                  title="Grid view"
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`grid size-8 place-items-center rounded-lg transition-colors ${
                    viewMode === "table" ? "bg-white text-slate-950 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-900"
                  }`}
                  aria-label="Table View"
                  title="Matrix table view"
                >
                  <TableIcon className="size-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results Counter */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <p>
            Showing <strong className="text-slate-900">{displayedProviders.length}</strong> audited providers
          </p>
          <span className="flex items-center gap-1.5 font-medium text-emerald-700">
            <ShieldCheck className="size-3.5" />
            Zero Sponsored Bias in Reliability Scoring
          </span>
        </div>

        {/* Content Display: Grid or Table */}
        {viewMode === "grid" ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayedProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                selectedForCompare={selectedPanels.some((p) => p.id === provider.id)}
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
                  {displayedProviders.map((provider) => (
                    <ProviderTableRow
                      key={provider.id}
                      provider={provider}
                      selectedForCompare={selectedPanels.some((p) => p.id === provider.id)}
                      onToggleCompare={toggleCompare}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {displayedProviders.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <Filter className="mx-auto size-8 text-slate-300" />
            <h3 className="mt-3 text-base font-bold text-slate-900">No providers matched this filter</h3>
            <p className="mt-1 text-xs text-slate-500">Try adjusting your search query or reset the filter tab.</p>
            <Button
              variant="outline"
              onClick={() => {
                setActiveTab("all");
                setSearchQuery("");
              }}
              className="mt-4 rounded-xl text-xs font-bold"
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* Floating Panel Comparison Dock */}
      {selectedPanels.length > 0 && (
        <aside
          className="fixed bottom-5 inset-x-4 z-40 mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/95 p-3.5 text-white shadow-2xl backdrop-blur-xl sm:inset-x-auto"
          aria-label="Panel Comparison Bar"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-400 text-xs font-black text-slate-950">
              {selectedPanels.length}
            </div>
            <div>
              <p className="text-xs font-black">
                {selectedPanels.length === 1 ? "1 Panel Selected" : `${selectedPanels.length} Panels Selected`}
              </p>
              <p className="text-[11px] text-slate-400 truncate max-w-[260px] sm:max-w-xs">
                {selectedPanels.map((p) => p.name).join(", ")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedPanels([])}
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
                  {selectedPanels.map((p) => (
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
                  {selectedPanels.map((p) => (
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
                  {selectedPanels.map((p) => (
                    <td key={p.id} className="p-3.5">
                      <ApiStatusBadge latency={p.apiLatency} uptime={p.apiUptime} compact />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-700 bg-slate-50/50">Order Success Rate</td>
                  {selectedPanels.map((p) => (
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
                  {selectedPanels.map((p) => (
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
                  {selectedPanels.map((p) => (
                    <td key={p.id} className="p-3.5 font-black text-slate-900 text-sm">
                      {p.minDeposit}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-700 bg-slate-50/50">Active Services Count</td>
                  {selectedPanels.map((p) => (
                    <td key={p.id} className="p-3.5 font-bold text-slate-800">
                      {p.activeServicesCount.toLocaleString()} services
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-700 bg-slate-50/50">Accepted Payments</td>
                  {selectedPanels.map((p) => (
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
                  <td className="p-3.5 font-bold text-slate-700 bg-slate-50/50">Platform Specialties</td>
                  {selectedPanels.map((p) => (
                    <td key={p.id} className="p-3.5">
                      <div className="flex flex-wrap gap-1">
                        {p.specialties.map((spec) => (
                          <span
                            key={spec}
                            className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-700 bg-slate-50/50">Direct Profile Audit</td>
                  {selectedPanels.map((p) => (
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
    </section>
  );
}
