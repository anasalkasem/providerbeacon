import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { useLocale } from "@/contexts/LocaleContext";
import { communityCopy, communityError } from "@/i18n/community";
import { useMember } from "@/hooks/useMember";
import { trpc } from "@/lib/trpc";
import { PublicLayout } from "@/components/SiteChrome";
import { CommunityKindBadge } from "@/components/CommunityKindBadge";
import {
  GroupForm,
  primaryClass,
  secondaryClass,
} from "@/components/CommunityUi";

type OwnGroup = inferRouterOutputs<AppRouter>["community"]["mine"][number];
export default function MemberGroups() {
  const me = useMember();
  const { locale } = useLocale();
  const t = communityCopy[locale];
  return (
    <PublicLayout showCatalogueNotice={false}>
      <section className="container py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Users className="size-8 text-foreground" />
            <h1 className="text-3xl font-extrabold text-foreground">{t.mine}</h1>
          </div>
          <Link href="/groups" className={secondaryClass}>
            {t.directory}
          </Link>
        </header>
        {me.isLoading ? (
          <p role="status">{t.loading}</p>
        ) : me.isError ? (
          <p role="alert">
            {t.error}
            <button
              className={`${secondaryClass} ms-3`}
              onClick={() => me.refetch()}
            >
              {t.retry}
            </button>
          </p>
        ) : !me.data?.member ? (
          <div className="max-w-xl rounded-2xl border border-border bg-card p-7">
            <p className="mb-5 leading-8 text-secondary-foreground">{t.signInBody}</p>
            <Link href="/sign-in?next=/account/groups" className={primaryClass}>
              {t.signIn}
            </Link>
          </div>
        ) : (
          <MyGroups
            key={me.data.member.id}
            accountId={me.data.member.id}
            verified={me.data.member.emailVerified}
          />
        )}
      </section>
    </PublicLayout>
  );
}
function MyGroups({
  accountId,
  verified,
}: {
  accountId: number;
  verified: boolean;
}) {
  const { locale } = useLocale();
  const t = communityCopy[locale];
  const utils = trpc.useUtils();
  const query = trpc.community.mine.useQuery(
    { accountId },
    { retry: false, staleTime: 10000 }
  );
  const [editing, setEditing] = useState<OwnGroup | "new" | null>(null);
  const refresh = async () => {
    setEditing(null);
    await Promise.all([
      utils.community.mine.invalidate(),
      utils.community.list.invalidate(),
    ]);
  };
  const submit = trpc.community.submit.useMutation({
    onSuccess: async () => {
      toast.success(t.sent);
      await refresh();
    },
  });
  const edit = trpc.community.edit.useMutation({
    onSuccess: async () => {
      toast.success(t.sent);
      await refresh();
    },
  });
  const withdraw = trpc.community.withdraw.useMutation({
    onSuccess: async () => {
      toast.success(t.hidden);
      await refresh();
    },
    onError: e => toast.error(communityError(e.message, locale)),
  });
  const start = (row: OwnGroup | "new") => {
    submit.reset();
    edit.reset();
    setEditing(row);
  };
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="grid gap-4">
        {!verified && (
          <div className="rounded-2xl border border-warning-border bg-warning-muted p-5 text-sm leading-7 text-warning">
            {t.verify}
            <Link
              href="/account/settings"
              className="mt-2 block font-bold underline"
            >
              {t.settings}
            </Link>
          </div>
        )}
        {query.isLoading ? (
          <p role="status">{t.loading}</p>
        ) : query.isError ? (
          <p role="alert">
            {t.error}
            <button className={secondaryClass} onClick={() => query.refetch()}>
              {t.retry}
            </button>
          </p>
        ) : !query.data?.length ? (
          <p className="rounded-2xl border border-border bg-card p-8 text-muted-foreground">
            {t.noMine}
          </p>
        ) : (
          query.data.map(group => (
            <article
              key={group.id}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  dir="auto"
                  className="break-words text-lg font-bold text-foreground"
                >
                  {group.name}
                </h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${group.status === "approved" ? "bg-secondary text-foreground" : group.status === "pending" ? "bg-warning-muted text-warning" : "bg-secondary text-secondary-foreground"}`}
                >
                  {t.statuses[group.status]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <CommunityKindBadge url={group.url} data={group.linkMetadata} />
                <span>
                  {t.platforms[group.platform]} · {t.topics[group.topic]} ·{" "}
                  {t.languages[group.language]}
                </span>
              </div>
              <a
                href={group.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                dir="ltr"
                className="mt-3 block break-all text-sm text-foreground underline"
              >
                {group.url}
              </a>
              {group.reviewNote && (
                <div className="mt-4 rounded-xl bg-muted p-4 text-sm leading-7">
                  <p className="font-bold">{t.note}</p>
                  <p
                    dir="auto"
                    className="whitespace-pre-line break-words text-secondary-foreground"
                  >
                    {group.reviewNote}
                  </p>
                </div>
              )}
              <div className="mt-4 flex gap-3">
                <button
                  disabled={!verified || withdraw.isPending}
                  className={secondaryClass}
                  onClick={() => start(group)}
                >
                  {t.edit}
                </button>
                {group.status !== "hidden" && (
                  <button
                    disabled={withdraw.isPending}
                    className={secondaryClass}
                    onClick={() =>
                      withdraw.mutate({
                        id: group.id,
                        revision: group.revision,
                      })
                    }
                  >
                    {t.withdraw}
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
      <div>
        {editing && verified ? (
          <GroupForm
            key={
              editing === "new" ? "new" : `${editing.id}:${editing.revision}`
            }
            initial={
              editing === "new"
                ? undefined
                : { ...editing, evidenceUrl: editing.evidenceUrl ?? "" }
            }
            onSave={values =>
              editing === "new"
                ? submit.mutate(values)
                : edit.mutate({
                    ...values,
                    id: editing.id,
                    revision: editing.revision,
                  })
            }
            onCancel={() => setEditing(null)}
            pending={submit.isPending || edit.isPending}
            error={(editing === "new" ? submit.error : edit.error)?.message}
          />
        ) : (
          <div className="rounded-2xl border border-input bg-secondary/50 p-7">
            <h2 className="text-xl font-extrabold text-foreground">{t.formTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-secondary-foreground">
              {t.formHint}
            </p>
            <button
              disabled={!verified || (query.data?.length ?? 0) >= 10}
              onClick={() => start("new")}
              className={`${primaryClass} mt-5`}
            >
              <Plus className="size-4" />
              {t.submit}
            </button>
            {(query.data?.length ?? 0) >= 10 && (
              <p className="mt-3 text-sm">{t.limit}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
