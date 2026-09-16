import { BusinessAnalytics } from "@/components/BusinessAnalytics";
import { BusinessPricing } from "@/components/BusinessPricing";
import {
  PaymentMethods,
  PaymentReturn,
  ProviderCheckout,
} from "@/components/ProviderPayments";
import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { BarChart3, Building2, Plus, Users, Tag, Diamond } from "lucide-react";
import { ProviderVip } from "@/components/ProviderVip";
import { vipText } from "@/i18n/providerVip";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { type GroupInput } from "../../../shared/community";
import { promotionInput, planState } from "../../../shared/providerBusiness";
import { useLocale } from "@/contexts/LocaleContext";
import { useMember } from "@/hooks/useMember";
import { trpc } from "@/lib/trpc";
import { businessError, businessText } from "@/i18n/providerBusiness";
import { dashboardText } from "@/i18n/providerDashboard";
import {
  ProviderDashboardShell,
  ProviderOverview,
  providerSections,
  type ProviderSection,
} from "@/components/ProviderDashboard";
import {
  ProviderAccessNotice,
  ProviderFeaturePreview,
  ProviderFreeOverview,
} from "@/components/ProviderPreviews";
import {
  isPremiumProviderSection,
  providerToolAccess,
} from "@/lib/providerToolAccess";
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
  if (member.data?.member && !member.isError)
    return (
      <ProviderWorkspace
        key={member.data.member.id}
        accountId={member.data.member.id}
        verified={member.data.member.emailVerified}
      />
    );
  return (
    <PublicLayout showCatalogueNotice={false}>
      <section className="container py-10">
        <header className="mb-8 flex items-start gap-4">
          <span className="rounded-2xl bg-beacon-50 p-3 text-beacon-700">
            <Building2 className="size-8" />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold text-ink">{t.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              {t.intro}
            </p>
          </div>
        </header>
        {member.isLoading ? (
          <p role="status">{t.loading}</p>
        ) : member.isError ? (
          <BusinessError />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <BusinessCard>
              <h2 className="text-2xl font-bold text-ink">{t.plan}</h2>
              <BusinessPricing />
              <p className="mt-4 leading-8 text-slate-600">{t.planHelp}</p>
              <PaymentMethods />
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
                { icon: Diamond, title: vipText(locale).title },
                { icon: Users, title: t.groups },
                { icon: BarChart3, title: t.analytics },
                { icon: Tag, title: t.myOffers },
              ].map(feature => (
                <BusinessCard key={feature.title}>
                  <div className="flex items-center gap-4">
                    <feature.icon className="size-6 text-beacon-600" />
                    <h2 className="font-bold text-slate-800">
                      {feature.title}
                    </h2>
                  </div>
                </BusinessCard>
              ))}
            </div>
          </div>
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
  const d = dashboardText(locale);
  const [, navigate] = useLocation();
  const search = useSearch();
  const now = useBusinessClock();
  const params = new URLSearchParams(search);
  const query = trpc.business.mine.useQuery(
    { accountId },
    { retry: false, staleTime: 0, refetchInterval: 30_000 }
  );
  // Do not render cached private tools when an ownership/session refresh fails.
  const workspace = query.isError ? undefined : query.data;
  const selected = Number(params.get("provider"));
  const owned =
    workspace?.providers.find(p => p.provider.id === selected) ??
    workspace?.providers[0];
  const requested = params.get("tab") as ProviderSection;
  const section: ProviderSection = providerSections.includes(requested)
    ? requested
    : params.has("payment")
      ? "billing"
      : !owned && selected > 0
        ? "ownership"
        : "overview";
  const go = (
    tab: ProviderSection,
    create = false,
    providerId = owned?.provider.id
  ) => {
    const next = new URLSearchParams(window.location.search);
    if (providerId !== owned?.provider.id) {
      next.delete("payment");
      next.delete("cancelled");
      next.delete("token");
      next.delete("PayerID");
    }
    next.set("tab", tab);
    if (create && (tab === "groups" || tab === "offers"))
      next.set("action", "create");
    else next.delete("action");
    if (providerId) next.set("provider", String(providerId));
    navigate(`/account/provider?${next.toString()}`);
  };
  const access = providerToolAccess(owned, verified, now);
  const active = access === "active";
  const canReadSaved = Boolean(verified && owned?.ownershipValid);
  return (
    <ProviderDashboardShell
      owned={owned}
      access={access}
      providers={workspace?.providers ?? []}
      section={section}
      onNavigate={go}
      onSelect={id => go(section, false, id)}
    >
      <PaymentReturn accountId={accountId} />
      {!verified && (
        <p className="mb-6 rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">
          {t.verify}{" "}
          <Link href="/account/settings" className="font-bold underline">
            {t.settings}
          </Link>
        </p>
      )}
      {query.isError ? (
        <div className="space-y-4">
          <BusinessError message={query.error.message} />
          <button className={businessSecondary} onClick={() => query.refetch()}>
            {t.retry}
          </button>
        </div>
      ) : !workspace ? (
        <BusinessCard>
          <p role="status">{t.loading}</p>
        </BusinessCard>
      ) : section === "ownership" ? (
        <div className="space-y-6">
          {!owned && (
            <BusinessCard className="border-beacon-200 bg-beacon-50/50">
              <h2 className="text-xl font-bold text-ink">{d.start}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {d.startHelp}
              </p>
            </BusinessCard>
          )}
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <ClaimPicker verified={verified} />
            <BusinessCard>
              <h2 className="text-lg font-bold text-ink">{t.requests}</h2>
              <div className="mt-5 space-y-5">
                {workspace.claims.length ? (
                  workspace.claims.map(claim => (
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
        </div>
      ) : section === "billing" ? (
        owned ? (
          <ProviderBilling
            key={owned.provider.id}
            accountId={accountId}
            owned={owned}
          />
        ) : (
          <div className="space-y-5">
            <ProviderAccessNotice access={access} onNavigate={go} />
            <BusinessCard>
              <h2 className="text-xl font-bold text-ink">{t.plan}</h2>
              <BusinessPricing />
              <PaymentMethods />
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {t.planHelp}
              </p>
            </BusinessCard>
          </div>
        )
      ) : section === "overview" ? (
        active && owned ? (
          <ProviderOverview
            key={owned.provider.id}
            accountId={accountId}
            owned={owned}
            active={active}
            onNavigate={go}
          />
        ) : (
          <ProviderFreeOverview access={access} onNavigate={go} />
        )
      ) : isPremiumProviderSection(section) ? (
        <div key={owned?.provider.id ?? "preview"} className="space-y-6">
          {!active && (
            <ProviderFeaturePreview
              feature={section}
              access={access}
              providerName={owned?.provider.name}
              onNavigate={go}
            />
          )}
          {canReadSaved && owned && (
            <>
              {section === "vip" && (
                <ProviderVip
                  accountId={accountId}
                  owned={owned}
                  active={active}
                  savedOnly={!active}
                />
              )}
              {section === "analytics" && active && (
                <BusinessAnalytics
                  accountId={accountId}
                  providerId={owned.provider.id}
                />
              )}
              {section === "groups" && (
                <ProviderGroups
                  accountId={accountId}
                  provider={owned.provider}
                  active={active}
                  savedOnly={!active}
                  startCreating={params.get("action") === "create"}
                />
              )}
              {section === "offers" && (
                <ProviderPromotions
                  accountId={accountId}
                  providerId={owned.provider.id}
                  active={active}
                  savedOnly={!active}
                  startCreating={params.get("action") === "create"}
                />
              )}
            </>
          )}
        </div>
      ) : null}
    </ProviderDashboardShell>
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
      <h2 className="text-lg font-bold text-ink">{t.claim}</h2>
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
function ProviderBilling({
  accountId,
  owned,
}: {
  accountId: number;
  owned: Owned;
}) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const now = useBusinessClock();
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <BusinessCard>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-ink">{t.plan}</h2>
          <BusinessStatus value={planState(owned.subscription, now)} />
        </div>
        <BusinessPricing
          firstActivatedAt={owned.subscription.firstActivatedAt}
        />
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
          className={`${businessSecondary} mt-5`}
          href={`mailto:soporte@providerbeacon.com?subject=${encodeURIComponent(`Provider plan: ${owned.provider.name}`)}`}
        >
          {dashboardText(locale).support}
        </a>
      </BusinessCard>
      <BusinessCard>
        <h2 className="text-xl font-bold text-ink">
          {dashboardText(locale).billing}
        </h2>
        {owned.ownershipValid ? (
          <ProviderCheckout
            accountId={accountId}
            providerId={owned.provider.id}
            showHistory
          />
        ) : (
          <p role="alert" className="mt-4 text-sm leading-7 text-amber-900">
            {t.ownerChanged}
          </p>
        )}
      </BusinessCard>
    </div>
  );
}
function ProviderGroups({
  accountId,
  provider,
  active,
  startCreating = false,
  savedOnly = false,
}: {
  accountId: number;
  provider: Owned["provider"];
  active: boolean;
  startCreating?: boolean;
  savedOnly?: boolean;
}) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const utils = trpc.useUtils();
  const query = trpc.business.groups.mine.useQuery(
    { accountId, providerId: provider.id },
    { retry: false, staleTime: 0 }
  );
  const [editing, setEditing] = useState<OwnedGroup | "new" | null>(
    startCreating && active ? "new" : null
  );
  const refresh = async () => {
    setEditing(null);
    await Promise.all([
      utils.business.groups.mine.invalidate(),
      utils.business.overview.invalidate(),
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
  if (savedOnly && !query.isError && !query.data?.length) return null;
  return (
    <BusinessCard>
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-xl font-bold text-ink">{t.groups}</h2>
        <button
          className={businessPrimary}
          disabled={
            !active || !query.data || query.isError || query.data.length >= 20
          }
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
      {active &&
        !query.isError &&
        editing &&
        (editing !== "new" || (query.data && query.data.length < 20)) && (
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
                  ? communityError(
                      (submit.error ?? edit.error)!.message,
                      locale
                    )
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
                className="mt-2 block break-all text-xs text-beacon-700 underline"
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
  startCreating = false,
  savedOnly = false,
}: {
  accountId: number;
  providerId: number;
  active: boolean;
  startCreating?: boolean;
  savedOnly?: boolean;
}) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const utils = trpc.useUtils();
  const now = useBusinessClock();
  const [cursor, setCursor] = useState<number>();
  const [editing, setEditing] = useState<Promotion | "new" | null>(
    startCreating && active ? "new" : null
  );
  const query = trpc.business.promotions.mine.useQuery(
    { accountId, providerId, cursor },
    { retry: false, staleTime: 0 }
  );
  const refresh = async () => {
    setEditing(null);
    setCursor(undefined);
    await Promise.all([
      utils.business.promotions.mine.invalidate(),
      utils.business.overview.invalidate(),
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
  if (savedOnly && !query.isError && !cursor && !query.data?.items.length)
    return null;
  return (
    <BusinessCard>
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-xl font-bold text-ink">{t.myOffers}</h2>
        <button
          className={businessPrimary}
          disabled={
            !active ||
            query.isError ||
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
        <p className="mt-3 text-xs font-semibold text-beacon-700">
          {t.usage}:{" "}
          <bdi>
            {formatNumber(locale, query.data.usage.used)} /{" "}
            {formatNumber(locale, query.data.usage.limit)}
          </bdi>
        </p>
      )}
      {active &&
        !query.isError &&
        editing &&
        (editing !== "new" ||
          (query.data && query.data.usage.used < query.data.usage.limit)) && (
          <PromotionForm
            key={
              editing === "new" ? "new" : `${editing.id}:${editing.revision}`
            }
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
