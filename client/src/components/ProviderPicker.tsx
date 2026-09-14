import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";

export default function ProviderPicker({ value, onChange, emptyLabel }: { value: string; onChange: (value: string) => void; emptyLabel?: string }) {
  const { locale } = useLocale(); const ar = locale === "ar";
  const [search, setSearch] = useState(""); const [q, setQ] = useState("");
  useEffect(() => { const timer = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const query = trpc.admin.providers.list.useQuery({ q, includeId: Number(value) || undefined, limit: 50 }, { gcTime: 120_000, retry: false });
  const field = "mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm";
  return <div className="space-y-2">
    <label className="block text-sm font-semibold">{ar ? "البحث عن مزود" : "Search for a provider"}<input className={field} value={search} maxLength={100} onChange={e => setSearch(e.target.value)} placeholder={ar ? "اسم المزود" : "Provider name"}/></label>
    <label className="block text-sm font-semibold">{ar ? "المزود" : "Provider"}<select className={field} value={value} onChange={e => onChange(e.target.value)}><option value="">{emptyLabel ?? (ar ? "اختر مزودًا" : "Select a provider")}</option>{query.data?.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
    {query.isError && <p role="alert" className="text-sm text-red-700">{query.error.message}</p>}
    {query.data?.length === 50 && <p className="text-sm text-slate-500">{ar ? "اكتب الاسم للوصول إلى مزود آخر." : "Search by name to find another provider."}</p>}
  </div>;
}
