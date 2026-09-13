import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAdminText } from "@/i18n/admin";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clock3, KeyRound, Loader2, Pencil, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function Step({ number, title, body }: { number: number; title: string; body: string }) {
  return <div className="flex gap-3 rounded-2xl border border-cyan-100 bg-white p-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-cyan-700 text-sm font-black text-white">{number}</span><div><p className="font-extrabold text-slate-950">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{body}</p></div></div>;
}

function formatInterval(minutes: number, text: ReturnType<typeof useAdminText>) {
  if (minutes === 60) return text("everyHour");
  if (minutes === 360) return text("every6Hours");
  if (minutes === 720) return text("every12Hours");
  if (minutes === 1440) return text("everyDay");
  if (minutes === 10080) return text("everyWeek");
  return `${minutes} min`;
}

export default function ProviderIntegrationVault() {
  const text = useAdminText();
  const utils = trpc.useUtils();
  const access = trpc.admin.access.useQuery();
  const providers = trpc.admin.providers.list.useQuery(undefined, { retry: false });
  const integrations = trpc.admin.integrations.list.useQuery(undefined, { retry: false });
  const [id, setId] = useState<number | undefined>();
  const [providerId, setProviderId] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [interval, setInterval] = useState("360");
  const [enabled, setEnabled] = useState(false);
  const canWrite = access.data?.permissions.includes("integrations.write");

  const reset = () => { setId(undefined); setProviderId(""); setName(""); setBaseUrl(""); setApiKey(""); setInterval("360"); setEnabled(false); };
  const refresh = () => Promise.all([utils.admin.integrations.list.invalidate(), utils.admin.audit.list.invalidate()]);
  const save = trpc.admin.integrations.save.useMutation({ onSuccess: async () => { toast.success(text(id ? "integrationUpdated" : "integrationSaved")); reset(); await refresh(); }, onError: error => toast.error(error.message) });
  const sync = trpc.admin.integrations.syncNow.useMutation({ onSuccess: async data => { toast.success(`${text("importedServices")}: ${"importedCount" in data ? data.importedCount : 0}`); await Promise.all([refresh(), utils.admin.services.list.invalidate(), utils.marketplace.snapshot.invalidate()]); }, onError: error => toast.error(error.message) });
  const toggle = trpc.admin.integrations.setEnabled.useMutation({ onSuccess: refresh, onError: error => toast.error(error.message) });
  const remove = trpc.admin.integrations.remove.useMutation({ onSuccess: async () => { toast.success(text("integrationDeleted")); await refresh(); }, onError: error => toast.error(error.message) });
  const handleSaveAndTest = () => save.mutate({ id, providerId: Number(providerId), name, baseUrl, apiKey: apiKey || undefined, syncIntervalMinutes: Number(interval), enabled: false }, { onSuccess: saved => sync.mutate({ id: saved.id }) });

  return <div className="space-y-6">
    {canWrite && <section className="rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-white text-cyan-700 shadow-sm"><KeyRound className="size-5"/></div><div><h2 className="text-lg font-extrabold text-slate-950">{text("connectProvider")}</h2><p className="mt-1 text-sm text-slate-600">{text("connectProviderBody")}</p></div></div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3"><Step number={1} title={text("stepProvider")} body={text("stepProviderBody")}/><Step number={2} title={text("stepCredential")} body={text("stepCredentialBody")}/><Step number={3} title={text("stepVerify")} body={text("stepVerifyBody")}/></div>
      <form className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 md:grid-cols-2" onSubmit={event => { event.preventDefault(); save.mutate({ id, providerId: Number(providerId), name, baseUrl, apiKey: apiKey || undefined, syncIntervalMinutes: Number(interval), enabled }); }}>
        <label className="grid gap-2 text-sm font-bold text-slate-700"><span>{text("provider")}</span><Select value={providerId} onValueChange={setProviderId}><SelectTrigger><SelectValue placeholder={text("selectProvider")}/></SelectTrigger><SelectContent>{providers.data?.map(provider => <SelectItem key={provider.id} value={String(provider.id)}>{provider.name}</SelectItem>)}</SelectContent></Select></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700"><span>{text("integrationName")}</span><Input value={name} onChange={event => setName(event.target.value)} placeholder={text("integrationNameExample")} required/></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700 md:col-span-2"><span>{text("providerApiUrl")}</span><Input dir="ltr" type="url" value={baseUrl} onChange={event => setBaseUrl(event.target.value)} placeholder="https://provider.example/api/v2" required/><small className="font-normal text-slate-500">{text("endpointHelp")}</small></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700"><span>{text("apiKey")}</span><Input dir="ltr" type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={text("apiKeyPlaceholder")} required={!id}/><small className="font-normal text-slate-500">{id ? text("keyOptional") : text("keyEncryptedHelp")}</small></label>
        <label className="grid gap-2 text-sm font-bold text-slate-700"><span>{text("syncInterval")}</span><Select value={interval} onValueChange={setInterval}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="60">{text("everyHour")}</SelectItem><SelectItem value="360">{text("every6Hours")}</SelectItem><SelectItem value="720">{text("every12Hours")}</SelectItem><SelectItem value="1440">{text("everyDay")}</SelectItem><SelectItem value="10080">{text("everyWeek")}</SelectItem></SelectContent></Select></label>
        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 md:col-span-2"><span><span className="block">{text("scheduledSync")}</span><small className="font-normal text-slate-500">{text("enableAfterTest")}</small></span><Switch checked={enabled} onCheckedChange={setEnabled}/></label>
        <div className="md:col-span-2"><div className="flex flex-wrap gap-2"><Button type="button" className="min-w-44" disabled={save.isPending || sync.isPending || !providerId || !name.trim() || !baseUrl.trim() || (!id && !apiKey)} onClick={handleSaveAndTest}>{(save.isPending || sync.isPending) && <Loader2 className="size-4 animate-spin"/>}{text("saveAndTest")}</Button><Button type="submit" variant="outline" className="min-w-40" disabled={save.isPending || !providerId}>{id ? text("updateIntegration") : text("saveCredential")}</Button>{id && <Button type="button" variant="ghost" onClick={reset}>{text("cancelEdit")}</Button>}</div>{!providerId && <p className="mt-2 text-xs font-semibold text-amber-700">{text("selectProviderFirst")}</p>}</div>
      </form>
    </section>}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-extrabold text-slate-950">{text("connectedProviders")}</h2><p className="mt-1 text-xs text-slate-500">{text("connectedProvidersBody")}</p></div>
      <div className="grid gap-3 p-4 md:hidden">{integrations.isLoading ? <Loader2 className="mx-auto my-8 size-5 animate-spin"/> : integrations.data?.length ? integrations.data.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-slate-950">{item.name}</h3><p className="mt-1 text-sm text-slate-600">{item.providerName}</p></div><Badge className={item.status === "active" ? "bg-emerald-50 text-emerald-700" : item.status === "error" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}>{item.status === "active" ? text("enabled") : item.status === "error" ? text("syncError") : text("disabled")}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><span className="text-slate-400">{text("credential")}</span><p className="mt-1 font-bold text-emerald-700">{item.credentialHint ?? text("credentialHint")}</p></div><div><span className="text-slate-400">{text("schedule")}</span><p className="mt-1 font-bold text-slate-700">{formatInterval(item.syncIntervalMinutes, text)}</p></div><div className="col-span-2"><span className="text-slate-400">{text("lastSync")}</span><p className="mt-1 font-bold text-slate-700">{item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString() : text("never")}</p></div></div>{canWrite && <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => sync.mutate({ id: item.id })} disabled={sync.isPending}><RefreshCw className="size-3"/>{text("syncNow")}</Button><Button size="sm" variant="ghost" onClick={() => { setId(item.id); setProviderId(String(item.providerId)); setName(item.name); setBaseUrl(item.baseUrl); setApiKey(""); setInterval(String(item.syncIntervalMinutes)); setEnabled(item.status === "active"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil className="size-3"/>{text("edit")}</Button><Button size="sm" variant="ghost" className="text-red-700" disabled={item.status === "active" || remove.isPending} onClick={() => { if (window.confirm(text("deleteIntegrationConfirm"))) remove.mutate({ id: item.id }); }}><Trash2 className="size-3"/>{text("delete")}</Button></div>}</article>) : <p className="py-8 text-center text-sm text-slate-500">{text("noIntegrations")}</p>}</div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1180px]"><thead><tr className="border-b border-slate-200 bg-slate-50 text-start text-[10px] uppercase tracking-wider text-slate-400"><th className="px-4 py-3 text-start">{text("integrationName")}</th><th className="px-4 py-3 text-start">{text("provider")}</th><th className="px-4 py-3 text-start">{text("credential")}</th><th className="px-4 py-3 text-start">{text("accessStatus")}</th><th className="px-4 py-3 text-start">{text("schedule")}</th><th className="px-4 py-3 text-start">{text("activity")}</th><th className="px-4 py-3 text-start">{text("actions")}</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{integrations.isLoading ? <tr><td colSpan={7} className="px-5 py-14 text-center"><Loader2 className="mx-auto size-5 animate-spin"/></td></tr> : integrations.data?.length ? integrations.data.map(item => <tr key={item.id} className="align-top">
        <td className="px-4 py-4"><div className="font-bold text-slate-950">{item.name}</div><div dir="ltr" className="mt-1 max-w-64 truncate text-xs text-slate-400">{item.baseUrl}</div></td>
        <td className="px-4 py-4 text-sm font-semibold text-slate-700">{item.providerName}</td>
        <td className="px-4 py-4"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck className="size-4"/>{item.credentialHint ?? text("credentialHint")}</div><p className="mt-1 text-xs text-slate-400">AES-256-GCM</p></td>
        <td className="px-4 py-4"><div className="flex items-center gap-2"><Switch checked={item.status === "active"} disabled={!canWrite || toggle.isPending} onCheckedChange={value => toggle.mutate({ id: item.id, enabled: value })}/><Badge className={item.status === "active" ? "bg-emerald-50 text-emerald-700" : item.status === "error" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}>{item.status === "active" ? text("enabled") : item.status === "error" ? text("syncError") : text("disabled")}</Badge></div></td>
        <td className="px-4 py-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Clock3 className="size-4 text-blue-600"/>{formatInterval(item.syncIntervalMinutes, text)}</div><p className="mt-1 text-xs text-slate-400">{text("nextSync")}: {item.nextSyncAt ? new Date(item.nextSyncAt).toLocaleString() : text("never")}</p></td>
        <td className="px-4 py-4"><p className="text-sm text-slate-600">{item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString() : text("never")}</p><p className="mt-1 text-xs text-slate-400">{text("failures")}: {item.consecutiveFailures}</p>{item.lastError && <p className="mt-2 max-w-64 text-xs text-red-600">{item.lastError}</p>}</td>
        <td className="px-4 py-4">{canWrite && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => sync.mutate({ id: item.id })} disabled={sync.isPending}><RefreshCw className={`size-3 ${sync.isPending && sync.variables?.id === item.id ? "animate-spin" : ""}`}/>{text("syncNow")}</Button><Button size="sm" variant="ghost" onClick={() => { setId(item.id); setProviderId(String(item.providerId)); setName(item.name); setBaseUrl(item.baseUrl); setApiKey(""); setInterval(String(item.syncIntervalMinutes)); setEnabled(item.status === "active"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil className="size-3"/>{text("edit")}</Button><Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800" disabled={item.status === "active" || remove.isPending} onClick={() => { if (window.confirm(text("deleteIntegrationConfirm"))) remove.mutate({ id: item.id }); }}><Trash2 className="size-3"/>{text("delete")}</Button></div>}</td>
      </tr>) : <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-500"><CheckCircle2 className="mx-auto mb-2 size-6 text-cyan-600"/>{text("noIntegrations")}</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
