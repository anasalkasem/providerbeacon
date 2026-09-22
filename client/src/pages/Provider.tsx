import ProviderCatalogue from "@/components/ProviderCatalogue";
import VisitorRatings from "@/components/VisitorRatings";
import ProviderProfileHeader from "@/components/ProviderProfileHeader";
import { PublicPromotions, businessSecondary } from "@/components/BusinessUi";
import { businessText } from "@/i18n/providerBusiness";
import { providerProfileCopy } from "@/i18n/providerProfile";
import { CatalogueState } from "@/components/CatalogueState";
import { catalogueCopy, percentLabel } from "@/i18n/catalogue";
import { ScoreRing } from "@/components/Marketplace";
import { PublicLayout } from "@/components/SiteChrome";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import {
  formatNumber,
  localizeData,
  localizeDuration,
  pageCopy,
} from "@/i18n/messages";
import {
  CheckCircle2,
  Clock3,
  Flag,
  Gauge,
  MessageSquareText,
  RefreshCw,
  Star,
} from "lucide-react";
import { Link, useRoute } from "wouter";

export default function Provider() {
  const { locale } = useLocale();
  const { providerBySlug } = useMarketplaceData();
  const t = pageCopy[locale];
  const [, params] = useRoute("/providers/:slug");
  const provider = providerBySlug(params?.slug ?? "");
  if (!provider)
    return (
      <PublicLayout>
        <CatalogueState kind="providerMissing" />
      </PublicLayout>
    );
  return (
    <PublicLayout>
      <ProviderProfileHeader provider={provider} />
      <VisitorRatings
        providerId={Number(provider.id.slice(9))}
        slug={provider.slug}
      />
      <div className="container pt-5">
        <Link
          className={businessSecondary}
          href={`/account/provider?provider=${provider.id.slice(9)}`}
        >
          {businessText(locale).claim}
        </Link>
        <PublicPromotions providerId={Number(provider.id.slice(9))} />
      </div>
      {provider.apiConnected && (
        <section className="container pt-6">
          <div className="rounded-xl border border-input bg-secondary p-5">
            <p className="font-bold text-foreground">
              {locale === "ar"
                ? "كتالوج مستورد من اتصال API الفعلي"
                : "Catalogue imported through the connected API"}
            </p>
            <p className="mt-2 text-sm leading-7 text-secondary-foreground">
              {locale === "ar"
                ? "أسعار وخدمات من المصدر مباشرة. تظهر وحدة البيع عندما تتوفر بياناتها؛ يمكنك مراجعة مصدر كل عرض وتفاصيله. نشر الكتالوج لا يعني اعتماد جودة الخدمة."
                : "Prices and services directly from the provider. Sale units appear where supported by source data; each offer includes its source and details. Catalogue publication does not approve service quality."}
            </p>
          </div>
        </section>
      )}
      <section className="provider-profile-content container grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-kicker">{t.assessment}</p>
                <h2 className="mt-2 text-2xl font-extrabold text-foreground">
                  {provider.score == null
                    ? catalogueCopy[locale].insufficient
                    : t.whyEarns}{" "}
                  <bdi>{provider.score}</bdi>
                </h2>
              </div>
              <ScoreRing score={provider.score} size="lg" />
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              <Signal
                title={t.orderSuccess}
                value={percentLabel(provider.successRate)}
                icon={<Gauge />}
                width={provider.successRate}
              />
              <Signal
                title={t.userRating}
                value={provider.rating == null ? "—" : `${provider.rating}/5`}
                icon={<Star />}
                width={provider.rating == null ? null : provider.rating * 20}
              />
              <Signal
                title={t.dataFreshness}
                value={
                  provider.updatedMinutes == null
                    ? "—"
                    : `${formatNumber(locale, provider.updatedMinutes)} ${t.minutesAgo}`
                }
                icon={<RefreshCw />}
                width={null}
              />
            </div>
            <div className="mt-7 rounded-xl bg-muted p-5">
              <h3 className="font-bold text-foreground">
                {t.providerSnapshot}
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {provider.strengths.map(item => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs font-semibold text-secondary-foreground ring-1 ring-border"
                  >
                    <CheckCircle2 className="size-3.5 text-success" />
                    {localizeData(locale, item)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <ProviderCatalogue key={provider.id} provider={provider} />
        </div>
        <aside className="space-y-5">
          <div className="rounded-2xl border border-border bg-muted p-5">
            <p className="font-bold text-foreground">
              {provider.verified
                ? catalogueCopy[locale].verificationRecorded
                : catalogueCopy[locale].pendingVerification}
            </p>
            <p className="mt-3 text-sm text-secondary-foreground">
              {catalogueCopy[locale].noScore}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-extrabold text-foreground">
              {t.providerSnapshot}
            </h2>
            <div className="mt-5 grid gap-4">
              <AsideMetric
                icon={<MessageSquareText />}
                label={t.reviews}
                value={
                  provider.reviews
                    ? formatNumber(locale, provider.reviews)
                    : providerProfileCopy[locale].noReviews
                }
              />
              <AsideMetric
                icon={<Clock3 />}
                label={t.responseTime}
                value={localizeDuration(locale, provider.responseTime)}
              />
              <AsideMetric
                icon={<Gauge />}
                label={t.successRate}
                value={percentLabel(provider.successRate)}
              />
            </div>
          </div>
          <a
            href={`mailto:trust@providerbeacon.com?subject=${encodeURIComponent(`Data report: ${provider.name}`)}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-danger-muted hover:text-danger"
          >
            <Flag className="size-4" />
            {t.reportData}
          </a>
        </aside>
      </section>
    </PublicLayout>
  );
}
function Signal({
  title,
  value,
  icon,
  width,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  width: number | null;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="text-foreground [&_svg]:size-4">{icon}</span>
          {title}
        </span>
        <bdi>
          <strong>{value}</strong>
        </bdi>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-silver"
          style={{ width: `${Math.min(width ?? 0, 100)}%` }}
        />
      </div>
    </div>
  );
}
function AsideMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-foreground [&_svg]:size-4">{icon}</span>
        {label}
      </span>
      <bdi>
        <strong className="text-sm text-foreground">{value}</strong>
      </bdi>
    </div>
  );
}
