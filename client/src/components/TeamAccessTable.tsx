import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminText, type AdminTextKey } from "@/i18n/admin";
import { teamError, teamWords } from "@/i18n/team";
import { useLocale, type Locale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { assignableTeamRoles } from "@shared/team";
import { Loader2, Mail, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type TeamRole = (typeof assignableTeamRoles)[number];
const roleKeys: Record<string, AdminTextKey> = {
  owner: "owner",
  administrator: "administrator",
  operations_manager: "operationsManager",
  provider_reviewer: "providerReviewer",
  catalogue_editor: "catalogueEditor",
  translation_manager: "translationManager",
  auditor: "auditor",
};
const languages: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
  es: "Español",
  hi: "हिन्दी",
  zh: "中文",
};
const selectClass =
  "h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800";
type Member = {
  id: number;
  userId: number | null;
  email: string;
  role: string;
  status: string;
  revision: number;
  invitationLocale: string;
};

export function TeamMemberActions({
  member,
  canWrite,
  selfId,
  busy,
  locale,
  onEdit,
  onRemove,
  onResend,
  onStatus,
}: {
  member: Member;
  canWrite: boolean;
  selfId?: number;
  busy: boolean;
  locale: Locale;
  onEdit: () => void;
  onRemove: () => void;
  onResend: () => void;
  onStatus: () => void;
}) {
  const w = teamWords[locale];
  const text = useAdminText();
  if (member.role === "owner")
    return <span className="text-xs text-slate-500">{w.protected}</span>;
  if (!canWrite) return null;
  if (member.userId === selfId)
    return <span className="text-xs text-slate-500">{w.self}</span>;
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={onEdit}>
        <Pencil className="size-3.5" />
        {w.edit}
      </Button>
      {member.status === "invited" ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={onResend}>
          <Mail className="size-3.5" />
          {w.resend}
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={busy} onClick={onStatus}>
          {member.status === "active"
            ? text("suspendMember")
            : text("reactivateMember")}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        className="border-red-200 text-red-700"
        disabled={busy}
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
        {member.status === "invited" ? w.cancelInvite : w.remove}
      </Button>
    </div>
  );
}
export default function TeamAccessTable() {
  const text = useAdminText(),
    { locale } = useLocale(),
    w = teamWords[locale];
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const access = trpc.admin.access.useQuery();
  const team = trpc.admin.team.list.useQuery(undefined, {
    retry: false,
    refetchInterval: 10000,
  });
  const canWrite = Boolean(access.data?.permissions.includes("team.write"));
  const config = trpc.admin.team.mailStatus.useQuery(undefined, {
    enabled: canWrite,
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("provider_reviewer");
  const [language, setLanguage] = useState<Locale>(locale);
  const [dialog, setDialog] = useState<{
    kind: "role" | "remove";
    member: Member;
  } | null>(null);
  const [editRole, setEditRole] = useState<TeamRole>("provider_reviewer");
  const [link, setLink] = useState<{ id: number; inviteUrl: string } | null>(
    null
  );
  const refresh = async () => {
    await Promise.all([
      utils.admin.team.list.invalidate(),
      utils.admin.audit.list.invalidate(),
    ]);
  };
  const onError = (error: { message: string }) => {
    toast.error(teamError(locale, error.message));
    void utils.admin.team.list.invalidate();
  };
  const sent = async (result: { id: number; inviteUrl: string }) => {
    setLink(result);
    toast.success(w.queued);
    await refresh();
  };
  const invite = trpc.admin.team.invite.useMutation({
    onSuccess: async result => {
      setEmail("");
      await sent(result);
    },
    onError,
  });
  const resend = trpc.admin.team.resend.useMutation({
    onSuccess: sent,
    onError,
  });
  const status = trpc.admin.team.setStatus.useMutation({
    onSuccess: async () => {
      toast.success(text("memberUpdated"));
      await refresh();
    },
    onError,
  });
  const changeRole = trpc.admin.team.setRole.useMutation({
    onSuccess: async () => {
      setDialog(null);
      toast.success(w.changed);
      await refresh();
    },
    onError,
  });
  const remove = trpc.admin.team.remove.useMutation({
    onSuccess: async () => {
      setDialog(null);
      setLink(null);
      toast.success(w.removed);
      await refresh();
    },
    onError,
  });
  const busy =
    invite.isPending ||
    resend.isPending ||
    status.isPending ||
    changeRole.isPending ||
    remove.isPending;
  const roleSelect = (value: TeamRole, onChange: (value: TeamRole) => void) => (
    <select
      className={selectClass}
      value={value}
      onChange={event => onChange(event.target.value as TeamRole)}
      aria-label={text("role")}
    >
      {assignableTeamRoles.map(value => (
        <option key={value} value={value}>
          {text(roleKeys[value])}
        </option>
      ))}
    </select>
  );
  return (
    <div className="space-y-5">
      {canWrite && (
        <form
          className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5"
          onSubmit={event => {
            event.preventDefault();
            setLink(null);
            invite.mutate({ email, role, locale: language });
          }}
        >
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-blue-700">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-950">
                {text("inviteTitle")}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{w.inviteBody}</p>
            </div>
          </div>
          {config.data && !config.data.enabled && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-amber-100 p-3 text-sm text-amber-900"
            >
              {w.disabled}
            </p>
          )}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="grid content-start gap-2 text-sm font-semibold">
              {text("member")}
              <Input
                dir="ltr"
                type="email"
                maxLength={320}
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="team.member@example.com"
                required
              />
            </label>
            <label className="grid content-start gap-2 text-sm font-semibold">
              {text("role")}
              {roleSelect(role, setRole)}
            </label>
            <label className="grid content-start gap-2 text-sm font-semibold">
              {w.language}
              <select
                className={selectClass}
                value={language}
                onChange={event => setLanguage(event.target.value as Locale)}
              >
                {Object.entries(languages).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {w.roleHints[role]}
          </p>
          <Button
            className="mt-4"
            disabled={busy || config.data?.enabled === false}
          >
            {invite.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mail className="size-4" />
            )}
            {text("inviteMember")}
          </Button>
        </form>
      )}
      {link && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <label
            className="text-sm font-bold text-emerald-900"
            htmlFor="team-invitation-link"
          >
            {text("inviteLink")}
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              id="team-invitation-link"
              dir="ltr"
              readOnly
              value={link.inviteUrl}
            />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.inviteUrl);
                  toast.success(w.copied);
                } catch {
                  toast.error(w.copyFailed);
                }
              }}
            >
              {text("copyLink")}
            </Button>
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                {[
                  text("member"),
                  text("role"),
                  text("accessStatus"),
                  text("added"),
                  text("actions"),
                ].map(label => (
                  <th key={label} className="px-5 py-3 text-start">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {team.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </td>
                </tr>
              ) : team.isError ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-14 text-center text-sm text-red-700"
                    role="alert"
                  >
                    {text("noTeamPermission")}
                  </td>
                </tr>
              ) : team.data?.length ? (
                team.data.map(member => {
                  const expired =
                    member.status === "invited" &&
                    member.invitationExpiresAt &&
                    new Date(member.invitationExpiresAt).getTime() <=
                      Date.now();
                  const mailStatus =
                    member.mailStatus &&
                    w.mail[member.mailStatus as keyof typeof w.mail];
                  const mailFailure = [
                    "failed",
                    "bounced",
                    "complained",
                    "suppressed",
                  ].includes(member.mailStatus ?? "");
                  return (
                    <tr key={member.id}>
                      <td className="px-5 py-5">
                        <p
                          dir="ltr"
                          className="break-all font-bold text-slate-900"
                        >
                          {member.email}
                        </p>
                        {member.status === "invited" && (
                          <div className="mt-2 max-w-xs space-y-1 text-xs leading-5">
                            <p
                              className={
                                mailFailure
                                  ? "font-semibold text-red-700"
                                  : "text-slate-600"
                              }
                            >
                              {w.delivery}: {mailStatus || w.notSent}
                            </p>
                            {member.invitationExpiresAt && (
                              <p className="text-slate-500">
                                {w.expires}:{" "}
                                {new Date(
                                  member.invitationExpiresAt
                                ).toLocaleString(locale)}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-5 text-sm text-slate-700">
                        {text(roleKeys[member.role])}
                      </td>
                      <td className="px-5 py-5">
                        <Badge
                          className={
                            member.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : member.status === "suspended" || expired
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-800"
                          }
                        >
                          {member.status === "active"
                            ? text("active")
                            : member.status === "suspended"
                              ? text("suspended")
                              : expired
                                ? w.expired
                                : w.pending}
                        </Badge>
                      </td>
                      <td className="px-5 py-5 text-xs text-slate-500">
                        {new Date(member.createdAt).toLocaleDateString(locale)}
                      </td>
                      <td className="min-w-56 px-5 py-5">
                        <TeamMemberActions
                          member={member}
                          canWrite={canWrite}
                          selfId={user?.id}
                          locale={locale}
                          busy={busy}
                          onEdit={() => {
                            setEditRole(member.role as TeamRole);
                            setDialog({ kind: "role", member });
                          }}
                          onRemove={() => setDialog({ kind: "remove", member })}
                          onResend={() =>
                            resend.mutate({
                              id: member.id,
                              revision: member.revision,
                              locale:
                                member.invitationLocale in languages
                                  ? (member.invitationLocale as Locale)
                                  : language,
                            })
                          }
                          onStatus={() => {
                            const next =
                              member.status === "active"
                                ? "suspended"
                                : "active";
                            if (
                              next === "active" ||
                              window.confirm(text("suspendMemberConfirm"))
                            )
                              status.mutate({
                                id: member.id,
                                revision: member.revision,
                                status: next,
                              });
                          }}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-14 text-center text-sm text-slate-500"
                  >
                    {text("noInvites")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog
        open={Boolean(dialog)}
        onOpenChange={open => {
          if (!open && !busy) setDialog(null);
        }}
      >
        <DialogContent dir={locale === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === "role"
                ? w.edit
                : dialog?.member.status === "invited"
                  ? w.cancelInvite
                  : w.remove}
            </DialogTitle>
            <DialogDescription>
              {dialog?.kind === "role"
                ? w.editBody
                : dialog?.member.status === "invited"
                  ? w.deleteInviteBody
                  : w.removeBody}
            </DialogDescription>
          </DialogHeader>
          {dialog && (
            <>
              <p dir="ltr" className="break-all font-semibold">
                {dialog.member.email}
              </p>
              {dialog.kind === "role" && (
                <>
                  {roleSelect(editRole, setEditRole)}
                  <p className="text-sm leading-6 text-slate-600">
                    {w.roleHints[editRole]}
                  </p>
                </>
              )}
              <div className="flex gap-2">
                <Button
                  variant={dialog.kind === "remove" ? "destructive" : "default"}
                  disabled={
                    busy ||
                    (dialog.kind === "role" && editRole === dialog.member.role)
                  }
                  onClick={() => {
                    const input = {
                      id: dialog.member.id,
                      revision: dialog.member.revision,
                    };
                    if (dialog.kind === "role")
                      changeRole.mutate({ ...input, role: editRole });
                    else remove.mutate(input);
                  }}
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {dialog.kind === "role"
                    ? w.save
                    : dialog.member.status === "invited"
                      ? w.cancelInvite
                      : w.remove}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setDialog(null)}
                >
                  {w.cancel}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
