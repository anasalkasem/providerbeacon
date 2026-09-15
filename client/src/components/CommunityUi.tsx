import { useEffect, useState, type ReactNode } from "react";
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
  groupLanguages,
  groupTopics,
  type GroupInput,
  type GroupPlatform,
} from "@shared/community";
import { useLocale } from "@/contexts/LocaleContext";
import { communityCopy, communityError } from "@/i18n/community";
import { trpc } from "@/lib/trpc";

export const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:opacity-60";
export const primaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2A48] px-5 py-3 text-sm font-bold text-white hover:bg-[#174365] disabled:opacity-50";
export const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export function GroupField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid content-start gap-2 text-sm font-semibold text-slate-700">
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
  telegram: "bg-sky-50 text-sky-700",
  whatsapp: "bg-emerald-50 text-emerald-700",
  discord: "bg-indigo-50 text-indigo-700",
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
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${tones[group.platform]}`}
        >
          <Icon className="size-4" />
          {t.platforms[group.platform]}
        </span>
        <span className="text-xs font-medium text-slate-500">
          {t.topics[group.topic]}
        </span>
      </div>
      <h2
        dir="auto"
        className="mt-5 break-words text-xl font-extrabold leading-8 text-[#0B2A48]"
      >
        {group.name}
      </h2>
      <p
        dir="auto"
        className="mt-2 whitespace-pre-line break-words text-sm leading-7 text-slate-600"
      >
        {group.description}
      </p>
      <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
        <Globe2 className="size-4" />
        {t.languages[group.language]}
      </div>
      <div className="mt-4 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-600">
        {group.provider ? (
          <div>
            <p>
              {t.association}:{" "}
              <Link
                href={`/providers/${group.provider.slug}`}
                className="font-bold text-teal-800 underline underline-offset-4"
              >
                {group.provider.name}
              </Link>
            </p>
            {group.evidenceUrl && (
              <a
                href={group.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 underline underline-offset-4"
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
            <CheckCircle2 className="size-3.5 text-teal-600" />
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
          {t.open}
          <ArrowUpRight className="size-4" />
        </a>
        <button
          onClick={() => onReport(group.id)}
          className="rounded-lg p-3 text-slate-400 hover:bg-amber-50 hover:text-amber-800"
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
  onSave,
  onCancel,
  pending,
  error,
}: {
  initial?: Partial<GroupInput>;
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
    providerId: initial?.providerId ?? null,
    evidenceUrl: initial?.evidenceUrl ?? "",
  });
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const providers = trpc.community.providers.useQuery(
    { q },
    { staleTime: 30000, retry: false }
  );
  const change = <K extends keyof GroupInput>(key: K, value: GroupInput[K]) =>
    setValues(v => ({ ...v, [key]: value }));
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
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
      className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
    >
      <div>
        <h2 className="text-xl font-extrabold text-[#0B2A48]">{t.formTitle}</h2>
        <p className="mt-2 text-sm leading-7 text-slate-500">
          {initial ? t.editHint : t.formHint}
        </p>
      </div>
      <fieldset disabled={pending} className="grid gap-5 disabled:opacity-70">
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
          <span className="text-xs font-normal leading-6 text-slate-500">
            {t.linkHint}
          </span>
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
        <div className="grid gap-3 rounded-xl bg-slate-50 p-4">
          <GroupField label={t.providerSearch}>
            <input
              className={fieldClass}
              type="search"
              maxLength={100}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </GroupField>
          <GroupField label={t.provider}>
            <select
              className={fieldClass}
              value={values.providerId ?? ""}
              onChange={e =>
                change(
                  "providerId",
                  e.target.value ? Number(e.target.value) : null
                )
              }
            >
              <option value="">{t.noProvider}</option>
              {values.providerId &&
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
              className="text-start text-xs text-red-700 underline"
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
              <span className="text-xs font-normal leading-6 text-slate-500">
                {t.evidenceHint}
              </span>
            </GroupField>
          )}
        </div>
      </fieldset>
      {(invalid || error) && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
        >
          {invalid ? t.invalid : communityError(error!, locale)}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryClass} disabled={pending}>
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
