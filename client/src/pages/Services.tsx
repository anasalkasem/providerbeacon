import { ProviderAvatar, ServiceRow } from "@/components/Marketplace";
import { PublicLayout } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { providerFor, providers, services, type Service } from "@/data/marketplace";
import {
  ArrowRight,
  Check,
  Clock3,
  Filter,
  ListFilter,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function Services() {
  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get("q") ?? "";
  const [, navigate] = useLocation();
  const [query, setQuery] = useState(initialQuery);
  const [platform, setPlatform] = useState("all");
  const [providerId, setProviderId] = useState("all");
  const [sort, setSort] = useState("recommended");
  const [quality, setQuality] = useState("all");
  const [refillOnly, setRefillOnly] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selected, setSelected] = useState<Service[]>([]);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    const result = services.filter((service) => {
      const provider = providerFor(service);
      if (platform !== "all" && service.platform !== platform) return false;
      if (providerId !== "all" && service.providerId !== providerId) return false;
      if (quality !== "all" && service.quality !== quality) return false;
      if (refillOnly && service.refill.toLowerCase().includes("no refill")) return false;
      if (
        needle &&
        !`${service.platform} ${service.category} ${service.name} ${provider.name} ${provider.tier}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });

    return [...result].sort((a, b) => {
      if (sort === "price") return a.pricePerThousand - b.pricePerThousand;
      if (sort === "retention") return b.retention - a.retention;
      if (sort === "score") return providerFor(b).score - providerFor(a).score;
      return Number(b.featured) - Number(a.featured);
    });
  }, [platform, providerId, query, quality, refillOnly, sort]);

  const toggle = (service: Service) =>
    setSelected((current) =>
      current.some((item) => item.id === service.id)
        ? current.filter((item) => item.id !== service.id)
        : current.length < 4
          ? [...current, service]
          : current
    );

  const compare = () =>
    navigate(`/compare?services=${selected.map((service) => service.id).join(",")}`);

  return (
    <PublicLayout>
      <section className="border-b border-slate-200/80 bg-white">
        <div className="container py-12 lg:py-16">
          <div className="eyebrow light">
            <Sparkles className="size-4" />
            Wholesale SMM Services Index
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Discover services with real evidence, not guesswork.
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
            Search verified service rates, compare providers side-by-side, filter by automatic refill
            guarantees, and see exactly what drives each Beacon Trust Score.
          </p>
        </div>
      </section>

      <section className="container py-8">
        <div className="filter-bar">
          <label className="relative flex-1">
            <span className="sr-only">Search service catalogue</span>
            <Search className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by platform, service keyword, or provider name..."
              className="h-12 rounded-xl border-slate-200 ps-11 text-xs"
            />
          </label>

          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 sm:w-[170px] text-xs font-bold">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {["Instagram", "TikTok", "YouTube", "Telegram", "Twitter/X", "Spotify", "Facebook"].map(
                (item) => (
                  <SelectItem value={item} key={item}>
                    {item}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          <Select value={providerId} onValueChange={setProviderId}>
            <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 sm:w-[190px] text-xs font-bold">
              <SelectValue placeholder="All Providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SMM Panels</SelectItem>
              {providers.map((p) => (
                <SelectItem value={p.id} key={p.id}>
                  {p.name} ({p.score})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 sm:w-[180px] text-xs font-bold">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recommended">Recommended</SelectItem>
              <SelectItem value="price">Lowest price / 1K</SelectItem>
              <SelectItem value="score">Highest Trust Score</SelectItem>
              <SelectItem value="retention">Best retention</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="h-12 rounded-xl border-slate-200 font-bold text-xs"
          >
            <SlidersHorizontal className="size-4 mr-1.5" />
            More filters
          </Button>
        </div>

        {advancedOpen && (
          <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
            <Select value={quality} onValueChange={setQuality}>
              <SelectTrigger className="h-11 w-full rounded-xl sm:w-[220px] text-xs font-bold">
                <SelectValue placeholder="Quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All quality levels</SelectItem>
                <SelectItem value="Standard">Standard Quality</SelectItem>
                <SelectItem value="Premium">Premium Quality</SelectItem>
                <SelectItem value="Elite">Elite Quality</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={refillOnly}
                onChange={(event) => setRefillOnly(event.target.checked)}
                className="size-4 accent-[#0B2A68]"
              />
              Refill protection guarantee only
            </label>

            <button
              onClick={() => {
                setQuality("all");
                setRefillOnly(false);
              }}
              className="h-11 px-3 text-xs font-bold text-slate-500 hover:text-slate-900"
            >
              Reset filters
            </button>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Showing <strong className="text-slate-900">{filtered.length}</strong> services
          </p>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <ListFilter className="size-3.5" />
            Continuous API validation
          </div>
        </div>

        {/* Mobile View */}
        <div className="mt-5 grid gap-3 md:hidden">
          {filtered.map((service) => {
            const provider = providerFor(service);
            const checked = selected.some((item) => item.id === service.id);
            return (
              <article key={service.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <ProviderAvatar provider={provider} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-500">
                        {provider.name} · Score {provider.score}
                      </p>
                      <h2 className="mt-1 text-sm font-black text-slate-900">{service.name}</h2>
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(service)}
                    aria-label={`${checked ? "Remove" : "Add"} ${service.name} ${
                      checked ? "from" : "to"
                    } comparison`}
                    className={`grid size-8 shrink-0 place-items-center rounded-lg border transition ${
                      checked ? "border-cyan-500 bg-cyan-500 text-white" : "border-slate-200"
                    }`}
                  >
                    {checked ? <Check className="size-4" /> : <span className="text-lg leading-none">+</span>}
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400">Price / 1K</p>
                    <p className="mt-1 font-black text-slate-950">${service.pricePerThousand.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="flex items-center justify-center gap-1 text-[9px] uppercase font-bold text-slate-400">
                      <Clock3 className="size-3" />
                      Start
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-800">{service.startTime}</p>
                  </div>
                  <div>
                    <p className="flex items-center justify-center gap-1 text-[9px] uppercase font-bold text-slate-400">
                      <ShieldCheck className="size-3" />
                      Refill
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-800 truncate">{service.refill}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Desktop Table View */}
        <div className="mt-5 hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs md:block">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-start">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-start text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="w-12 px-4 py-3.5">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-4 py-3.5 text-start">Service</th>
                  <th className="px-4 py-3.5 text-start">SMM Provider & Tier</th>
                  <th className="px-4 py-3.5 text-start">Price / 1K</th>
                  <th className="px-4 py-3.5 text-start">Delivery & Speed</th>
                  <th className="px-4 py-3.5 text-start">Refill Guarantee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((service) => (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    selected={selected.some((item) => item.id === service.id)}
                    onToggle={toggle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="grid place-items-center px-6 py-20 text-center">
            <Search className="size-8 text-slate-300" />
            <h2 className="mt-4 font-bold text-slate-900">No exact matches found</h2>
            <p className="mt-2 text-xs text-slate-500">Try broadening your keyword or selecting all platforms.</p>
          </div>
        )}
      </section>

      {/* Floating Comparison Dock */}
      {selected.length > 0 && (
        <aside className="compare-dock" aria-label="Comparison selection">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-400 font-black text-[#071321]">
              {selected.length}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="font-bold text-white text-xs">Ready to compare</p>
              <p className="truncate text-xs text-slate-400">{selected.map((item) => item.name).join(" · ")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg p-2 text-slate-400 hover:text-white"
              onClick={() => setSelected([])}
              aria-label="Clear comparison"
            >
              <X className="size-5" />
            </button>
            <Button
              onClick={compare}
              className="rounded-xl bg-cyan-400 font-black text-[#071321] hover:bg-cyan-300 text-xs"
            >
              Compare {selected.length} Services
              <ArrowRight className="size-4 ml-1" />
            </Button>
          </div>
        </aside>
      )}
    </PublicLayout>
  );
}
