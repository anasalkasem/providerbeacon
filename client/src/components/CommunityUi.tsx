import LinkAutofill, { GroupSourceDetails } from "./LinkAutofill";
import { CommunityKindBadge } from "./CommunityKindBadge";
import { fillSuggested, type GroupLinkMetadata } from "@shared/linkMetadata";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowUpRight,
  CheckCircle2,
  Flag,
  Globe2,
  MessageCircle,
  MessagesSquare,
  Send,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import {
  groupInput,
  groupLink,
  communityKind,
  groupLanguages,
  groupTopics,
  type GroupInput,
  type GroupPlatform,
} from "@shared/community";
import { useLocale } from "@/contexts/LocaleContext";
import { communityCopy, communityError } from "@/i18n/community";
import { trpc } from "@/lib/trpc";

export const fieldClass =
  "w-full rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-input disabled:opacity-60";
export const primaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl beacon-button px-5 py-3 text-sm font-bold disabled:opacity-50";
export const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-secondary-foreground hover:bg-muted disabled:opacity-50";
export function GroupField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid content-start gap-2 text-sm font-semibold text-secondary-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
export const platformIcons = {
  telegram: Send,
  whatsapp: MessageCircle,
  discord: MessagesSquare,
};
const tones: Record<GroupPlatform, string> = {
  telegram: "bg-secondary text-foreground",
  whatsapp: "bg-success-muted text-success",
  discord: "bg-secondary text-foreground",
};
type PublicGroup =
  inferRouterOutputs<AppRouter>["community"]["list"]["items"][number];
export function CommunityCard({
  group,
  onReport,
}: {
  group: PublicGroup;
  onReport: (id: number) => void;
}) {
  const { locale } = useLocale();
  const t = communityCopy[locale];
  const Icon = platformIcons[group.platform];
  const kind = communityKind(group.url, group.linkMetadata?.audience?.kind);
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-6 shadow-none transition-shadow shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${tones[group.platform]}`}
          >
            <Icon className="size-4" />
            {t.platforms[group.platform]}
          </span>
          <CommunityKindBadge url={group.url} data={group.linkMetadata} />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {t.topics[group.topic]}
        </span>
      </div>
      <GroupSourceDetails data={group.linkMetadata} />
      <h2
        dir="auto"
        className="mt-5 break-words text-xl font-extrabold leading-8 text-foreground"
      >
        {group.name}
      </h2>
      <p
        dir="auto"
        className="mt-2 whitespace-pre-line break-words text-sm leading-7 text-secondary-foreground"
      >
        {group.description}
      </p>
      <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <Globe2 className="size-4" />
        {t.languages[group.language]}
      </div>
      <div className="mt-4 border-t border-border pt-4 text-xs leading-6 text-secondary-foreground">
        {group.provider ? (
          <div>
            <p>
              {t.association}:{" "}
              <Link
                href={`/providers/${group.provider.slug}`}
                className="font-bold text-foreground underline underline-offset-4"
              >
                {group.provider.name}
              </Link>
            </p>
            {group.evidenceUrl && (
              <a
                href={group.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4"
              >
                {t.source}
              </a>
            )}
          </div>
        ) : (
          <p>{t.independent}</p>
        )}
        {group.reviewedAt && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-foreground" />
            {t.reviewed}
            <span>
              · {new Date(group.reviewedAt).toLocaleDateString(locale)}
            </span>
          </p>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <a
          href={group.url}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className={primaryClass}
        >
          {kind === "channel"
            ? t.openChannel
            : kind === "server"
              ? t.openServer
              : kind === "group"
                ? t.open
                : t.openCommunity}
          <ArrowUpRight className="size-4" />
        </a>
        <button
          onClick={() => onReport(group.id)}
          className="rounded-lg p-3 text-muted-foreground hover:bg-warning-muted hover:text-warning"
          aria-label={`${t.report}: ${group.name}`}
          title={t.report}
        >
          <Flag className="size-4" />
        </button>
      </div>
    </article>
  );
}
export function GroupForm({
  initial,
  admin = false,
  fixedProvider,
  onSave,
  onCancel,
  pending,
  error,
}: {
  initial?: Partial<GroupInput> & { linkMetadata?: GroupLinkMetadata | null };
  admin?: boolean;
  fixedProvider?: { id: number; name: string };
  onSave: (input: GroupInput) => void;
  onCancel?: () => void;
  pending: boolean;
  error?: string;
}) {
  const { locale } = useLocale();
  const t = communityCopy[locale];
  const [values, setValues] = useState<GroupInput>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    url: initial?.url ?? "",
    topic: initial?.topic ?? "providers",
    language: initial?.language ?? locale,
    providerId: fixedProvider?.id ?? initial?.providerId ?? null,
    evidenceUrl: initial?.evidenceUrl ?? "",
  });
  const touched = useRef(
    new Set<keyof GroupInput>(
      initial ? ["name", "description", "topic", "language"] : []
    )
  );
  const previous = useRef<Partial<GroupInput>>({
    topic: initial?.topic ?? "providers",
    language: initial?.language ?? locale,
  });
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const providers = trpc.community.providers.useQuery(
    { q },
    { staleTime: 30000, retry: false, enabled: !fixedProvider }
  );
  const change = <K extends keyof GroupInput>(key: K, value: GroupInput[K]) => {
    touched.current.add(key);
    const last = previous.current;
    setValues(v => {
      const next = { ...v, [key]: value };
      if (
        key === "url" &&
        groupLink(String(value))?.url !== groupLink(v.url)?.url
      ) {
        next.metadataKey = undefined;
        for (const field of ["name", "description"] as const)
          if (!touched.current.has(field) && next[field] === last[field])
            next[field] = "";
        if (!touched.current.has("topic")) next.topic = "providers";
        if (!touched.current.has("language")) next.language = locale;
      }
      return next;
    });
    if (
      key === "url" &&
      groupLink(String(value))?.url !== groupLink(values.url)?.url
    )
      previous.current = { topic: "providers", language: locale };
  };
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        if (pending || fetching) return;
        const parsed = groupInput.safeParse(values);
        if (
          !parsed.success ||
          (values.providerId && !values.evidenceUrl.trim())
        ) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        onSave(parsed.data);
      }}
      className="grid gap-5 rounded-2xl border border-border bg-card p-5 sm:p-7"
    >
      <div>
        <h2 className="text-xl font-extrabold text-foreground">{t.formTitle}</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          {initial ? t.editHint : t.formHint}
        </p>
      </div>
      <fieldset disabled={pending} className="grid gap-5 disabled:opacity-70">
        <GroupField label={t.link}>
          <input
            className={fieldClass}
            type="url"
            dir="ltr"
            required
            maxLength={500}
            placeholder="https://t.me/…"
            value={values.url}
            onChange={e => change("url", e.target.value)}
          />
          <span className="text-xs font-normal leading-6 text-muted-foreground">
            {t.linkHint}
          </span>
        </GroupField>
        <LinkAutofill
          kind="group"
          url={values.url}
          admin={admin}
          automatic={!initial || values.url !== initial.url}
          onPending={setFetching}
          onResolved={data => {
            const incoming: Partial<GroupInput> = {
              name: data.name ?? undefined,
              description: data.description ?? undefined,
              topic: data.topic ?? undefined,
              language: data.language ?? undefined,
            };
            const old = previous.current;
            setValues(current => ({
              ...fillSuggested(current, incoming, old, touched.current),
              metadataKey: data.key,
            }));
            previous.current = incoming;
          }}
        />
        {!values.metadataKey &&
          initial?.linkMetadata &&
          groupLink(values.url)?.url === groupLink(initial.url ?? "")?.url && (
            <GroupSourceDetails data={initial.linkMetadata} />
          )}
        <GroupField label={t.name}>
          <input
            className={fieldClass}
            dir="auto"
            required
            minLength={3}
            maxLength={100}
            value={values.name}
            onChange={e => change("name", e.target.value)}
          />
        </GroupField>
        <GroupField label={t.description}>
          <textarea
            className={fieldClass}
            dir="auto"
            rows={4}
            required
            minLength={20}
            maxLength={600}
            value={values.description}
            onChange={e => change("description", e.target.value)}
          />
        </GroupField>

        <div className="grid gap-4 sm:grid-cols-2">
          <GroupField label={t.topic}>
            <select
              className={fieldClass}
              value={values.topic}
              onChange={e =>
                change("topic", e.target.value as GroupInput["topic"])
              }
            >
              {groupTopics.map(v => (
                <option key={v} value={v}>
                  {t.topics[v]}
                </option>
              ))}
            </select>
          </GroupField>
          <GroupField label={t.language}>
            <select
              className={fieldClass}
              value={values.language}
              onChange={e =>
                change("language", e.target.value as GroupInput["language"])
              }
            >
              {groupLanguages.map(v => (
                <option key={v} value={v}>
                  {t.languages[v]}
                </option>
              ))}
            </select>
          </GroupField>
        </div>
        <div className="grid gap-3 rounded-xl bg-muted p-4">
          {!fixedProvider && (
            <GroupField label={t.providerSearch}>
              <input
                className={fieldClass}
                type="search"
                maxLength={100}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </GroupField>
          )}
          <GroupField label={t.provider}>
            <select
              className={fieldClass}
              disabled={Boolean(fixedProvider)}
              value={values.providerId ?? ""}
              onChange={e =>
                change(
                  "providerId",
                  e.target.value ? Number(e.target.value) : null
                )
              }
            >
              {fixedProvider ? (
                <option value={fixedProvider.id}>{fixedProvider.name}</option>
              ) : (
                <option value="">{t.noProvider}</option>
              )}
              {values.providerId &&
                !fixedProvider &&
                !providers.data?.some(p => p.id === values.providerId) && (
                  <option value={values.providerId}>{t.savedProvider}</option>
                )}
              {providers.data?.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </GroupField>
          {providers.isError && (
            <button
              type="button"
              className="text-start text-xs text-danger underline"
              onClick={() => providers.refetch()}
            >
              {t.error} {t.retry}
            </button>
          )}
          {values.providerId && (
            <GroupField label={t.evidence}>
              <input
                className={fieldClass}
                type="url"
                dir="ltr"
                required
                maxLength={500}
                value={values.evidenceUrl}
                onChange={e => change("evidenceUrl", e.target.value)}
              />
              <span className="text-xs font-normal leading-6 text-muted-foreground">
                {t.evidenceHint}
              </span>
            </GroupField>
          )}
        </div>
      </fieldset>
      {(invalid || error) && (
        <p
          role="alert"
          className="rounded-xl bg-danger-muted p-3 text-sm text-danger"
        >
          {invalid ? t.invalid : communityError(error!, locale)}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className={primaryClass}
          disabled={pending || fetching}
        >
          {pending ? t.saving : t.save}
        </button>
        {onCancel && (
          <button
            type="button"
            className={secondaryClass}
            onClick={onCancel}
            disabled={pending}
          >
            {t.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
export function GroupPagination({
  next,
  previous,
}: {
  next?: () => void;
  previous?: () => void;
}) {
  const { locale } = useLocale();
  const t = communityCopy[locale];
  if (!next && !previous) return null;
  return (
    <nav className="mt-6 flex justify-center gap-3">
      <button
        className={secondaryClass}
        disabled={!previous}
        onClick={previous}
      >
        {t.previous}
      </button>
      <button className={secondaryClass} disabled={!next} onClick={next}>
        {t.next}
      </button>
    </nav>
  );
}
