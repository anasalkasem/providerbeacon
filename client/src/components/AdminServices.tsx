import { useEffect, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { Loader2, Pencil, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { useAdminText } from "@/i18n/admin";
import { localizeData } from "@/i18n/messages";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import type { AdminServicesInput } from "../../../shared/catalogueQuery";

const selectClass = "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700";

export default function AdminServices() {
  const text = useAdminText();
  const { locale, dir } = useLocale();
  const utils = trpc.useUtils();
  const access = trpc.admin.access.useQuery();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<AdminServicesInput>({ limit: 25, q: "" });
  const [cursors, setCursors] = useState<(number | undefined)[]>([undefined]);
  const [editing, setEditing] = useState<{ id: number; name: string; status: NonNullable<AdminServicesInput["status"]>; price: string; originalPrice: string; originalStatus: NonNullable<AdminServicesInput["status"]> } | null>(null);
  useEffect(() => {
    if (search.trim() === filters.q) return;
    const timer = setTimeout(() => { setFilters(current => ({ ...current, q: search.trim() })); setCursors([undefined]); }, 300);
    return () => clearTimeout(timer);
  }, [search, filters.q]);
  const query = trpc.admin.services.list.useQuery({ ...filters, cursor: cursors.at(-1) }, {
    enabled: Boolean(access.data?.permissions.includes("services.read")), retry: false,
    staleTime: 30_000, gcTime: 120_000, placeholderData: keepPreviousData,
  });
  const mutation = trpc.admin.services.update.useMutation({
    onSuccess: async () => {
      setEditing(null); toast.success(text("serviceUpdated"));
      await Promise.all([utils.admin.services.list.invalidate(), utils.admin.overview.invalidate(), utils.marketplace.snapshot.invalidate(), utils.admin.audit.list.invalidate()]);
    }, onError: error => toast.error(error.message),
  });
  const change = (values: Partial<AdminServicesInput>) => { setFilters(current => ({ ...current, ...values })); setCursors([undefined]); };
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const canWrite = access.data?.permissions.includes("services.write");
  const busy = query.isFetching || search.trim() !== filters.q;
  const rows = query.data?.items ?? [];
  const headers = [text("service"), text("provider"), text("price"), text("quality"), text("publishing"), text("actions")];
  return <section className="space-y-4" aria-label={text("serviceCatalogue")}>
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <label className="min-w-52 flex-1 text-xs font-semibold text-slate-600">{text("searchServices")}<div className="relative mt-2"><Search className="absolute start-3 top-3 size-4 text-slate-400"/><Input className="ps-9" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} placeholder={text("searchServicesHint")}/></div></label>
      <label className="grid gap-2 text-xs font-semibold text-slate-600">{text("status")}<select className={selectClass} value={filters.status ?? ""} onChange={event => change({ status: (event.target.value || undefined) as AdminServicesInput["status"] })}><option value="">{text("allStatuses")}</option>{(["draft", "active", "paused", "archived"] as const).map(status => <option key={status} value={status}>{text(status)}</option>)}</select></label>
      <label className="grid gap-2 text-xs font-semibold text-slate-600">{text("platform")}<select className={selectClass} value={filters.platform ?? ""} onChange={event => change({ platform: event.target.value || undefined })}><option value="">{text("allPlatforms")}</option>{["Instagram", "TikTok", "YouTube", "Facebook", "Telegram", "Twitter"].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="grid gap-2 text-xs font-semibold text-slate-600">{text("rowsPerPage")}<select className={selectClass} value={filters.limit} onChange={event => change({ limit: Number(event.target.value) })}>{[25, 50, 100].map(value => <option key={value} value={value}>{number(value)}</option>)}</select></label>
      <Button variant="outline" disabled={busy} onClick={() => void query.refetch()}><RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`}/>{text("refresh")}</Button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500" role="status" aria-live="polite">
      <p>{text("matchingServices")}: <strong className="text-slate-900">{query.data ? number(query.data.total) : "—"}</strong></p>
      <p>{text("publicationHint")}</p>
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-busy={busy}>
      <div className="max-h-[65vh] overflow-auto"><table className="w-full min-w-[850px] text-start"><thead className="sticky top-0 z-10 bg-slate-50"><tr>{headers.map(header => <th key={header} className="border-b px-4 py-3 text-start text-xs font-semibold text-slate-500">{header}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{query.isError ? <tr><td colSpan={6} className="p-10 text-center text-red-700">{text("loadError")} <Button variant="outline" onClick={() => void query.refetch()}>{text("retry")}</Button></td></tr> : query.isLoading ? <tr><td colSpan={6} className="p-10 text-center"><Loader2 className="mx-auto size-5 animate-spin"/><span>{text("loading")}</span></td></tr> : !rows.length ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">{text("noServices")}</td></tr> : rows.map(service => <tr key={service.id} className="hover:bg-slate-50/70">
          <td className="max-w-sm px-4 py-4"><p dir="auto" className="break-words text-start text-sm font-semibold text-slate-900">{service.name}</p><p className="mt-1 text-xs text-slate-500"><bdi>#{service.externalId ?? service.id}</bdi> · {service.platform} · {service.category}</p></td>
          <td className="px-4 py-4 text-sm text-slate-600"><bdi>{service.providerName}</bdi></td>
          <td className="px-4 py-4 font-semibold"><bdi dir="ltr">${Number(service.pricePerThousandUsd).toFixed(4)}</bdi></td>
          <td className="px-4 py-4 text-sm">{localizeData(locale, service.quality[0].toUpperCase() + service.quality.slice(1))}</td>
          <td className="px-4 py-4"><Badge variant="outline">{text(service.status)}</Badge>{service.status === "active" && service.providerStatus !== "active" && <p className="mt-1 text-xs text-amber-700">{text("providerNotPublished")}</p>}</td>
          <td className="px-4 py-4">{canWrite && <Button variant="outline" size="sm" disabled={busy} onClick={() => setEditing({ id: service.id, name: service.name, status: service.status, price: service.pricePerThousandUsd, originalPrice: service.pricePerThousandUsd, originalStatus: service.status })}><Pencil className="size-3"/>{text("edit")}</Button>}</td>
        </tr>)}</tbody></table></div>
      <nav className="flex flex-wrap items-center justify-between gap-3 border-t p-4" aria-label={text("pagination")}><p className="text-sm text-slate-500">{text("page")} {number(cursors.length)} · {number(rows.length)} {text("services")}</p><div className="flex gap-2"><Button variant="outline" disabled={cursors.length === 1 || busy} onClick={() => setCursors(current => current.slice(0, -1))}>{text("previous")}</Button><Button variant="outline" disabled={query.isError || !query.data?.nextCursor || busy} onClick={() => setCursors(current => [...current, query.data!.nextCursor!])}>{text("next")}</Button></div></nav>
    </div>
    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open && !mutation.isPending) setEditing(null); }}>
      <DialogContent dir={dir}><DialogTitle>{text("editService")}</DialogTitle><DialogDescription dir="auto">{editing?.name}</DialogDescription>{editing && <form className="grid gap-4" onSubmit={event => { event.preventDefault(); const price = Number(editing.price); if (Number.isFinite(price) && price > 0 && price <= 100000 && (editing.status !== editing.originalStatus || price !== Number(editing.originalPrice))) mutation.mutate({ id: editing.id, status: editing.status !== editing.originalStatus ? editing.status : undefined, pricePerThousandUsd: price !== Number(editing.originalPrice) ? price : undefined }); }}>
        <label className="grid gap-2 text-sm">{text("price")}<Input required dir="ltr" type="number" min="0.0001" max="100000" step="0.0001" value={editing.price} onChange={event => setEditing({ ...editing, price: event.target.value })}/></label>
        <label className="grid gap-2 text-sm">{text("status")}<select className={selectClass} value={editing.status} onChange={event => setEditing({ ...editing, status: event.target.value as typeof editing.status })}>{(["draft", "active", "paused", "archived"] as const).map(status => <option value={status} key={status}>{text(status)}</option>)}</select></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setEditing(null)}>{text("cancelEdit")}</Button><Button disabled={mutation.isPending || (editing.status === editing.originalStatus && Number(editing.price) === Number(editing.originalPrice))}>{mutation.isPending && <Loader2 className="size-4 animate-spin"/>}{text("saveChanges")}</Button></div>
      </form>}</DialogContent>
    </Dialog>
  </section>;
}
