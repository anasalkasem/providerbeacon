import { useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, Check, ChevronDown, Scale } from "lucide-react";
import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import type { Provider, Service } from "@/data/marketplace";
import {
  localizeData,
  localizeDuration,
  formatNumber,
  pageCopy,
} from "@/i18n/messages";
import { formatPrice, unitLabel } from "@/i18n/pricing";
import { priceHighlightCopy } from "@/i18n/priceHighlights";
import { providerCatalogueCopy } from "@/i18n/providerCatalogue";
import { offerResultsCopy } from "@/i18n/offerResults";
import { CataloguePagination } from "./CataloguePagination";
import { FollowPrice } from "./WorkspaceActions";
import OfferEvidence, { serviceName, serviceScope } from "./OfferEvidence";
import QuoteCost from "./QuoteCost";
import OfferPrice from "./OfferPrice";
import "./provider-catalogue.css";
import "./offer-results.css";

export default function SmmOfferTable({
  services,
  selected,
  toggle,
  quantity,
  pageSize = 25,
  priceSorted = false,
}: {
  services: Service[];
  selected: Pick<Service, "id">[];
  toggle: (service: Service) => void;
  quantity?: number;
  pageSize?: number;
  priceSorted?: boolean;
}) {
  const { locale } = useLocale();
  const t = offerResultsCopy[locale];
  const catalogue = providerCatalogueCopy[locale];
  const { providerFor, pagination, isFetching } = useMarketplaceData();
  const rows = services;
  const [expanded, setExpanded] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pendingNavigation = useRef(false);
  const page = pagination?.page ?? 1;

  function revealResults() {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  function navigate() {
    pendingNavigation.current = true;
    setExpanded(null);
    revealResults();
  }
  useLayoutEffect(() => {
    if (!pendingNavigation.current || isFetching) return;
    pendingNavigation.current = false;
    revealResults();
  }, [page, services, isFetching]);

  // Keep Previous available on an empty or failed later page.
  if (!services.length && page === 1) return null;
  return (
    <section
      className="provider-catalogue offer-results"
      aria-labelledby="offer-results-title"
    >
      <div className="provider-catalogue-heading">
        <h2 id="offer-results-title" ref={heading} tabIndex={-1}>
          {t.results}
        </h2>
      </div>
      <div className="offer-results-help" id="offer-results-help">
        <p>{catalogue.help}</p>
        <details>
          <summary>{t.method}</summary>
          <p>{t.explanation}</p>
        </details>
      </div>
      <CataloguePagination onNavigate={navigate} pageSize={pageSize} />
      <div className="provider-catalogue-table-wrap" aria-busy={isFetching}>
        <table
          className="provider-catalogue-table offer-results-table"
          aria-describedby="offer-results-help"
        >
          <caption className="sr-only">{t.results}</caption>
          <colgroup>
            <col />
            <col className="offer-results-price-col" />
            <col className="offer-results-limits-col offer-results-extra" />
            <col className="offer-results-terms-col offer-results-extra" />
            <col className="offer-results-action-col" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{t.serviceProvider}</th>
              <th scope="col" aria-sort={priceSorted ? "ascending" : undefined}>
                {catalogue.price}
              </th>
              <th scope="col" className="offer-results-extra">
                {catalogue.limits}
              </th>
              <th scope="col" className="offer-results-extra">
                {t.startRefill}
              </th>
              <th scope="col" className="offer-results-action">
                {t.compare}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(service => (
              <OfferRows
                key={service.id}
                service={service}
                provider={providerFor(service)}
                quantity={quantity}
                lowest={false}
                chosen={selected.some(item => item.id === service.id)}
                selectionFull={selected.length >= 4}
                compare={() => toggle(service)}
                open={expanded === service.id}
                expand={() =>
                  setExpanded(current =>
                    current === service.id ? null : service.id
                  )
                }
              />
            ))}
          </tbody>
        </table>
      </div>
      <CataloguePagination onNavigate={navigate} pageSize={pageSize} />
    </section>
  );
}

function OfferRows({
  service,
  provider,
  quantity,
  lowest,
  chosen,
  selectionFull,
  compare,
  open,
  expand,
}: {
  service: Service;
  provider: Provider;
  quantity?: number;
  lowest: boolean;
  chosen: boolean;
  selectionFull: boolean;
  compare: () => void;
  open: boolean;
  expand: () => void;
}) {
  const { locale } = useLocale();
  const t = offerResultsCopy[locale];
  const catalogue = providerCatalogueCopy[locale];
  const pages = pageCopy[locale];
  const name = serviceName(locale, service);
  const detailsId = `offer-details-${service.id}`;
  const market =
    service.countryCode === "WW"
      ? t.worldwide
      : (service.countryCode ?? t.unspecified);
  return (
    <>
      <tr
        className="provider-catalogue-row offer-results-row"
        data-offer-id={service.id}
        data-lowest={lowest || undefined}
        data-selected={chosen || undefined}
        data-expanded={open || undefined}
      >
        <th scope="row">
          <Link
            href={`/providers/${provider.slug}`}
            className="offer-results-provider"
          >
            <bdi>{provider.name}</bdi>
          </Link>
          <button
            type="button"
            className="provider-catalogue-name offer-results-name"
            onClick={expand}
            aria-expanded={open}
            aria-controls={detailsId}
            aria-label={`${open ? catalogue.close : catalogue.details}: ${name}`}
          >
            <span dir="auto">{name}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          <div className="provider-catalogue-meta">
            {service.platform !== "Unknown" && <span>{service.platform}</span>}
            {service.category !== "Other" && (
              <span>{localizeData(locale, service.category)}</span>
            )}
            {service.sourceServiceId && (
              <bdi title={catalogue.serviceId}>#{service.sourceServiceId}</bdi>
            )}
          </div>
        </th>
        <td>
          <bdi dir="ltr" className="provider-catalogue-price">
            {formatPrice(locale, service)}
          </bdi>
          <span className="provider-catalogue-unit">
            {unitLabel(locale, service)}
          </span>
          {lowest && (
            <span
              className="offer-results-lowest"
              title={priceHighlightCopy[locale].visibleScope}
            >
              <ArrowDown size={13} aria-hidden="true" />
              {t.lowest}
            </span>
          )}
        </td>
        <td className="offer-results-extra provider-catalogue-limits">
          <bdi>
            {formatNumber(locale, service.min)}–
            {formatNumber(locale, service.max)}
          </bdi>
          <p className="provider-catalogue-unit">{market}</p>
        </td>
        <td className="offer-results-extra offer-results-terms">
          <p>{localizeDuration(locale, service.startTime)}</p>
          <p className="provider-catalogue-unit">
            {localizeData(locale, service.refill)}
          </p>
        </td>
        <td className="offer-results-action">
          <button
            type="button"
            aria-pressed={chosen}
            disabled={!chosen && selectionFull}
            onClick={compare}
            className="offer-results-compare"
            aria-label={`${t.compare} ${provider.name}: ${name}`}
            title={chosen ? t.selected : t.compare}
          >
            {chosen ? (
              <Check size={19} aria-hidden="true" />
            ) : (
              <Scale size={19} aria-hidden="true" />
            )}
          </button>
        </td>
      </tr>
      <tr
        id={detailsId}
        className="provider-catalogue-detail-row"
        hidden={!open}
      >
        <td colSpan={5}>
          {open && (
            <div className="provider-catalogue-detail offer-results-detail">
              <h3 dir="auto">{name}</h3>
              <div className="offer-results-detail-grid">
                <div>
                  <OfferPrice
                    service={service}
                    lowest={lowest}
                    scope="visible"
                  />
                  {service.priceUnit === "package" ? (
                    <p className="mt-3 text-sm" dir="auto">
                      {serviceScope(locale, service)}
                    </p>
                  ) : quantity !== undefined ? (
                    <QuoteCost
                      hideMissingBasis
                      service={service}
                      quantity={quantity}
                      lowest={lowest}
                    />
                  ) : null}
                </div>
                <dl>
                  <div>
                    <dt>{catalogue.limits}</dt>
                    <dd>
                      <bdi>
                        {formatNumber(locale, service.min)}–
                        {formatNumber(locale, service.max)}
                      </bdi>
                    </dd>
                  </div>
                  <div>
                    <dt>{t.market}</dt>
                    <dd>{market}</dd>
                  </div>
                  <div>
                    <dt>{pages.start}</dt>
                    <dd>{localizeDuration(locale, service.startTime)}</dd>
                  </div>
                  <div>
                    <dt>{pages.refill}</dt>
                    <dd>{localizeData(locale, service.refill)}</dd>
                  </div>
                </dl>
              </div>
              <OfferEvidence service={service} showTerms />
              {service.priceUnit !== "package" && (
                <div className="mt-3">
                  {quantity === undefined ? (
                    <Link
                      href={`/compare?services=${service.id}`}
                      className="inline-flex min-h-10 items-center rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold text-secondary-foreground hover:border-ring hover:text-foreground"
                    >
                      {locale === "ar"
                        ? "متابعة سعر الخدمة"
                        : "Follow service price"}
                    </Link>
                  ) : (
                    <FollowPrice serviceId={service.id} quantity={quantity} />
                  )}
                </div>
              )}
            </div>
          )}
        </td>
      </tr>
    </>
  );
}
