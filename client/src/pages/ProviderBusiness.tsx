import { BusinessAnalytics } from "@/components/BusinessAnalytics";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  BarChart3,
  Building2,
  LockKeyhole,
  Plus,
  Users,
  Tag,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { type GroupInput } from "../../../shared/community";
import { promotionInput, planState } from "../../../shared/providerBusiness";
import { useLocale } from "@/contexts/LocaleContext";
import { useMember } from "@/hooks/useMember";
import { trpc } from "@/lib/trpc";
import { businessError, businessText } from "@/i18n/providerBusiness";
import { communityError } from "@/i18n/community";
import { formatNumber } from "@/i18n/messages";
import { PublicLayout } from "@/components/SiteChrome";
import { GroupForm } from "@/components/CommunityUi";
import {
  BusinessCard,
  BusinessError,
  BusinessPager,
  BusinessStatus,
  businessDateInput,
  businessField,
  businessParseDate,
  businessPrimary,
  businessSecondary,
  useBusinessClock,
} from "@/components/BusinessUi";

type Output = inferRouterOutputs<AppRouter>["business"];
type Workspace = Output["mine"];
type Claim = Workspace["claims"][number];
type Owned = Workspace["providers"][number];
type OwnedGroup = Output["groups"]["mine"][number];
type Promotion = Output["promotions"]["mine"]["items"][number];

export default function ProviderBusiness() {
  const member = useMember();
  const { locale } = useLocale();
  const t = businessText(locale);
  return (
    <PublicLayout showCatalogueNotice={false}>
      <section className="container py-10">
        <header className="mb-8 flex items-start gap-4">
          <span className="rounded-2xl bg-teal-50 p-3 text-teal-700">
            <Building2 className="size-8" />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold text-[#0B2A68]">
              {t.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              {t.intro}
            </p>
          </div>
        </header>
        {member.isLoading ? (
          <p role="status">{t.loading}</p>
        ) : member.isError ? (
          <BusinessError />
        ) : !member.data?.member ? (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <BusinessCard>
              <h2 className="text-2xl font-bold text-[#0B2A68]">{t.plan}</h2>
              <p className="mt-4 leading-8 text-slate-600">{t.planHelp}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  className={businessPrimary}
                  href="/sign-in?next=/account/provider"
                >
                  {t.signIn}
                </Link>
                <Link
                  className={businessSecondary}
                  href="/sign-up?next=/account/provider"
                >
                  {t.signUp}
                </Link>
              </div>
            </BusinessCard>
            <div className="grid gap-3">
              {[
                { icon: Users, title: t.groups },
                { icon: BarChart3, title: t.analytics },
                { icon: Tag, title: t.myOffers },
              ].map(feature => (
                <BusinessCard key={feature.title}>
                  <div className="flex items-center gap-4">
                    <feature.icon className="size-6 text-teal-600" />
                    <h2 className="font-bold text-slate-800">
                      {feature.title}
                    </h2>
                  </div>
                </BusinessCard>
              ))}
            </div>
          </div>
        ) : (
          <ProviderWorkspace
            key={member.data.member.id}
            accountId={member.data.member.id}
            verified={member.data.member.emailVerified}
          />
        )}
      </section>
    </PublicLayout>
  );
}

function ProviderWorkspace({
  accountId,
  verified,
}: {
  accountId: number;
  verified: boolean;
}) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const query = trpc.business.mine.useQuery(
    { accountId },
    { retry: false, staleTime: 0, refetchInterval: 30_000 }
  );
  const [selected, setSelected] = useState<number>();
  const owned =
    query.data?.providers.find(p => p.provider.id === selected) ??
    query.data?.providers[0];
  return (
    <div className="space-y-6">
      {!verified && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">
          {t.verify}{" "}
          <Link href="/account/settings" className="font-bold underline">
            {t.settings}
          </Link>
        </p>
      )}
      {query.isError ? (
        <>
          <BusinessError message={query.error.message} />
          <button className={businessSecondary} onClick={() => query.refetch()}>
            {t.retry}
          </button>
        </>
      ) : !query.data ? (
        <p role="status">{t.loading}</p>
      ) : (
        <>
          {query.data.providers.length > 1 && (
            <label className="block max-w-sm text-sm font-semibold">
              {t.provider}
              <select
                className={businessField}
                value={owned?.provider.id}
                onChange={e => setSelected(Number(e.target.value))}
              >
                {query.data.providers.map(p => (
                  <option key={p.provider.id} value={p.provider.id}>
                    {p.provider.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {owned ? (
            <ProviderTools
              key={owned.provider.id}
              accountId={accountId}
              owned={owned}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-slate-500">
              {t.noProviders}
            </p>
          )}
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <ClaimPicker verified={verified} />
            <BusinessCard>
              <h2 className="text-lg font-bold text-[#0B2A68]">{t.requests}</h2>
              <div className="mt-5 space-y-5">
                {query.data.claims.length ? (
                  query.data.claims.map(claim => (
                    <ClaimItem
                      key={`${claim.id}:${claim.revision}`}
                      claim={claim}
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500">{t.noItems}</p>
                )}
              </div>
            </BusinessCard>
          </div>
        </>
      )}
    </div>
  );
}
function ClaimPicker({ verified }: { verified: boolean }) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [providerId, setProviderId] = useState(() => {
    const value = Number(
      new URLSearchParams(window.location.search).get("provider")
    );
    return Number.isSafeInteger(value) && value > 0 ? String(value) : "";
  });
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const providers = trpc.community.providers.useQuery(
    { q },
    { retry: false, staleTime: 30_000 }
  );
  const claim = trpc.business.prepareClaim.useMutation({
    onSuccess: async () => {
      toast.success(t.saved);
      await utils.business.mine.invalidate();
    },
    onError: e => toast.error(businessError(e.message, locale)),
  });
  return (
    <BusinessCard>
      <h2 className="text-lg font-bold text-[#0B2A68]">{t.claim}</h2>
      <label className="mt-4 block text-sm font-semibold">
        {t.search}
        <input
          type="search"
          maxLength={100}
          className={businessField}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </label>
      <label className="mt-4 block text-sm font-semibold">
        {t.provider}
        <select
          className={businessField}
          value={providerId}
          onChange={e => setProviderId(e.target.value)}
        >
          <option value="">{t.select}</option>
          {providers.data?.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {providers.isError && <BusinessError />}
      <button
        className={`${businessPrimary} mt-5`}
        disabled={!verified || !providerId || claim.isPending}
        onClick={() => claim.mutate({ providerId: Number(providerId) })}
      >
        {t.generate}
      </button>
    </BusinessCard>
  );
}
function ClaimItem({ claim }: { claim: Claim }) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const utils = trpc.useUtils();
  const now = useBusinessClock();
  const [proofUrl, setProofUrl] = useState(
    claim.proofUrl ??
      `https://${claim.websiteHost}/providerbeacon-verification.txt`
  );
  const submit = trpc.business.submitProof.useMutation({
    onSuccess: async () => {
      toast.success(t.sent);
      await utils.business.mine.invalidate();
    },
  });
  const pending = claim.status === "draft" || claim.status === "pending";
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h3 className="font-bold" dir="auto">
          {claim.providerName}
        </h3>
        <BusinessStatus value={claim.status} />
      </div>
      {claim.reviewNote && (
        <p
          className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-slate-600"
          dir="auto"
        >
          {claim.reviewNote}
        </p>
      )}
      {pending && (
        <>
          <p className="mt-4 text-sm leading-7 text-slate-600">{t.claimHelp}</p>
          <p className="mt-2 break-all text-xs text-slate-500" dir="ltr">
            {claim.websiteHost}
          </p>
          <code
            className="mt-3 block break-all rounded-lg bg-slate-100 p-3 text-xs leading-6"
            dir="ltr"
          >
            {claim.token}
          </code>
          {new Date(claim.expiresAt).getTime() <= now ? (
            <p className="mt-3 text-sm text-amber-800">{t.expiredCode}</p>
          ) : (
            <form
              className="mt-4"
              onSubmit={e => {
                e.preventDefault();
                if (!submit.isPending)
                  submit.mutate({
                    id: claim.id,
                    revision: claim.revision,
                    proofUrl,
                  });
              }}
            >
              <label className="block text-sm font-semibold">
                {t.proofUrl}
                <input
                  type="url"
                  dir="ltr"
                  maxLength={500}
                  required
                  className={businessField}
                  value={proofUrl}
                  onChange={e => setProofUrl(e.target.value)}
                />
              </label>
              {submit.isError && (
                <BusinessError message={submit.error.message} />
              )}
              <button
                className={`${businessPrimary} mt-4`}
                disabled={submit.isPending}
              >
                {t.submitProof}
              </button>
            </form>
          )}
        </>
      )}
    </article>
  );
}
function ProviderTools({
  accountId,
  owned,
}: {
  accountId: number;
  owned: Owned;
}) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const now = useBusinessClock();
  const state = planState(owned.subscription, now);
  const active = state === "active" && owned.ownershipValid;
  const [tab, setTab] = useState<"analytics" | "groups" | "offers">(
    "analytics"
  );
  return (
    <div className="space-y-6">
      <BusinessCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href={`/providers/${owned.provider.slug}`}
              className="text-2xl font-extrabold text-[#0B2A68]"
              dir="auto"
            >
              {owned.provider.name}
            </Link>
            <p className="mt-2 text-sm font-medium text-slate-500">{t.plan}</p>
          </div>
          <BusinessStatus value={state} />
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-600">{t.planHelp}</p>
        {owned.subscription.endsAt && (
          <p className="mt-3 text-sm text-slate-600">
            {t.endsAt}:{" "}
            <bdi>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "UTC",
              }).format(new Date(owned.subscription.endsAt))}{" "}
              UTC
            </bdi>
          </p>
        )}
        <a
          className={`${businessSecondary} mt-4`}
          href={`mailto:soporte@providerbeacon.com?subject=${encodeURIComponent(`Provider plan: ${owned.provider.name}`)}`}
        >
          {t.renew}
        </a>
      </BusinessCard>
      {!owned.ownershipValid ? (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 p-5 leading-7 text-amber-900"
        >
          {t.ownerChanged}
        </p>
      ) : (
        <>
          {!active && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
              <LockKeyhole className="mt-1 size-5 shrink-0" />
              <p>{t.locked}</p>
            </div>
          )}
          <nav className="flex flex-wrap gap-2" aria-label={t.title}>
            {(["analytics", "groups", "offers"] as const).map(value => (
              <button
                key={value}
                aria-pressed={tab === value}
                className={tab === value ? businessPrimary : businessSecondary}
                onClick={() => setTab(value)}
              >
                {value === "offers" ? t.myOffers : t[value]}
              </button>
            ))}
          </nav>
          {tab === "analytics" && active && (
            <BusinessAnalytics
              accountId={accountId}
              providerId={owned.provider.id}
            />
          )}
          {tab === "groups" && (
            <ProviderGroups
              accountId={accountId}
              provider={owned.provider}
              active={active}
            />
          )}
          {tab === "offers" && (
            <ProviderPromotions
              accountId={accountId}
              providerId={owned.provider.id}
              active={active}
            />
          )}
        </>
      )}
    </div>
  );
}
function ProviderGroups({
  accountId,
  provider,
  active,
}: {
  accountId: number;
  provider: Owned["provider"];
  active: boolean;
}) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const utils = trpc.useUtils();
  const query = trpc.business.groups.mine.useQuery(
    { accountId, providerId: provider.id },
    { retry: false, staleTime: 0 }
  );
  const [editing, setEditing] = useState<OwnedGroup | "new" | null>(null);
  const refresh = async () => {
    setEditing(null);
    await Promise.all([
      utils.business.groups.mine.invalidate(),
      utils.community.list.invalidate(),
      utils.community.mine.invalidate(),
    ]);
  };
  const submit = trpc.business.groups.submit.useMutation({
    onSuccess: async () => {
      toast.success(t.sent);
      await refresh();
    },
  });
  const edit = trpc.business.groups.edit.useMutation({
    onSuccess: async () => {
      toast.success(t.sent);
      await refresh();
    },
  });
  const withdraw = trpc.business.groups.withdraw.useMutation({
    onSuccess: refresh,
    onError: e => toast.error(businessError(e.message, locale)),
  });
  const save = (input: GroupInput) => {
    if (editing && editing !== "new")
      edit.mutate({
        ...input,
        providerId: provider.id,
        id: editing.id,
        revision: editing.revision,
      });
    else submit.mutate({ ...input, providerId: provider.id });
  };
  return (
    <BusinessCard>
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-xl font-bold text-[#0B2A68]">{t.groups}</h2>
        <button
          className={businessPrimary}
          disabled={!active || (query.data?.length ?? 0) >= 20}
          onClick={() => {
            submit.reset();
            edit.reset();
            setEditing("new");
          }}
        >
          <Plus className="size-4" />
          {t.addGroup}
        </button>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-500">{t.groupHelp}</p>
      {active && editing && (
        <div className="mt-6">
          <GroupForm
            key={
              editing === "new" ? "new" : `${editing.id}:${editing.revision}`
            }
            fixedProvider={provider}
            initial={
              editing === "new"
                ? {
                    providerId: provider.id,
                    evidenceUrl: provider.websiteUrl ?? "",
                  }
                : { ...editing, evidenceUrl: editing.evidenceUrl ?? "" }
            }
            pending={submit.isPending || edit.isPending}
            onSave={save}
            onCancel={() => setEditing(null)}
            error={
              submit.error || edit.error
                ? communityError((submit.error ?? edit.error)!.message, locale)
                : undefined
            }
          />
        </div>
      )}
      {query.isError ? (
        <BusinessError message={query.error.message} />
      ) : !query.data ? (
        <p className="mt-5" role="status">
          {t.loading}
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {!query.data.length && <p className="text-slate-500">{t.noItems}</p>}
          {query.data.map(group => (
            <article
              key={group.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <h3 className="font-bold" dir="auto">
                  {group.name}
                </h3>
                <BusinessStatus value={group.status} />
              </div>
              <p
                className="mt-2 break-words text-sm leading-7 text-slate-600"
                dir="auto"
              >
                {group.description}
              </p>
              <a
                href={group.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-2 block break-all text-xs text-teal-700 underline"
                dir="ltr"
              >
                {group.url}
              </a>
              {group.reviewNote && (
                <p className="mt-3 text-sm leading-7" dir="auto">
                  {group.reviewNote}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className={businessSecondary}
                  disabled={!active}
                  onClick={() => {
                    submit.reset();
                    edit.reset();
                    setEditing(group);
                  }}
                >
                  {t.edit}
                </button>
                <button
                  className={businessSecondary}
                  disabled={withdraw.isPending || group.status === "hidden"}
                  onClick={() =>
                    withdraw.mutate({
                      providerId: provider.id,
                      id: group.id,
                      revision: group.revision,
                    })
                  }
                >
                  {t.hide}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </BusinessCard>
  );
}
function ProviderPromotions({
  accountId,
  providerId,
  active,
}: {
  accountId: number;
  providerId: number;
  active: boolean;
}) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const utils = trpc.useUtils();
  const now = useBusinessClock();
  const [cursor, setCursor] = useState<number>();
  const [editing, setEditing] = useState<Promotion | "new" | null>(null);
  const query = trpc.business.promotions.mine.useQuery(
    { accountId, providerId, cursor },
    { retry: false, staleTime: 0 }
  );
  const refresh = async () => {
    setEditing(null);
    setCursor(undefined);
    await Promise.all([
      utils.business.promotions.mine.invalidate(),
      utils.business.promotions.list.invalidate(),
    ]);
  };
  const submit = trpc.business.promotions.submit.useMutation({
    onSuccess: async () => {
      toast.success(t.sent);
      await refresh();
    },
  });
  const edit = trpc.business.promotions.edit.useMutation({
    onSuccess: async () => {
      toast.success(t.sent);
      await refresh();
    },
  });
  const withdraw = trpc.business.promotions.withdraw.useMutation({
    onSuccess: refresh,
    onError: e => toast.error(businessError(e.message, locale)),
  });
  return (
    <BusinessCard>
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-xl font-bold text-[#0B2A68]">{t.myOffers}</h2>
        <button
          className={businessPrimary}
          disabled={
            !active ||
            !query.data ||
            query.data.usage.used >= query.data.usage.limit
          }
          onClick={() => {
            submit.reset();
            edit.reset();
            setEditing("new");
          }}
        >
          <Plus className="size-4" />
          {t.newOffer}
        </button>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-500">{t.offerHelp}</p>
      {query.data && (
        <p className="mt-3 text-xs font-semibold text-teal-700">
          {t.usage}:{" "}
          <bdi>
            {formatNumber(locale, query.data.usage.used)} /{" "}
            {formatNumber(locale, query.data.usage.limit)}
          </bdi>
        </p>
      )}
      {active && editing && (
        <PromotionForm
          key={editing === "new" ? "new" : `${editing.id}:${editing.revision}`}
          providerId={providerId}
          initial={editing === "new" ? undefined : editing}
          pending={submit.isPending || edit.isPending}
          error={(submit.error ?? edit.error)?.message}
          onCancel={() => setEditing(null)}
          onSave={input =>
            editing !== "new"
              ? edit.mutate({
                  ...input,
                  id: editing.id,
                  revision: editing.revision,
                })
              : submit.mutate(input)
          }
        />
      )}
      {query.isError ? (
        <BusinessError message={query.error.message} />
      ) : !query.data ? (
        <p role="status" className="mt-5">
          {t.loading}
        </p>
      ) : (
        <>
          <div className="mt-5 space-y-3">
            {!query.data.items.length && (
              <p className="text-slate-500">{t.noItems}</p>
            )}
            {query.data.items.map(offer => (
              <article
                key={offer.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <h3 className="font-bold" dir="auto">
                    {offer.title}
                  </h3>
                  <BusinessStatus
                    value={
                      new Date(offer.endsAt).getTime() <= now
                        ? "expired"
                        : offer.status
                    }
                  />
                </div>
                <p
                  className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-slate-600"
                  dir="auto"
                >
                  {offer.description}
                </p>
                {offer.reviewNote && (
                  <p
                    className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-7"
                    dir="auto"
                  >
                    {offer.reviewNote}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    className={businessSecondary}
                    disabled={!active}
                    onClick={() => {
                      submit.reset();
                      edit.reset();
                      setEditing(offer);
                    }}
                  >
                    {t.edit}
                  </button>
                  <button
                    className={businessSecondary}
                    disabled={withdraw.isPending || offer.status === "hidden"}
                    onClick={() =>
                      withdraw.mutate({
                        providerId,
                        id: offer.id,
                        revision: offer.revision,
                      })
                    }
                  >
                    {t.hide}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <BusinessPager
            cursor={cursor}
            nextCursor={query.data.nextCursor}
            onChange={setCursor}
          />
        </>
      )}
    </BusinessCard>
  );
}
function PromotionForm({
  providerId,
  initial,
  pending,
  error,
  onCancel,
  onSave,
}: {
  providerId: number;
  initial?: Promotion;
  pending: boolean;
  error?: string;
  onCancel: () => void;
  onSave: (input: typeof promotionInput._output) => void;
}) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [couponCode, setCoupon] = useState(initial?.couponCode ?? "");
  const [destinationUrl, setDestination] = useState(
    initial?.destinationUrl ?? ""
  );
  const [startsAt, setStart] = useState(
    businessDateInput(initial?.startsAt ?? new Date())
  );
  const [endsAt, setEnd] = useState(
    businessDateInput(initial?.endsAt ?? new Date(Date.now() + 7 * 86_400_000))
  );
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      className="mt-6 space-y-4 rounded-xl bg-slate-50 p-5"
      onSubmit={e => {
        e.preventDefault();
        if (pending) return;
        const value = promotionInput.safeParse({
          providerId,
          title,
          description,
          couponCode,
          destinationUrl,
          startsAt: businessParseDate(startsAt),
          endsAt: businessParseDate(endsAt),
        });
        if (!value.success) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        onSave(value.data);
      }}
    >
      <fieldset disabled={pending} className="space-y-4">
        <label className="block text-sm font-semibold">
          {t.titleLabel}
          <input
            required
            minLength={4}
            maxLength={120}
            className={businessField}
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          {t.description}
          <textarea
            required
            minLength={20}
            maxLength={1200}
            rows={4}
            className={businessField}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          {t.coupon}
          <input
            dir="ltr"
            maxLength={64}
            pattern="[A-Za-z0-9_-]*"
            className={businessField}
            value={couponCode}
            onChange={e => setCoupon(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          {t.destination}
          <input
            type="url"
            dir="ltr"
            required
            maxLength={500}
            className={businessField}
            value={destinationUrl}
            onChange={e => setDestination(e.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            {t.startsAt}
            <input
              type="datetime-local"
              dir="ltr"
              required
              className={businessField}
              value={startsAt}
              onChange={e => setStart(e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            {t.endsAt}
            <input
              type="datetime-local"
              dir="ltr"
              required
              className={businessField}
              value={endsAt}
              onChange={e => setEnd(e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">{t.utc}</p>
      </fieldset>
      {error && <BusinessError message={error} />}{" "}
      {invalid && <BusinessError />}
      <div className="flex gap-3">
        <button className={businessPrimary} disabled={pending}>
          {t.submit}
        </button>
        <button
          type="button"
          className={businessSecondary}
          onClick={onCancel}
          disabled={pending}
        >
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
