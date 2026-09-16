import { GroupSourceDetails } from "@/components/LinkAutofill";
import { useEffect, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { Link } from "wouter";
import { toast } from "sonner";
import { groupStatuses } from "@shared/community";
import { useLocale } from "@/contexts/LocaleContext";
import { communityCopy, communityError } from "@/i18n/community";
import { CommunityKindBadge } from "@/components/CommunityKindBadge";
import { useAdminText } from "@/i18n/admin";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import {
  GroupField,
  GroupForm,
  GroupPagination,
  fieldClass,
  primaryClass,
  secondaryClass,
} from "@/components/CommunityUi";

type AdminGroup =
  inferRouterOutputs<AppRouter>["admin"]["groups"]["list"]["items"][number];
export default function AdminGroups() {
  return (
    <DashboardLayout>
      <GroupModeration />
    </DashboardLayout>
  );
}
function GroupModeration() {
  const adminText = useAdminText();
  const { locale } = useLocale();
  const t = communityCopy[locale];
  const utils = trpc.useUtils();
  const access = trpc.admin.access.useQuery();
  const canReview = Boolean(access.data?.permissions.includes("groups.review"));
  const [status, setStatus] = useState<AdminGroup["status"] | "">("pending");
  const [reportsOnly, setReportsOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [cursors, setCursors] = useState<(number | undefined)[]>([undefined]);
  const [selected, setSelected] = useState<AdminGroup | "new" | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setCursors([undefined]);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = trpc.admin.groups.list.useQuery(
    { status: status || undefined, reportsOnly, cursor: cursors.at(-1), q },
    {
      enabled: Boolean(access.data?.permissions.includes("groups.read")),
      retry: false,
    }
  );
  const refresh = async () => {
    setSelected(null);
    setEditing(false);
    await Promise.all([
      utils.admin.groups.invalidate(),
      utils.community.invalidate(),
    ]);
  };
  const create = trpc.admin.groups.create.useMutation({
    onSuccess: async () => {
      toast.success(t.sent);
      setStatus("pending");
      setReportsOnly(false);
      setSearch("");
      setQ("");
      setCursors([undefined]);
      await refresh();
    },
  });
  const edit = trpc.admin.groups.edit.useMutation({
    onSuccess: async () => {
      toast.success(t.sent);
      await refresh();
    },
  });
  const select = (row: AdminGroup | "new") => {
    setSelected(row);
    setEditing(false);
    create.reset();
    edit.reset();
  };
  if (access.isLoading)
    return (
      <p role="status" className="p-6">
        {t.loading}
      </p>
    );
  if (!access.data?.permissions.includes("groups.read"))
    return (
      <p role="alert" className="p-6">
        {adminText("accessRestricted")}
      </p>
    );
  return (
    <section className="mx-auto max-w-[1450px] p-2 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold">{t.admin}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            {t.adminIntro}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/groups" className={secondaryClass}>
            {t.directory}
          </Link>
          {canReview && (
            <button className={primaryClass} onClick={() => select("new")}>
              {t.add}
            </button>
          )}
        </div>
      </header>
      <div className="my-6 grid gap-4 md:grid-cols-3">
        <GroupField label={t.search}>
          <input
            type="search"
            className={fieldClass}
            maxLength={100}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </GroupField>
        <GroupField label={t.review}>
          <select
            className={fieldClass}
            value={status}
            onChange={e => {
              setStatus(e.target.value as typeof status);
              setCursors([undefined]);
            }}
          >
            <option value="">{t.all}</option>
            {groupStatuses.map(v => (
              <option key={v} value={v}>
                {t.statuses[v]}
              </option>
            ))}
          </select>
        </GroupField>
        <label className="flex items-center gap-3 self-end py-3 text-sm">
          <input
            type="checkbox"
            checked={reportsOnly}
            onChange={e => {
              setReportsOnly(e.target.checked);
              setStatus("");
              setCursors([undefined]);
            }}
          />
          {t.reportsOnly}
        </label>
      </div>
      <div
        className={`grid items-start gap-6 ${selected ? "xl:grid-cols-2" : ""}`}
      >
        <div className="grid gap-3">
          {query.isLoading ? (
            <p role="status">{t.loading}</p>
          ) : query.isError ? (
            <p role="alert" className="text-red-700">
              {t.error}
              <button
                className={`${secondaryClass} ms-3`}
                onClick={() => query.refetch()}
              >
                {t.retry}
              </button>
            </p>
          ) : !query.data?.items.length ? (
            <p className="rounded-2xl border bg-white p-8 text-slate-500">
              {t.noQueue}
            </p>
          ) : (
            query.data.items.map(group => (
              <button
                key={group.id}
                onClick={() => select(group)}
                className={`rounded-2xl border bg-white p-5 text-start ${selected !== "new" && selected?.id === group.id ? "border-beacon-500 ring-2 ring-beacon-50" : "border-slate-200"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    dir="auto"
                    className="break-words text-lg font-bold text-ink"
                  >
                    {group.name}
                  </span>
                  <span className="text-xs font-semibold text-beacon-700">
                    {t.statuses[group.status]}
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  <CommunityKindBadge
                    url={group.url}
                    data={group.linkMetadata}
                  />{" "}
                  {t.platforms[group.platform]} · {t.topics[group.topic]} ·{" "}
                  {t.languages[group.language]}
                </p>
                {group.openReports > 0 && (
                  <p className="mt-3 text-sm font-bold text-amber-800">
                    {t.reports}: {group.openReports}
                  </p>
                )}
              </button>
            ))
          )}
          <GroupPagination
            previous={
              cursors.length > 1
                ? () => setCursors(v => v.slice(0, -1))
                : undefined
            }
            next={
              query.data?.nextCursor
                ? () => setCursors(v => [...v, query.data!.nextCursor])
                : undefined
            }
          />
        </div>
        {selected && (
          <div className="xl:sticky xl:top-4">
            {(selected === "new" || editing) && canReview ? (
              <GroupForm
                admin
                key={
                  selected === "new"
                    ? "new"
                    : `${selected.id}:${selected.revision}`
                }
                initial={
                  selected === "new"
                    ? undefined
                    : { ...selected, evidenceUrl: selected.evidenceUrl ?? "" }
                }
                onSave={values =>
                  selected === "new"
                    ? create.mutate(values)
                    : edit.mutate({
                        ...values,
                        id: selected.id,
                        revision: selected.revision,
                      })
                }
                onCancel={() => {
                  setSelected(null);
                  setEditing(false);
                }}
                pending={create.isPending || edit.isPending}
                error={
                  (selected === "new" ? create.error : edit.error)?.message
                }
              />
            ) : (
              selected !== "new" && (
                <ReviewPanel
                  key={`${selected.id}:${selected.revision}`}
                  group={selected}
                  canReview={canReview}
                  onEdit={() => {
                    edit.reset();
                    setEditing(true);
                  }}
                  refresh={refresh}
                />
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}
function ReviewPanel({
  group,
  canReview,
  onEdit,
  refresh,
}: {
  group: AdminGroup;
  canReview: boolean;
  onEdit: () => void;
  refresh: () => Promise<void>;
}) {
  const { locale } = useLocale();
  const t = communityCopy[locale];
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [providerConfirmed, setProviderConfirmed] = useState(false);
  const mutation = trpc.admin.groups.review.useMutation({
    onSuccess: async () => {
      toast.success(t.updated);
      await refresh();
    },
  });
  const review = (decision: "approved" | "rejected" | "hidden") =>
    mutation.mutate({
      id: group.id,
      revision: group.revision,
      decision,
      note,
      groupConfirmed: confirmed,
      providerConfirmed,
    });
  return (
    <div className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 dir="auto" className="break-words text-xl font-extrabold">
        {group.name}
      </h2>
      <p
        dir="auto"
        className="whitespace-pre-line break-words text-sm leading-7 text-slate-600"
      >
        {group.description}
      </p>
      <GroupSourceDetails data={group.linkMetadata} />
      <a
        href={group.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        dir="ltr"
        className="break-all text-sm text-beacon-700 underline"
      >
        {group.url}
      </a>
      {group.providerId && (
        <div className="rounded-xl bg-beacon-50 p-4 text-sm">
          <p className="font-bold">{t.evidence}</p>
          {group.evidenceUrl && (
            <a
              href={group.evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="mt-2 block break-all text-beacon-800 underline"
            >
              {group.evidenceUrl}
            </a>
          )}
        </div>
      )}
      {group.reviewNote && (
        <div className="rounded-xl bg-slate-50 p-4 text-sm">
          <strong>{t.note}</strong>
          <p dir="auto" className="mt-2 whitespace-pre-line break-words">
            {group.reviewNote}
          </p>
        </div>
      )}
      {canReview && (
        <>
          <button
            className={secondaryClass}
            onClick={onEdit}
            disabled={mutation.isPending}
          >
            {t.edit}
          </button>
          <GroupField label={t.reviewNote}>
            <textarea
              className={fieldClass}
              rows={3}
              minLength={8}
              maxLength={600}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </GroupField>
          <label className="flex items-start gap-3 text-sm leading-7">
            <input
              className="mt-2"
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
            />
            {t.confirmGroup}
          </label>
          {group.providerId && (
            <label className="flex items-start gap-3 text-sm leading-7">
              <input
                className="mt-2"
                type="checkbox"
                checked={providerConfirmed}
                onChange={e => setProviderConfirmed(e.target.checked)}
              />
              {t.confirmProvider}
            </label>
          )}
          <p className="text-xs leading-6 text-slate-500">{t.reviewRequired}</p>
          {mutation.error && (
            <p role="alert" className="text-sm text-red-700">
              {communityError(mutation.error.message, locale)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className={primaryClass}
              disabled={
                mutation.isPending ||
                note.trim().length < 8 ||
                !confirmed ||
                Boolean(group.providerId && !providerConfirmed)
              }
              onClick={() => review("approved")}
            >
              {t.approve}
            </button>
            <button
              className={secondaryClass}
              disabled={mutation.isPending || note.trim().length < 8}
              onClick={() => review("rejected")}
            >
              {t.reject}
            </button>
            <button
              className={secondaryClass}
              disabled={mutation.isPending || note.trim().length < 8}
              onClick={() => review("hidden")}
            >
              {t.hide}
            </button>
          </div>
        </>
      )}
      <ReportQueue groupId={group.id} canReview={canReview} />
    </div>
  );
}
function ReportQueue({
  groupId,
  canReview,
}: {
  groupId: number;
  canReview: boolean;
}) {
  const { locale } = useLocale();
  const t = communityCopy[locale];
  const utils = trpc.useUtils();
  const [cursors, setCursors] = useState<(number | undefined)[]>([undefined]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const query = trpc.admin.groups.reports.useQuery(
    { groupId, cursor: cursors.at(-1) },
    { retry: false }
  );
  const resolve = trpc.admin.groups.resolveReport.useMutation({
    onSuccess: async () => {
      setCursors([undefined]);
      await Promise.all([
        utils.admin.groups.reports.invalidate(),
        utils.admin.groups.list.invalidate(),
      ]);
    },
    onError: e => toast.error(communityError(e.message, locale)),
  });
  return (
    <div className="border-t border-slate-200 pt-5">
      <h3 className="font-bold">{t.reports}</h3>
      {query.isLoading ? (
        <p className="mt-3 text-sm">{t.loading}</p>
      ) : query.isError ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {t.error}
          <button onClick={() => query.refetch()} className="ms-2 underline">
            {t.retry}
          </button>
        </p>
      ) : !query.data?.items.length ? (
        <p className="mt-3 text-sm text-slate-500">{t.noReports}</p>
      ) : (
        query.data.items.map(report => (
          <div
            key={report.id}
            className="mt-4 grid gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-4"
          >
            <strong className="text-sm">{t.reasons[report.reason]}</strong>
            <p
              dir="auto"
              className="whitespace-pre-line break-words text-sm leading-7"
            >
              {report.note}
            </p>
            <time className="text-xs text-slate-500">
              {new Date(report.createdAt).toLocaleString(locale)}
            </time>
            {canReview && (
              <>
                <GroupField label={t.resolution}>
                  <input
                    className={fieldClass}
                    minLength={8}
                    maxLength={600}
                    value={notes[report.id] ?? ""}
                    onChange={e =>
                      setNotes(v => ({ ...v, [report.id]: e.target.value }))
                    }
                  />
                </GroupField>
                <button
                  className={secondaryClass}
                  disabled={
                    resolve.isPending ||
                    (notes[report.id]?.trim().length ?? 0) < 8
                  }
                  onClick={() =>
                    resolve.mutate({
                      id: report.id,
                      revision: report.revision,
                      note: notes[report.id],
                    })
                  }
                >
                  {t.resolve}
                </button>
              </>
            )}
          </div>
        ))
      )}
      <GroupPagination
        previous={
          cursors.length > 1 ? () => setCursors(v => v.slice(0, -1)) : undefined
        }
        next={
          query.data?.nextCursor
            ? () => setCursors(v => [...v, query.data!.nextCursor])
            : undefined
        }
      />
    </div>
  );
}
