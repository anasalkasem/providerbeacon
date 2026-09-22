import { useState, type MouseEvent } from "react";
import { ArrowRight, Search, Scale } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Provider } from "@/data/marketplace";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { useLocale } from "@/contexts/LocaleContext";
import { homeDiscoveryCopy } from "@/i18n/homeDiscovery";
import { localizeData } from "@/i18n/messages";
import { vipText } from "@/i18n/providerVip";
import { trpc } from "@/lib/trpc";
import { trackVipEvent, useVipImpression } from "@/lib/vipAnalytics";
import { platforms, serviceTypes } from "../../../shared/serviceReview";
import { publicProfileUrl } from "../../../shared/providerProfile";
import { ProviderLogo } from "./ProviderMedia";
import { ProviderLogoStrip } from "./ProviderLogoStrip";
import { useBusinessClock } from "./BusinessUi";
import type { VipCardData } from "./VipCard";
import "./home-discovery.css";

function ProviderAlbum({
  provider,
  promotion,
}: {
  provider: Provider;
  promotion?: VipCardData;
}) {
  const { locale } = useLocale();
  const t = homeDiscoveryCopy[locale];
  const vip = vipText(locale);
  const [failed, setFailed] = useState<string[]>([]);
  const ref = useVipImpression(
    promotion?.providerId ?? 0,
    promotion?.revision ?? 0,
    !!promotion
  );
  const cover = [
    promotion?.coverUrl,
    publicProfileUrl(provider.websitePreviewUrl),
  ].find(src => src && !failed.includes(src));
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      promotion &&
      event.isTrusted &&
      !event.defaultPrevented &&
      (event.type === "auxclick" ? event.button === 1 : event.button === 0)
    )
      trackVipEvent(promotion.providerId, promotion.revision, "click");
  };
  return (
    <article
      ref={ref}
      className="home-provider-album"
      aria-label={provider.name}
    >
      <Link
        href={"/providers/" + provider.slug}
        className="home-album-link"
        onClick={click}
        onAuxClick={click}
        aria-label={t.view + " · " + provider.name}
      >
        <div className="home-album-cover">
          {cover ? (
            <img
              src={cover}
              alt={t.cover + " · " + provider.name}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className={
                promotion?.coverUrl === cover
                  ? "home-album-poster"
                  : "home-album-preview"
              }
              onError={() => setFailed(current => [...current, cover])}
            />
          ) : (
            <ProviderLogo
              src={provider.logoUrl}
              name={provider.name}
              initials={provider.initials}
              className="home-album-mark"
            />
          )}
        </div>
        <div className="home-album-info">
          <div className="home-album-identity">
            <ProviderLogo
              src={provider.logoUrl}
              name={provider.name}
              initials={provider.initials}
              className="home-album-avatar"
            />
            <h3 dir="auto">{provider.name}</h3>
          </div>
          <p className="home-album-count">
            <bdi>{provider.activeServicesCount.toLocaleString(locale)}</bdi>{" "}
            {t.services}
          </p>
          {promotion && (
            <p className="home-album-placement">
              {promotion.placement === "complimentary"
                ? vip.complimentary
                : vip.paid}
            </p>
          )}
          <span className="home-album-action">
            {t.view}
            <ArrowRight aria-hidden="true" className="rtl:rotate-180" />
          </span>
        </div>
      </Link>
    </article>
  );
}

export default function HomeDiscovery() {
  const { locale } = useLocale();
  const t = homeDiscoveryCopy[locale];
  const { providers, source, isLoading, retry, pagination } =
    useMarketplaceData();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const now = useBusinessClock();
  const promotions = trpc.business.vip.list.useQuery(
    { page: 1 },
    { retry: false, staleTime: 30_000, refetchInterval: 60_000 }
  );
  const cards =
    source === "database" && !isLoading
      ? Array.from(
          new Map(providers.map(provider => [provider.id, provider])).values()
        ).slice(0, 16)
      : [];
  const ads = new Map(
    (promotions.isError ? [] : (promotions.data?.items ?? []))
      .filter(card => new Date(card.endsAt).getTime() > now)
      .map(card => ["provider-" + card.providerId, card])
  );
  const submit = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (platform) params.set("platform", platform);
    if (category) params.set("category", category);
    navigate("/services" + (params.size ? "?" + params.toString() : ""));
  };
  return (
    <div className="provider-home container">
      <header className="home-discovery-intro">
        <p className="home-eyebrow" dir="ltr">
          PROVIDERBEACON
        </p>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </header>

      <section
        className="home-request-panel"
        aria-labelledby="home-request-title"
      >
        <div className="home-request-heading">
          <Scale aria-hidden="true" />
          <div>
            <h2 id="home-request-title">{t.searchTitle}</h2>
            <p>{t.searchHint}</p>
          </div>
        </div>
        <form
          className="home-request-form"
          role="search"
          onSubmit={event => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="home-service-field home-service-query">
            <span>{t.request}</span>
            <span className="home-request-input">
              <Search aria-hidden="true" />
              <input
                type="search"
                maxLength={100}
                value={query}
                onChange={event => setQuery(event.target.value)}
                dir={query ? "auto" : locale === "ar" ? "rtl" : "ltr"}
                placeholder={t.placeholder}
              />
            </span>
          </label>
          <label className="home-service-field">
            <span>{t.platform}</span>
            <select
              value={platform}
              onChange={event => setPlatform(event.target.value)}
            >
              <option value="">{t.allPlatforms}</option>
              {platforms
                .filter(value => value !== "Unknown")
                .map(value => (
                  <option key={value} value={value}>
                    {value === "Twitter"
                      ? "X (Twitter)"
                      : localizeData(locale, value)}
                  </option>
                ))}
            </select>
          </label>
          <label className="home-service-field">
            <span>{t.serviceType}</span>
            <select
              value={category}
              onChange={event => setCategory(event.target.value)}
            >
              <option value="">{t.allServiceTypes}</option>
              {serviceTypes
                .filter(value =>
                  [
                    "Followers",
                    "Views",
                    "Likes",
                    "Comments",
                    "Shares",
                    "Subscribers",
                  ].includes(value)
                )
                .map(value => (
                  <option key={value} value={value}>
                    {localizeData(locale, value)}
                  </option>
                ))}
            </select>
          </label>
          <button type="submit" className="beacon-button">
            {t.submit}
            <ArrowRight aria-hidden="true" className="rtl:rotate-180" />
          </button>
        </form>
        <div className="home-request-examples">
          <p>{t.comparisonHint}</p>
          <Link href="/find">{t.describeRequest}</Link>
        </div>
      </section>

      <ProviderLogoStrip providers={cards} />

      <section
        className="home-albums"
        aria-labelledby="home-albums-title"
        aria-busy={isLoading}
      >
        <div className="home-albums-heading">
          <div>
            <h2 id="home-albums-title">{t.albums}</h2>
            <p>{t.albumsHint}</p>
          </div>
          <Link href="/providers">
            {t.allProviders}
            <ArrowRight aria-hidden="true" className="rtl:rotate-180" />
          </Link>
        </div>
        {isLoading ? (
          <p className="home-provider-state" role="status">
            {t.loading}
          </p>
        ) : source !== "database" ? (
          <div className="home-provider-state" role="alert">
            <p>{t.unavailable}</p>
            <button type="button" onClick={retry}>
              {t.retry}
            </button>
          </div>
        ) : !cards.length ? (
          <p className="home-provider-state">{t.empty}</p>
        ) : (
          <>
            <div className="home-provider-grid">
              {cards.map(provider => (
                <ProviderAlbum
                  key={provider.id}
                  provider={provider}
                  promotion={ads.get(provider.id)}
                />
              ))}
            </div>
            <div className="home-albums-footer">
              <p>
                {t.showing} <bdi>{cards.length}</bdi>
                {pagination?.total > cards.length && (
                  <>
                    {" "}
                    {t.of} <bdi>{pagination.total.toLocaleString(locale)}</bdi>
                  </>
                )}
              </p>
              <Link href="/providers">
                {t.allProviders}
                <ArrowRight aria-hidden="true" className="rtl:rotate-180" />
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
