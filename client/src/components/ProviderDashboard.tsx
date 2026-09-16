import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  Menu,
  Plus,
  Settings2,
  ShieldCheck,
  Tag,
  Users,
  X,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { BUSINESS_DAY_MS, planState } from "../../../shared/providerBusiness";
import { localeNames, useLocale, type Locale } from "@/contexts/LocaleContext";
import { businessText } from "@/i18n/providerBusiness";
import { dashboardText } from "@/i18n/providerDashboard";
import { formatNumber } from "@/i18n/messages";
import { trpc } from "@/lib/trpc";
import { Brand } from "./SiteChrome";
import { ProviderLogo } from "./ProviderMedia";
import { BusinessAnalytics } from "./BusinessAnalytics";
import {
  BusinessCard,
  BusinessError,
  BusinessStatus,
  businessPrimary,
  businessSecondary,
  useBusinessClock,
} from "./BusinessUi";

export type ProviderWorkspaceData =
  inferRouterOutputs<AppRouter>["business"]["mine"];
export type OwnedProvider = ProviderWorkspaceData["providers"][number];
export const providerSections = [
  "overview",
  "analytics",
  "groups",
  "offers",
  "billing",
  "ownership",
] as const;
export type ProviderSection = (typeof providerSections)[number];
export type DashboardNavigate = (
  section: ProviderSection,
  create?: boolean
) => void;

export function ProviderDashboardShell({
  owned,
  providers,
  section,
  onNavigate,
  onSelect,
  children,
}: {
  owned?: OwnedProvider;
  providers: OwnedProvider[];
  section: ProviderSection;
  onNavigate: DashboardNavigate;
  onSelect: (id: number) => void;
  children: ReactNode;
}) {
  const { locale, setLocale } = useLocale();
  const t = dashboardText(locale);
  const b = businessText(locale);
  const now = useBusinessClock();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const lastSection = useRef(`${section}:${owned?.provider.id}`);
  const items = [
    {
      id: "overview",
      label: t.overview,
      icon: LayoutDashboard,
      help: t.overviewHelp,
    },
    {
      id: "analytics",
      label: b.analytics,
      icon: BarChart3,
      help: t.analyticsHelp,
    },
    { id: "groups", label: b.groups, icon: Users, help: b.groupHelp },
    { id: "offers", label: b.myOffers, icon: Tag, help: b.offerHelp },
    { id: "billing", label: t.billing, icon: CreditCard, help: t.billingHelp },
    {
      id: "ownership",
      label: t.ownership,
      icon: ShieldCheck,
      help: t.ownershipHelp,
    },
  ] as const;
  const current = items.find(item => item.id === section)!;
  useEffect(() => {
    const next = `${section}:${owned?.provider.id}`;
    if (lastSection.current !== next) {
      setMobileOpen(false);
      heading.current?.focus();
      lastSection.current = next;
    }
  }, [section, owned?.provider.id]);
  const date = (value: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value));
  return (
    <div
      className="provider-dashboard min-h-screen bg-background text-slate-900"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <header className="workspace-header sticky top-0 z-40">
        <a href="#main-content" className="skip-link">
          {current.label}
        </a>
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Brand compact />
            <span className="hidden border-s border-slate-200 ps-4 text-sm text-slate-500 xl:block">
              {t.workspace}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/providers"
              className="hidden items-center gap-2 text-sm font-semibold text-slate-600 md:flex"
            >
              {t.browse}
              <ArrowUpRight className="size-4" />
            </Link>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
              <Globe2 className="hidden size-4 sm:block" aria-hidden="true" />
              <select
                aria-label={t.language}
                value={locale}
                onChange={e => setLocale(e.target.value as Locale)}
                className="max-w-24 rounded-lg bg-transparent py-2 focus-visible:outline-offset-0"
              >
                {(Object.keys(localeNames) as Locale[]).map(value => (
                  <option key={value} value={value}>
                    {localeNames[value]}
                  </option>
                ))}
              </select>
            </label>
            <button
              ref={menuButton}
              aria-label={mobileOpen ? t.closeMenu : t.menu}
              aria-expanded={mobileOpen}
              aria-controls="provider-navigation"
              className="touch-target grid place-items-center rounded-xl border border-slate-200 lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="size-5" />
              ) : (
                <Menu className="size-5" />
              )}
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[244px_minmax(0,1fr)]">
        <aside
          id="provider-navigation"
          className={`${mobileOpen ? "block" : "hidden"} provider-sidebar border-b lg:sticky lg:top-[72px] lg:flex lg:h-[calc(100dvh-72px)] lg:flex-col lg:overflow-y-auto lg:border-e lg:border-b-0`}
          onKeyDown={e => {
            if (e.key === "Escape") {
              setMobileOpen(false);
              menuButton.current?.focus();
            }
          }}
        >
          <div className="border-b border-sidebar-border p-5">
            <div className="flex items-center gap-3">
              {owned ? (
                <ProviderLogo
                  src={owned.provider.logoUrl}
                  name={owned.provider.name}
                  initials={owned.provider.name.slice(0, 2).toUpperCase()}
                />
              ) : (
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-ink"
                  aria-hidden="true"
                >
                  <ShieldCheck className="size-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                  {t.workspace}
                </p>
                <p
                  dir="auto"
                  className="mt-1 truncate text-sm font-bold text-sidebar-foreground"
                >
                  {owned?.provider.name ?? t.start}
                </p>
              </div>
            </div>
            {providers.length > 1 && (
              <select
                aria-label={b.provider}
                className="mt-4 w-full rounded-lg border border-sidebar-border bg-sidebar-accent p-2 text-sm"
                value={owned?.provider.id}
                onChange={e => onSelect(Number(e.target.value))}
              >
                {providers.map(p => (
                  <option key={p.provider.id} value={p.provider.id}>
                    {p.provider.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <nav className="grid gap-1 p-3" aria-label={t.menu}>
            <p className="px-3 pb-2 pt-3 text-[11px] font-bold uppercase tracking-wider text-slate-300">
              {t.manage}
            </p>
            {items
              .filter(
                item =>
                  owned || item.id === "ownership" || item.id === "billing"
              )
              .map(item => (
                <button
                  key={item.id}
                  aria-current={section === item.id ? "page" : undefined}
                  onClick={() => {
                    setMobileOpen(false);
                    onNavigate(item.id);
                  }}
                  className="provider-nav-item flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold transition-colors"
                >
                  <item.icon
                    className="size-[18px] shrink-0"
                    aria-hidden="true"
                  />
                  {item.label}
                </button>
              ))}
            <Link
              href="/account/settings"
              className="mt-3 flex min-h-12 items-center gap-3 rounded-xl border-t border-sidebar-border px-3 py-3 text-sm font-semibold text-slate-300 hover:bg-sidebar-accent"
            >
              <Settings2 className="size-[18px]" />
              {t.settings}
            </Link>
          </nav>
          <div className="mt-auto space-y-5 p-5">
            {owned && (
              <div className="provider-sidebar-plan rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-300">
                    {t.planStatus}
                  </span>
                  <BusinessStatus value={planState(owned.subscription, now)} />
                </div>
                {owned.subscription.endsAt && (
                  <p className="mt-3 text-xs leading-6 text-slate-300">
                    {b.endsAt}: <bdi>{date(owned.subscription.endsAt)}</bdi>
                  </p>
                )}
                <button
                  onClick={() => onNavigate("billing")}
                  className="mt-3 text-xs font-bold text-brand underline underline-offset-4"
                >
                  {t.managePlan}
                </button>
              </div>
            )}
            <a
              href="mailto:soporte@providerbeacon.com"
              className="flex items-center gap-3 text-slate-300"
            >
              <LifeBuoy className="size-5 shrink-0" />
              <span className="text-xs leading-5">
                <strong className="block text-sidebar-foreground">{t.support}</strong>
                {t.supportHelp}
              </span>
            </a>
          </div>
        </aside>
        <main id="main-content" className="min-w-0 px-4 py-6 sm:px-6 lg:p-8">
          <header className="workspace-heading mb-7 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
                <span>{t.workspace}</span>
                <span aria-hidden="true">/</span>
                <bdi className="max-w-56 truncate">
                  {owned?.provider.name ?? b.title}
                </bdi>
              </p>
              <h1
                ref={heading}
                tabIndex={-1}
                className="scroll-mt-24 text-2xl font-extrabold tracking-tight text-ink outline-none sm:text-3xl"
              >
                {current.label}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
                {current.help}
              </p>
            </div>
            {owned && (
              <Link
                className={`${businessSecondary} shrink-0`}
                href={`/providers/${owned.provider.slug}`}
              >
                {t.viewProfile}
                <ExternalLink className="size-4" />
              </Link>
            )}
          </header>
          {children}
          <footer className="mt-10 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-400">
            <span dir="ltr">© {new Date().getFullYear()} ProviderBeacon</span>
            <Link href="/privacy" className="hover:text-slate-600">
              {t.privacy}
            </Link>
          </footer>
        </main>
      </div>
    </div>
  );
}

export function ProviderPlanLock({
  onNavigate,
}: {
  onNavigate: DashboardNavigate;
}) {
  const { locale } = useLocale();
  const t = dashboardText(locale);
  return (
    <BusinessCard className="border-beacon-200 bg-beacon-50/50">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <span className="rounded-xl bg-white p-3 text-beacon-700">
            <LockKeyhole className="size-5" />
          </span>
          <div className="max-w-xl">
            <h2 className="font-bold text-ink">{t.unlock}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              {t.unlockHelp}
            </p>
          </div>
        </div>
        <button
          className={businessPrimary}
          onClick={() => onNavigate("billing")}
        >
          {t.managePlan}
          <ArrowUpRight className="size-4" />
        </button>
      </div>
    </BusinessCard>
  );
}

export function ProviderOverview({
  accountId,
  owned,
  active,
  onNavigate,
}: {
  accountId: number;
  owned: OwnedProvider;
  active: boolean;
  onNavigate: DashboardNavigate;
}) {
  const { locale } = useLocale();
  const t = dashboardText(locale);
  const b = businessText(locale);
  const now = useBusinessClock();
  const query = trpc.business.overview.useQuery(
    { accountId, providerId: owned.provider.id },
    { retry: false, staleTime: 0, refetchInterval: 30_000 }
  );
  const data = query.isError ? undefined : query.data;
  const pending = data ? data.groups.pending + data.offers.pending : 0;
  const rejected = data ? data.groups.rejected + data.offers.rejected : 0;
  const renewal =
    active &&
    owned.subscription.endsAt &&
    new Date(owned.subscription.endsAt).getTime() <= now + 7 * BUSINESS_DAY_MS;
  const alerts: {
    key: string;
    title: string;
    body: string;
    target: ProviderSection;
    action: string;
  }[] = [];
  if (renewal)
    alerts.push({
      key: "renew",
      title: t.renewSoon,
      body: t.renewHelp,
      target: "billing",
      action: t.managePlan,
    });
  if (data?.offers.nextExpiry && active)
    alerts.push({
      key: "expiry",
      title: t.expiring,
      body: `${data.offers.nextExpiry.title} · ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(data.offers.nextExpiry.endsAt))}`,
      target: "offers",
      action: b.myOffers,
    });
  if (rejected)
    alerts.push({
      key: "rejected",
      title: t.rejected,
      body: t.rejectedHelp,
      target: data!.groups.rejected ? "groups" : "offers",
      action: t.details,
    });
  if (pending)
    alerts.push({
      key: "review",
      title: t.reviewPending,
      body: t.reviewPendingHelp,
      target: data!.groups.pending ? "groups" : "offers",
      action: t.details,
    });
  if (data && active && !data.groups.total)
    alerts.push({
      key: "groups",
      title: t.noGroups,
      body: t.noGroupsHelp,
      target: "groups",
      action: b.addGroup,
    });
  if (data && active && !data.offers.total)
    alerts.push({
      key: "offers",
      title: t.noOffers,
      body: t.noOffersHelp,
      target: "offers",
      action: b.newOffer,
    });
  return (
    <div className="space-y-6">
      {!active && <ProviderPlanLock onNavigate={onNavigate} />}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0 space-y-6">
          {active && (
            <BusinessAnalytics
              accountId={accountId}
              providerId={owned.provider.id}
              compact
            />
          )}
          {query.isError ? (
            <div className="space-y-3">
              <BusinessError message={query.error.message} />
              <button
                className={businessSecondary}
                onClick={() => query.refetch()}
              >
                {b.retry}
              </button>
            </div>
          ) : !data ? (
            <BusinessCard>
              <p role="status">{b.loading}</p>
            </BusinessCard>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: t.liveGroups,
                    count: active ? data.groups.live : 0,
                    icon: Users,
                    target: "groups",
                    help: t.currentVisibility,
                  },
                  {
                    label: t.liveOffers,
                    count: active ? data.offers.live : 0,
                    icon: Tag,
                    target: "offers",
                    help: t.currentVisibility,
                  },
                  {
                    label: t.review,
                    count: pending,
                    icon: Clock3,
                    target: data.groups.pending ? "groups" : "offers",
                    help: t.reviewHelp,
                  },
                ].map(item => (
                  <button
                    key={item.label}
                    className="beacon-metric p-5 text-start transition-colors hover:border-beacon-500"
                    onClick={() => onNavigate(item.target as ProviderSection)}
                  >
                    <span className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                      {item.label}
                      <item.icon className="size-4 text-beacon-600" />
                    </span>
                    <bdi className="mt-3 block text-3xl font-extrabold text-ink">
                      {formatNumber(locale, item.count)}
                    </bdi>
                    <span className="mt-2 block text-xs leading-5 text-slate-500">
                      {item.help}
                    </span>
                  </button>
                ))}
              </div>
              <BusinessCard>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-bold text-ink">{t.attention}</h2>
                  {alerts.length > 0 && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                      {formatNumber(locale, alerts.length)}
                    </span>
                  )}
                </div>
                <div className="mt-4 divide-y divide-slate-100">
                  {alerts.length ? (
                    alerts.map(alert => (
                      <article
                        key={alert.key}
                        className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="flex min-w-0 gap-3">
                          <span className="mt-0.5 rounded-lg bg-amber-50 p-2 text-amber-700">
                            <Clock3 className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-800">
                              {alert.title}
                            </h3>
                            <p className="mt-1 break-words text-xs leading-6 text-slate-500">
                              {alert.body}
                            </p>
                          </div>
                        </div>
                        <button
                          className="shrink-0 self-start rounded-lg px-2 py-2 text-xs font-bold text-beacon-700 hover:bg-beacon-50"
                          onClick={() =>
                            onNavigate(
                              alert.target,
                              alert.key === "groups" || alert.key === "offers"
                            )
                          }
                        >
                          {alert.action}
                          <ArrowUpRight className="ms-1 inline size-3.5" />
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="flex items-start gap-3 rounded-xl bg-beacon-50 p-4">
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-beacon-600" />
                      <div>
                        <h3 className="text-sm font-bold text-beacon-900">
                          {t.clear}
                        </h3>
                        <p className="mt-1 text-xs leading-6 text-beacon-800">
                          {t.clearHelp}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </BusinessCard>
            </>
          )}
        </div>
        <div className="space-y-5">
          <BusinessCard>
            <h2 className="font-bold text-ink">{t.quickActions}</h2>
            <div className="mt-4 grid gap-3">
              <button
                className={`${businessPrimary} justify-between`}
                disabled={
                  !active || !data || data.usage.used >= data.usage.limit
                }
                onClick={() => onNavigate("offers", true)}
              >
                {b.newOffer}
                <Plus className="size-4" />
              </button>
              <button
                className={`${businessSecondary} justify-between`}
                disabled={!active || !data || data.groups.total >= 20}
                onClick={() => onNavigate("groups", true)}
              >
                {b.addGroup}
                <Plus className="size-4" />
              </button>
              <Link
                className="flex items-center justify-between gap-2 rounded-xl px-1 py-2 text-sm font-semibold text-slate-600 hover:text-beacon-700"
                href={`/providers/${owned.provider.slug}`}
              >
                {t.viewProfile}
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </BusinessCard>
          {data && (
            <BusinessCard>
              <div className="flex items-center gap-2">
                <Tag className="size-4 text-beacon-600" />
                <h2 className="text-sm font-bold text-ink">
                  {t.monthlyOffers}
                </h2>
              </div>
              <p className="mt-5 text-3xl font-extrabold text-ink">
                <bdi>
                  {formatNumber(locale, data.usage.used)}{" "}
                  <span className="text-lg font-medium text-slate-400">
                    / {formatNumber(locale, data.usage.limit)}
                  </span>
                </bdi>
              </p>
              <p className="mt-1 text-xs text-slate-500">{t.used}</p>
              <progress
                aria-label={t.monthlyOffers}
                value={Math.min(data.usage.used, data.usage.limit)}
                max={data.usage.limit}
                className="provider-offer-progress mt-4 h-1.5 w-full overflow-hidden rounded-full"
              />
              <p className="mt-4 text-xs leading-6 text-slate-500">
                {t.allowanceHelp}
              </p>
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                {t.resets}:{" "}
                <bdi>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }).format(new Date(data.usage.resetsAt))}
                </bdi>{" "}
                UTC
              </p>
            </BusinessCard>
          )}
          <div className="rounded-2xl bg-ink p-5 text-white">
            <ShieldCheck className="size-6 text-beacon-300" />
            <h2 className="mt-3 font-bold">{active ? t.ready : t.unlock}</h2>
            <p className="mt-2 text-xs leading-6 text-slate-300">{b.planHelp}</p>
            <button
              onClick={() => onNavigate("billing")}
              className="mt-4 flex items-center gap-2 text-xs font-bold text-beacon-200"
            >
              {t.managePlan}
              <ArrowUpRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
