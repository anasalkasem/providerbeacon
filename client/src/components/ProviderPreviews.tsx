import {
  ArrowUpRight,
  BarChart3,
  Diamond,
  Eye,
  ExternalLink,
  Image,
  LockKeyhole,
  Send,
  ShieldCheck,
  Tag,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { businessText } from "@/i18n/providerBusiness";
import { dashboardText } from "@/i18n/providerDashboard";
import { providerAnalyticsCopy } from "@/i18n/providerAnalytics";
import { previewText } from "@/i18n/providerPreviews";
import { vipText } from "@/i18n/providerVip";
import {
  premiumProviderSections,
  type PremiumProviderSection,
  type ProviderToolAccess,
} from "@/lib/providerToolAccess";
import type { DashboardNavigate } from "./ProviderDashboard";
import { BusinessCard, businessPrimary } from "./BusinessUi";

function useFeatures() {
  const { locale } = useLocale();
  const p = previewText(locale),
    b = businessText(locale);
  return {
    analytics: {
      icon: BarChart3,
      label: b.analytics,
      title: p.analyticsBenefit,
      help: p.analyticsHelp,
      note: p.analyticsNote,
    },
    vip: {
      icon: Diamond,
      label: vipText(locale).title,
      title: p.vipBenefit,
      help: p.vipHelp,
      note: p.vipNote,
    },
    groups: {
      icon: Users,
      label: b.groups,
      title: p.groupsBenefit,
      help: p.groupsHelp,
      note: p.groupsNote,
    },
    offers: {
      icon: Tag,
      label: b.myOffers,
      title: p.offersBenefit,
      help: p.offersHelp,
      note: p.offersNote,
    },
  };
}

export function ProviderAccessNotice({
  access,
  onNavigate,
}: {
  access: ProviderToolAccess;
  onNavigate: DashboardNavigate;
}) {
  const { locale } = useLocale();
  const p = previewText(locale),
    d = dashboardText(locale);
  if (access === "active") return null;
  const message = {
    email: { title: p.emailTitle, help: p.emailHelp, action: d.settings },
    ownership: { title: d.start, help: p.ownershipHelp, action: d.ownership },
    inactive: { title: d.unlock, help: d.unlockHelp, action: p.activate },
    expired: { title: p.expiredTitle, help: p.expiredHelp, action: p.renew },
    suspended: { title: p.pausedTitle, help: p.pausedHelp, action: d.support },
    scheduled: {
      title: p.scheduledTitle,
      help: p.scheduledHelp,
      action: d.managePlan,
    },
  }[access];
  return (
    <BusinessCard className="border-input bg-secondary/60">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          <span
            className="rounded-xl bg-card p-3 text-foreground"
            aria-hidden="true"
          >
            {access === "ownership" || access === "email" ? (
              <ShieldCheck className="size-5" />
            ) : (
              <LockKeyhole className="size-5" />
            )}
          </span>
          <div className="max-w-2xl">
            <h2 className="font-bold text-foreground">{message.title}</h2>
            <p className="mt-2 text-sm leading-7 text-secondary-foreground">
              {message.help}
            </p>
          </div>
        </div>
        {access === "email" ? (
          <Link className={businessPrimary} href="/account/settings">
            {message.action}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        ) : access === "suspended" ? (
          <a
            className={businessPrimary}
            href="mailto:soporte@providerbeacon.com"
          >
            {message.action}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        ) : (
          <button
            className={businessPrimary}
            onClick={() =>
              onNavigate(access === "ownership" ? "ownership" : "billing")
            }
          >
            {message.action}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </BusinessCard>
  );
}

// These previews contain no private queries, invented metrics or live ad tracking.
export function ProviderFeaturePreview({
  feature,
  access,
  providerName,
  onNavigate,
}: {
  feature: PremiumProviderSection;
  access: ProviderToolAccess;
  providerName?: string;
  onNavigate: DashboardNavigate;
}) {
  const { locale } = useLocale();
  const p = previewText(locale),
    a = providerAnalyticsCopy[locale];
  const f = useFeatures()[feature];
  return (
    <section className="space-y-5" aria-label={`${f.label}: ${p.preview}`}>
      <BusinessCard className="overflow-hidden">
        <div className="grid items-center gap-7 xl:grid-cols-[1fr_1.1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
              <LockKeyhole className="size-3.5 text-brand" aria-hidden="true" />
              {p.paid}
            </span>
            <h2 className="mt-5 max-w-xl text-2xl font-extrabold leading-snug text-foreground">
              {f.title}
            </h2>
            <p className="mt-3 max-w-xl text-base leading-8 text-secondary-foreground">
              {f.help}
            </p>
            <p className="mt-5 border-s-2 border-input ps-3 text-sm leading-7 text-muted-foreground">
              {f.note}
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-border bg-background p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
              <span>{p.preview}</span>
              <f.icon className="size-4" aria-hidden="true" />
            </div>
            {feature === "analytics" ? (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { icon: Eye, label: a.views },
                    { icon: ExternalLink, label: a.website },
                    { icon: Send, label: a.telegram },
                  ].map(metric => (
                    <div
                      key={metric.label}
                      className="rounded-xl border border-border bg-card p-3"
                    >
                      <metric.icon
                        className="mb-3 size-4 text-foreground"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-secondary-foreground">{metric.label}</p>
                      <p
                        className="mt-2 text-2xl font-bold text-muted-foreground"
                        aria-label={p.noData}
                      >
                        —
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-xl border border-dashed border-input px-4 py-5">
                  <p className="text-sm font-bold text-foreground">{a.trend}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {a.days7} · {a.days30} · {a.days90}
                  </p>
                  <p className="mt-4 flex items-center gap-2 text-sm text-foreground">
                    <LockKeyhole className="size-4" aria-hidden="true" />
                    {p.noData}
                  </p>
                </div>
              </>
            ) : feature === "vip" ? (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex min-h-36 items-center justify-center gap-3 bg-ink px-5 py-8 text-brand">
                  <Image className="size-7" aria-hidden="true" />
                  <span className="text-sm font-semibold">{p.cover}</span>
                </div>
                <div className="p-4">
                  <p dir="auto" className="font-bold text-foreground">
                    {providerName ?? p.yourProvider}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {p.reviewFlow}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-5">
                <f.icon className="size-8 text-foreground" aria-hidden="true" />
                <p className="mt-4 font-bold text-foreground">{f.label}</p>
                <p className="mt-3 text-sm leading-7 text-secondary-foreground">
                  {feature === "groups" ? p.groupDetails : p.offerDetails}
                </p>
                <p className="mt-5 border-t border-border pt-4 text-sm leading-7 text-foreground">
                  {p.reviewFlow}
                </p>
              </div>
            )}
            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              {p.previewHelp}
            </p>
          </div>
        </div>
      </BusinessCard>
      <ProviderAccessNotice access={access} onNavigate={onNavigate} />
    </section>
  );
}

export function ProviderFreeOverview({
  access,
  onNavigate,
}: {
  access: ProviderToolAccess;
  onNavigate: DashboardNavigate;
}) {
  const { locale } = useLocale();
  const p = previewText(locale),
    features = useFeatures();
  return (
    <div className="space-y-7">
      <ProviderAccessNotice access={access} onNavigate={onNavigate} />
      <section aria-labelledby="provider-explore-title">
        <h2 id="provider-explore-title" className="text-xl font-bold text-foreground">
          {p.explore}
        </h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{p.exploreHelp}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {premiumProviderSections.map(section => {
            const f = features[section];
            return (
              <button
                key={section}
                onClick={() => onNavigate(section)}
                className="group flex flex-col items-start rounded-2xl border border-border bg-card p-5 text-start transition-colors hover:border-input focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-6"
              >
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="rounded-xl bg-ink p-3 text-brand">
                    <f.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <LockKeyhole className="size-3.5" aria-hidden="true" />
                    {p.paid}
                  </span>
                </span>
                <span className="mt-4 text-lg font-bold text-foreground">
                  {f.label}
                </span>
                <span className="mb-5 mt-2 text-sm leading-7 text-muted-foreground">
                  {f.help}
                </span>
                <span className="mt-auto inline-flex items-center gap-2 text-sm font-bold text-foreground">
                  {p.seePreview}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
