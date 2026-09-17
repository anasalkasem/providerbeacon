import { ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { landingCopy } from "@/i18n/landing";
import { formatNumber, localizeData } from "@/i18n/messages";
import { workspaceCopy } from "@/i18n/workspace";
import { serviceName } from "./OfferEvidence";
import OfferPrice from "./OfferPrice";
import { ProviderLogo } from "./ProviderMedia";

export default function HomeComparison() {
  const { locale } = useLocale();
  const t = landingCopy[locale];
  const w = workspaceCopy[locale];
  const { services, providerFor, isLoading, source, retry } =
    useMarketplaceData();
  // The existing home catalogue query is bounded and filters out orphan offers.
  // Native prices keep their own units; no equivalence or lowest-price claim is made.
  const seenProviders = new Set<string>();
  const distinctProviders = services.filter(service => {
    if (seenProviders.has(service.providerId)) return false;
    seenProviders.add(service.providerId);
    return true;
  });
  const offers = [
    ...distinctProviders,
    ...services.filter(service => !distinctProviders.includes(service)),
  ].slice(0, 3);
  const compareHref =
    source !== "unavailable" && offers.length >= 2
      ? `/compare?services=${offers.map(service => service.id).join(",")}`
      : "/services";
  return (
    <section
      className="landing-comparison"
      aria-labelledby="home-comparison-title"
    >
      <div className="landing-comparison-heading">
        <h2 id="home-comparison-title">{t.comparison}</h2>
        <span className="landing-source">{t.source}</span>
      </div>
      {isLoading ? (
        <p role="status" className="py-12 text-center">
          {t.loading}
        </p>
      ) : source === "unavailable" ? (
        <div className="py-10 text-center">
          <p role="alert">{t.unavailable}</p>
          <button
            className="mt-4 rounded-lg border border-input px-5 py-2"
            onClick={retry}
          >
            {t.retry}
          </button>
        </div>
      ) : !offers.length ? (
        <p className="mx-auto max-w-xl py-10 text-center leading-8">
          {t.empty}
        </p>
      ) : (
        <div
          className="landing-comparison-scroll"
          role="region"
          aria-label={t.comparison}
          tabIndex={0}
        >
          <table className="landing-comparison-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{t.service}</span>
                </th>
                {offers.map(service => {
                  const provider = providerFor(service);
                  return (
                    <th scope="col" key={service.id}>
                      <Link
                        href={`/providers/${provider.slug}`}
                        className="inline-flex items-center justify-center gap-3"
                      >
                        <ProviderLogo
                          src={provider.logoUrl}
                          name={provider.name}
                          initials={provider.initials}
                          className="size-9 text-xs"
                        />
                        <span dir="auto">{provider.name}</span>
                        <ExternalLink
                          className="size-3.5 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{t.service}</th>
                {offers.map(service => (
                  <td key={service.id}>
                    <p
                      dir="auto"
                      className="line-clamp-3 leading-6"
                      title={serviceName(locale, service)}
                    >
                      {serviceName(locale, service)}
                    </p>
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">{t.refill}</th>
                {offers.map(service => (
                  <td key={service.id}>
                    {localizeData(locale, service.refill)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">{t.quantity}</th>
                {offers.map(service => (
                  <td key={service.id}>
                    <bdi>
                      {formatNumber(locale, service.min)} –{" "}
                      {formatNumber(locale, service.max)}
                    </bdi>
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">{t.price}</th>
                {offers.map(service => (
                  <td key={service.id}>
                    <OfferPrice service={service} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="landing-comparison-footer">
        {offers.length > 0 && source !== "unavailable" && (
          <p className="max-w-xl text-xs leading-6">{w.claims}</p>
        )}
        <Link
          href={compareHref}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-semibold"
        >
          {offers.length >= 2 && source !== "unavailable"
            ? t.compare
            : w.browse}
          <ArrowRight className="size-4 text-primary rtl:rotate-180" />
        </Link>
      </div>
    </section>
  );
}
