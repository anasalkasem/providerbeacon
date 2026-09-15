import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, MessagesSquare, Search, Users } from "lucide-react";
import { toast } from "sonner";
import {
  groupLanguages,
  groupPlatforms,
  groupTopics,
  reportReasons,
  type groupListInput,
  type groupReportInput,
} from "@shared/community";
import type { z } from "zod";
import { useLocale } from "@/contexts/LocaleContext";
import { communityCopy, communityError } from "@/i18n/community";
import { useMember } from "@/hooks/useMember";
import { trpc } from "@/lib/trpc";
import { PublicLayout } from "@/components/SiteChrome";
import {
  CommunityCard,
  GroupField,
  GroupPagination,
  fieldClass,
  platformIcons,
  primaryClass,
  secondaryClass,
} from "@/components/CommunityUi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Groups() {
  const { locale } = useLocale();
  const t = communityCopy[locale];
  const [filters, setFilters] = useState<z.infer<typeof groupListInput>>({
    q: "",
  });
  const [search, setSearch] = useState("");
  const [cursors, setCursors] = useState<(number | undefined)[]>([undefined]);
  const [reportId, setReportId] = useState<number | null>(null);
  const query = trpc.community.list.useQuery(
    { ...filters, cursor: cursors.at(-1) },
    { retry: false, staleTime: 15000 }
  );
  const filter = (patch: Partial<typeof filters>) => {
    setFilters(v => ({ ...v, ...patch }));
    setCursors([undefined]);
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(v => ({ ...v, q: search.trim() }));
      setCursors([undefined]);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const filtered = Boolean(
    filters.q || filters.platform || filters.language || filters.topic
  );
  const reset = () => {
    setFilters({ q: "" });
    setSearch("");
    setCursors([undefined]);
  };
  return (
    <PublicLayout showCatalogueNotice={false}>
      <section className="overflow-hidden border-b border-teal-100 bg-[linear-gradient(120deg,#eef8f5,#f5f8fd)]">
        <div className="container grid items-center gap-8 py-12 md:grid-cols-[1.5fr_1fr] md:py-16">
          <div>
            <p className="text-xs font-bold tracking-[.18em] text-teal-700">
              {t.eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-[#0B2A48] sm:text-5xl">
              {t.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
              {t.intro}
            </p>
            <Link href="/account/groups" className={`${primaryClass} mt-7`}>
              {t.submit}
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div
            aria-hidden="true"
            className="hidden justify-self-center md:grid"
          >
            <div className="grid size-52 place-items-center rounded-full border border-teal-200/70 bg-white/40 shadow-[0_0_0_24px_#ffffff45,0_0_0_48px_#ffffff25]">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#0B2A48] p-5 text-white shadow-lg">
                  <Users className="size-12" />
                </div>
                <div className="grid gap-3">
                  {groupPlatforms.map(v => {
                    const Icon = platformIcons[v];
                    return (
                      <span
                        key={v}
                        className="rounded-xl border border-white bg-white p-3 text-teal-700 shadow-sm"
                      >
                        <Icon className="size-5" />
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="container py-8 sm:py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div
            className="flex flex-wrap items-center gap-2"
            aria-label={t.platform}
          >
            <button
              aria-pressed={!filters.platform}
              onClick={() => filter({ platform: undefined })}
              className={!filters.platform ? primaryClass : secondaryClass}
            >
              {t.all}
            </button>
            {groupPlatforms.map(v => {
              const Icon = platformIcons[v];
              return (
                <button
                  key={v}
                  aria-pressed={filters.platform === v}
                  onClick={() => filter({ platform: v })}
                  className={
                    filters.platform === v ? primaryClass : secondaryClass
                  }
                >
                  <Icon className="size-4" />
                  {t.platforms[v]}
                </button>
              );
            })}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
            <GroupField label={t.search}>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-3.5 size-4 text-slate-400" />
                <input
                  type="search"
                  className={`${fieldClass} ps-10`}
                  maxLength={100}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </GroupField>
            <GroupField label={t.language}>
              <select
                className={fieldClass}
                value={filters.language ?? ""}
                onChange={e =>
                  filter({
                    language:
                      (e.target.value as typeof filters.language) || undefined,
                  })
                }
              >
                <option value="">{t.all}</option>
                {groupLanguages.map(v => (
                  <option key={v} value={v}>
                    {t.languages[v]}
                  </option>
                ))}
              </select>
            </GroupField>
            <GroupField label={t.topic}>
              <select
                className={fieldClass}
                value={filters.topic ?? ""}
                onChange={e =>
                  filter({
                    topic:
                      (e.target.value as typeof filters.topic) || undefined,
                  })
                }
              >
                <option value="">{t.all}</option>
                {groupTopics.map(v => (
                  <option key={v} value={v}>
                    {t.topics[v]}
                  </option>
                ))}
              </select>
            </GroupField>
          </div>
        </div>
        <div className="my-6 flex flex-wrap items-center justify-between gap-3">
          <p
            aria-live="polite"
            className="text-sm font-semibold text-slate-600"
          >
            {t.found}: {query.data?.total ?? "—"}
          </p>
          {filtered && (
            <button
              onClick={reset}
              className="text-sm font-bold text-teal-700 underline underline-offset-4"
            >
              {t.reset}
            </button>
          )}
          <Link
            href="/account/groups"
            className="text-sm font-bold text-[#0B2A48]"
          >
            {t.mine} →
          </Link>
        </div>
        {query.isLoading ? (
          <p role="status" className="py-16 text-center text-slate-500">
            {t.loading}
          </p>
        ) : query.isError ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-100 bg-white p-8 text-center"
          >
            <p>{t.error}</p>
            <button
              onClick={() => query.refetch()}
              className={`${secondaryClass} mt-4`}
            >
              {t.retry}
            </button>
          </div>
        ) : !query.data?.items.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-14">
            <MessagesSquare className="mx-auto size-10 text-teal-600" />
            <h2 className="mt-5 text-2xl font-bold text-[#0B2A48]">
              {filtered ? t.noMatch : t.empty}
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-500">
              {filtered ? t.noMatchBody : t.emptyBody}
            </p>
            <Link href="/account/groups" className={`${primaryClass} mt-6`}>
              {t.submit}
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {query.data.items.map(group => (
              <CommunityCard
                key={group.id}
                group={group}
                onReport={setReportId}
              />
            ))}
          </div>
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
        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-6 text-slate-500">
          {t.disclaimer}
        </p>
      </section>
      <Dialog
        open={reportId !== null}
        onOpenChange={open => {
          if (!open) setReportId(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{t.report}</DialogTitle>
          <DialogDescription>{t.reportHint}</DialogDescription>
          {reportId !== null && (
            <ReportForm
              key={reportId}
              id={reportId}
              close={() => setReportId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
}
function ReportForm({ id, close }: { id: number; close: () => void }) {
  const me = useMember();
  const { locale } = useLocale();
  const t = communityCopy[locale];
  const [reason, setReason] =
    useState<z.infer<typeof groupReportInput>["reason"]>("broken");
  const [note, setNote] = useState("");
  const mutation = trpc.community.report.useMutation({
    onSuccess: () => {
      toast.success(t.reported);
      close();
    },
  });
  if (me.isLoading) return <p role="status">{t.loading}</p>;
  if (!me.data?.member)
    return (
      <Link href="/sign-in?next=/groups" className={primaryClass}>
        {t.signIn}
      </Link>
    );
  if (!me.data.member.emailVerified)
    return (
      <div>
        <p className="text-sm leading-7">{t.verify}</p>
        <Link href="/account/settings" className={`${secondaryClass} mt-4`}>
          {t.settings}
        </Link>
      </div>
    );
  return (
    <form
      className="grid gap-4"
      onSubmit={e => {
        e.preventDefault();
        mutation.mutate({ id, reason, note });
      }}
    >
      <select
        className={fieldClass}
        aria-label={t.report}
        value={reason}
        onChange={e => setReason(e.target.value as typeof reason)}
      >
        {reportReasons.map(v => (
          <option key={v} value={v}>
            {t.reasons[v]}
          </option>
        ))}
      </select>
      <GroupField label={t.details}>
        <textarea
          className={fieldClass}
          rows={3}
          maxLength={500}
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </GroupField>
      {mutation.error && (
        <p role="alert" className="text-sm text-red-700">
          {communityError(mutation.error.message, locale)}
        </p>
      )}
      <button className={primaryClass} disabled={mutation.isPending}>
        {mutation.isPending ? t.saving : t.sendReport}
      </button>
    </form>
  );
}
