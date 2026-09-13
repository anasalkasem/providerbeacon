import { PublicLayout } from "@/components/SiteChrome";
import { ProviderAvatar, ServiceRow } from "@/components/Marketplace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { providerFor, services, type Service } from "@/data/marketplace";
import { ArrowRight, Check, Clock3, ListFilter, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function Services() {
  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get("q") ?? "";
  const [, navigate] = useLocation();
  const [query, setQuery] = useState(initialQuery);
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState("recommended");
  const [quality, setQuality] = useState("all");
  const [refillOnly, setRefillOnly] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selected, setSelected] = useState<Service[]>([]);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    const result = services.filter((service) =>
      (platform === "all" || service.platform === platform) &&
      (quality === "all" || service.quality === quality) &&
      (!refillOnly || service.refill !== "No refill") &&
      `${service.platform} ${service.category} ${service.name} ${providerFor(service).name}`.toLowerCase().includes(needle)
    );
    return [...result].sort((a, b) => sort === "price" ? a.pricePerThousand - b.pricePerThousand : sort === "retention" ? b.retention - a.retention : Number(b.featured) - Number(a.featured));
  }, [platform, query, quality, refillOnly, sort]);

  const toggle = (service: Service) => setSelected((current) => current.some((item) => item.id === service.id) ? current.filter((item) => item.id !== service.id) : current.length < 4 ? [...current, service] : current);
  const compare = () => navigate(`/compare?services=${selected.map((service) => service.id).join(",")}`);

  return <PublicLayout>
    <section className="border-b border-slate-200 bg-white"><div className="container py-12"><div className="eyebrow light"><Sparkles className="size-4"/>Provider intelligence marketplace</div><h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">Discover services with evidence, not guesswork.</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">Search verified service data, compare providers side-by-side and see exactly what drives each Beacon Score.</p></div></section>
    <section className="container py-8">
      <div className="filter-bar">
        <label className="relative flex-1"><span className="sr-only">Search service catalogue</span><Search className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by platform, service or category" className="h-12 rounded-xl border-slate-200 ps-11"/></label>
        <Select value={platform} onValueChange={setPlatform}><SelectTrigger className="h-12 w-full rounded-xl border-slate-200 sm:w-[190px]"><SelectValue placeholder="Platform"/></SelectTrigger><SelectContent><SelectItem value="all">All platforms</SelectItem>{["Instagram","TikTok","YouTube","Facebook","Telegram"].map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select>
        <Select value={sort} onValueChange={setSort}><SelectTrigger className="h-12 w-full rounded-xl border-slate-200 sm:w-[190px]"><SelectValue placeholder="Sort"/></SelectTrigger><SelectContent><SelectItem value="recommended">Recommended</SelectItem><SelectItem value="price">Lowest price</SelectItem><SelectItem value="retention">Best retention</SelectItem></SelectContent></Select>
        <Button variant="outline" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(!advancedOpen)} className="h-12 rounded-xl"><SlidersHorizontal className="size-4"/>More filters</Button>
      </div>
      {advancedOpen && <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"><Select value={quality} onValueChange={setQuality}><SelectTrigger className="h-11 w-full rounded-xl sm:w-[220px]"><SelectValue placeholder="Quality"/></SelectTrigger><SelectContent><SelectItem value="all">All quality levels</SelectItem><SelectItem value="Standard">Standard</SelectItem><SelectItem value="Premium">Premium</SelectItem><SelectItem value="Elite">Elite</SelectItem></SelectContent></Select><label className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"><input type="checkbox" checked={refillOnly} onChange={(event) => setRefillOnly(event.target.checked)} className="size-4 accent-cyan-600"/>Refill protection only</label><button onClick={() => {setQuality("all");setRefillOnly(false)}} className="h-11 px-3 text-sm font-semibold text-slate-500 hover:text-slate-900">Reset filters</button></div>}
      <div className="mt-6 flex items-center justify-between gap-4"><p className="text-sm text-slate-500"><strong className="text-slate-900">{filtered.length}</strong> services found</p><div className="flex items-center gap-2 text-xs text-slate-500"><ListFilter className="size-4"/>Updated continuously</div></div>

      <div className="mt-5 grid gap-3 md:hidden">{filtered.map((service) => {const provider=providerFor(service);const checked=selected.some((item)=>item.id===service.id);return <article key={service.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><ProviderAvatar provider={provider}/><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-500">{provider.name} · Score {provider.score}</p><h2 className="mt-1 text-sm font-extrabold text-slate-900">{service.name}</h2></div></div><button onClick={()=>toggle(service)} aria-label={`${checked?"Remove":"Add"} ${service.name} ${checked?"from":"to"} comparison`} className={`grid size-8 shrink-0 place-items-center rounded-lg border ${checked?"border-cyan-500 bg-cyan-500 text-white":"border-slate-200"}`}>{checked?<Check className="size-4"/>:<span className="text-lg leading-none">+</span>}</button></div><div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3"><div><p className="text-[9px] uppercase text-slate-400">Price / 1K</p><p className="mt-1 font-extrabold">${service.pricePerThousand.toFixed(2)}</p></div><div><p className="flex items-center gap-1 text-[9px] uppercase text-slate-400"><Clock3 className="size-3"/>Start</p><p className="mt-1 text-xs font-bold">{service.startTime}</p></div><div><p className="flex items-center gap-1 text-[9px] uppercase text-slate-400"><ShieldCheck className="size-3"/>Refill</p><p className="mt-1 text-xs font-bold">{service.refill}</p></div></div></article>})}</div>
      <div className="mt-5 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block"><div className="overflow-x-auto"><table className="w-full border-collapse text-start"><thead><tr className="border-b border-slate-200 bg-slate-50 text-start text-[11px] uppercase tracking-wider text-slate-500"><th className="w-12 px-4 py-3"><span className="sr-only">Select</span></th><th className="px-4 py-3 text-start">Service</th><th className="px-4 py-3 text-start">Provider</th><th className="px-4 py-3 text-start">Price</th><th className="px-4 py-3 text-start">Delivery</th><th className="px-4 py-3 text-start">Protection</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((service) => <ServiceRow key={service.id} service={service} selected={selected.some((item) => item.id === service.id)} onToggle={toggle}/>)}</tbody></table></div></div>
      {filtered.length === 0 && <div className="grid place-items-center px-6 py-20 text-center"><Search className="size-8 text-slate-300"/><h2 className="mt-4 font-bold text-slate-900">No exact matches yet</h2><p className="mt-2 text-sm text-slate-500">Try another platform or broader keyword.</p></div>}
    </section>
    {selected.length > 0 && <aside className="compare-dock" aria-label="Comparison selection"><div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-400 font-extrabold text-[#071321]">{selected.length}</div><div className="hidden min-w-0 sm:block"><p className="font-bold text-white">Ready to compare</p><p className="truncate text-xs text-slate-400">{selected.map((item) => item.name).join(" · ")}</p></div></div><div className="flex items-center gap-2"><button className="rounded-lg p-2 text-slate-400 hover:text-white" onClick={() => setSelected([])} aria-label="Clear comparison"><X className="size-5"/></button><Button onClick={compare} className="rounded-xl bg-cyan-400 font-bold text-[#071321] hover:bg-cyan-300">Compare {selected.length}<ArrowRight className="size-4"/></Button></div></aside>}
  </PublicLayout>;
}
