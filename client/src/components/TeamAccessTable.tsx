import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminText, type AdminTextKey } from "@/i18n/admin";
import { trpc } from "@/lib/trpc";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type TeamRole = "administrator" | "operations_manager" | "provider_reviewer" | "catalogue_editor" | "translation_manager" | "auditor";
const roleKeys: Record<string, AdminTextKey> = { owner: "owner", administrator: "administrator", operations_manager: "operationsManager", provider_reviewer: "providerReviewer", catalogue_editor: "catalogueEditor", translation_manager: "translationManager", auditor: "auditor" };

export default function TeamAccessTable() {
  const text = useAdminText();
  const utils = trpc.useUtils();
  const access = trpc.admin.access.useQuery();
  const team = trpc.admin.team.list.useQuery(undefined, { retry: false });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("provider_reviewer");
  const invite = trpc.admin.team.invite.useMutation({ onSuccess: async () => { toast.success(text("invitationRecorded")); setEmail(""); await utils.admin.team.list.invalidate(); }, onError: error => toast.error(error.message) });
  const status = trpc.admin.team.setStatus.useMutation({ onSuccess: async () => { toast.success(text("memberUpdated")); await Promise.all([utils.admin.team.list.invalidate(), utils.admin.audit.list.invalidate()]); }, onError: error => toast.error(error.message) });
  const canWrite = access.data?.permissions.includes("team.write");

  return <div className="space-y-5">
    {canWrite && <form className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5" onSubmit={event => { event.preventDefault(); invite.mutate({ email, role }); }}>
      <div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-xl bg-white text-blue-700"><ShieldCheck className="size-5"/></div><div><h2 className="font-extrabold text-slate-950">{text("inviteTitle")}</h2><p className="mt-1 text-sm text-slate-500">{text("inviteBody")}</p></div></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2"><Input dir="ltr" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="team.member@example.com" required/><Select value={role} onValueChange={value => setRole(value as TeamRole)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(roleKeys).filter(([value]) => value !== "owner").map(([value,key]) => <SelectItem key={value} value={value}>{text(key)}</SelectItem>)}</SelectContent></Select><Button className="md:col-span-2" disabled={invite.isPending}>{invite.isPending && <Loader2 className="size-4 animate-spin"/>}{text("inviteMember")}</Button></div>
      {invite.data && <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3"><p className="mb-2 text-xs font-bold text-emerald-800">{text("inviteLink")}</p><div className="flex gap-2"><Input dir="ltr" readOnly value={`${window.location.origin}/team/accept?token=${invite.data.token}`}/><Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/team/accept?token=${invite.data.token}`)}>{text("copyLink")}</Button></div></div>}
    </form>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px]"><thead><tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400"><th className="px-5 py-3 text-start">{text("member")}</th><th className="px-5 py-3 text-start">{text("role")}</th><th className="px-5 py-3 text-start">{text("accessStatus")}</th><th className="px-5 py-3 text-start">{text("added")}</th><th className="px-5 py-3 text-start">{text("actions")}</th></tr></thead><tbody className="divide-y divide-slate-100">
      {team.isLoading ? <tr><td colSpan={5} className="px-5 py-14 text-center"><Loader2 className="mx-auto size-5 animate-spin"/></td></tr> : team.isError ? <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-500">{text("noTeamPermission")}</td></tr> : team.data?.length ? team.data.map(member => <tr key={member.id}><td dir="ltr" className="px-5 py-4 text-start font-bold text-slate-900">{member.email}</td><td className="px-5 py-4 text-sm text-slate-600">{text(roleKeys[member.role])}</td><td className="px-5 py-4"><Badge className={member.status === "active" ? "bg-emerald-50 text-emerald-700" : member.status === "suspended" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}>{member.status === "active" ? text("active") : member.status === "suspended" ? text("suspended") : member.status}</Badge></td><td className="px-5 py-4 text-sm text-slate-500">{new Date(member.createdAt).toLocaleString()}</td><td className="px-5 py-4">{canWrite && member.role !== "owner" && member.status !== "invited" && <Button size="sm" variant="outline" className={member.status === "active" ? "border-red-200 text-red-700" : "border-emerald-200 text-emerald-700"} disabled={status.isPending} onClick={() => { const next = member.status === "active" ? "suspended" : "active"; if (next === "active" || window.confirm(text("suspendMemberConfirm"))) status.mutate({ id: member.id, status: next }); }}>{status.isPending && status.variables?.id === member.id && <Loader2 className="size-3 animate-spin"/>}{member.status === "active" ? text("suspendMember") : text("reactivateMember")}</Button>}</td></tr>) : <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-500">{text("noInvites")}</td></tr>}
    </tbody></table></div></div>
  </div>;
}
