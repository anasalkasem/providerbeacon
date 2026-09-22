import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Link, useSearch } from "wouter";
import { copy, useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import type { Provider, Service } from "@/data/marketplace";
import { catalogueCopy, percentLabel } from "@/i18n/catalogue";
import {
  formatNumber,
  localizeData,
  localizeDuration,
  pageCopy,
} from "@/i18n/messages";
import { formatPrice, pricingCopy, unitLabel } from "@/i18n/pricing";
import { providerCatalogueCopy } from "@/i18n/providerCatalogue";
import { CataloguePagination } from "./CataloguePagination";
import OfferEvidence, { serviceName, serviceScope } from "./OfferEvidence";
import { Button } from "./ui/button";
import "./provider-catalogue.css";

export default function ProviderCatalogue({
  provider,
}: {
  provider: Provider;
}) {
  const { locale } = useLocale();
  const t = providerCatalogueCopy[locale];
  const { services, pagination, isFetching, source, retry, setFilters } =
    useMarketplaceData();
  const initialSearch =
    new URLSearchParams(useSearch()).get("q")?.slice(0, 100) ?? "";
  const [search, setSearch] = useState(initialSearch);
  const [submittedSearch, setSubmittedSearch] = useState(initialSearch);
  const [pageSize, setPageSize] = useState(25);
  const [expanded, setExpanded] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pendingNavigation = useRef(false);
  const rows = services.filter(service => service.providerId === provider.id);
  const page = pagination?.page ?? 1;

  function revealCatalogue() {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  function navigate() {
    pendingNavigation.current = true;
    setExpanded(null);
    // Move before the request as well as after it. A short last page or an
    // expanded row must not leave the reader anchored to the page footer.
    revealCatalogue();
  }

  useLayoutEffect(() => {
    if (!pendingNavigation.current || isFetching) return;
    pendingNavigation.current = false;
    revealCatalogue();
  }, [page, rows, isFetching]);

  function applySearch(event: FormEvent) {
    event.preventDefault();
    const q = search.trim();
    setSubmittedSearch(q);
    setExpanded(null);
    setFilters({ q, limit: pageSize });
  }

  function clearSearch() {
    setSearch("");
    setSubmittedSearch("");
    setExpanded(null);
    setFilters({ q: "", limit: pageSize });
  }

  return (
    <section
      id="provider-services"
      className="provider-catalogue"
      aria-labelledby="provider-catalogue-title"
    >
      <div className="provider-catalogue-heading">
        <h2 id="provider-catalogue-title" ref={heading} tabIndex={-1}>
          {pageCopy[locale].availableServices}
        </h2>
        <p>
          <bdi>
            {formatNumber(
              locale,
              pagination?.total ?? provider.activeServicesCount
            )}
          </bdi>{" "}
          {submittedSearch ? t.results : pageCopy[locale].listed}
        </p>
      </div>
      <form
        onSubmit={applySearch}
        role="search"
        aria-label={t.search}
        className="provider-catalogue-search"
      >
        <label className="sr-only" htmlFor="provider-catalogue-search">
          {t.search}
        </label>
        <div>
          <Search aria-hidden="true" size={18} />
          <input
            id="provider-catalogue-search"
            type="search"
            value={search}
            maxLength={100}
            onChange={event => setSearch(event.target.value)}
            placeholder={t.searchHint}
          />
        </div>
        <Button type="submit" disabled={isFetching}>
          {t.submit}
        </Button>
      </form>
      <div className="provider-catalogue-tools">
        <p>{t.help}</p>
        <label>
          {t.pageSize}
          <select
            value={pageSize}
            disabled={isFetching}
            onChange={event => {
              const limit = Number(event.target.value);
              setPageSize(limit);
              setExpanded(null);
              setFilters({ q: submittedSearch, limit });
            }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
        {submittedSearch && (
          <button
            type="button"
            className="provider-catalogue-clear"
            onClick={clearSearch}
          >
            {t.clear}
          </button>
        )}
      </div>
      <CataloguePagination onNavigate={navigate} pageSize={pageSize} />
      <div
        className="provider-catalogue-table-wrap"
        aria-busy={isFetching || undefined}
      >
        {source === "unavailable" ? (
          <div className="provider-catalogue-empty" role="alert">
            <p>{catalogueCopy[locale].unavailable}</p>
            <Button variant="outline" onClick={retry}>
              {catalogueCopy[locale].retry}
            </Button>
          </div>
        ) : (
          <table className="provider-catalogue-table">
            <caption className="sr-only">
              {provider.name} · {pageCopy[locale].availableServices}
            </caption>
            <colgroup>
              <col />
              <col className="provider-catalogue-price-col" />
              <col className="provider-catalogue-limits-col" />
              <col className="provider-catalogue-toggle-col" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{t.service}</th>
                <th scope="col">{t.price}</th>
                <th scope="col" className="provider-catalogue-limits">
                  {t.limits}
                </th>
                <th scope="col">
                  <span className="sr-only">{t.details}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(service => (
                <ServiceRows
                  key={service.id}
                  service={service}
                  open={expanded === service.id}
                  toggle={() =>
                    setExpanded(current =>
                      current === service.id ? null : service.id
                    )
                  }
                />
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4} className="provider-catalogue-empty">
                    {t.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      <CataloguePagination onNavigate={navigate} pageSize={pageSize} />
    </section>
  );
}

function ServiceRows({
  service,
  open,
  toggle,
}: {
  service: Service;
  open: boolean;
  toggle: () => void;
}) {
  const { locale } = useLocale();
  const t = providerCatalogueCopy[locale];
  const pages = pageCopy[locale];
  const name = serviceName(locale, service);
  const detailsId = `catalogue-details-${service.id}`;
  const platform =
    service.platform && service.platform !== "Unknown"
      ? service.platform
      : null;
  const similarParams = new URLSearchParams();
  if (platform) similarParams.set("platform", platform);
  if (service.category && service.category !== "Other")
    similarParams.set("category", service.category);
  const compareHref =
    service.priceUnit === "package" || !similarParams.size
      ? `/compare?services=${service.id}`
      : `/services?${similarParams}`;
  return (
    <>
      <tr className="provider-catalogue-row" data-expanded={open || undefined}>
        <th scope="row">
          <button
            type="button"
            className="provider-catalogue-name"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={detailsId}
          >
            <span dir="auto">{name}</span>
          </button>
          {(platform || service.sourceServiceId) && (
            <div className="provider-catalogue-meta">
              {platform && <span>{platform}</span>}
              {service.sourceServiceId && (
                <bdi title={t.serviceId}>#{service.sourceServiceId}</bdi>
              )}
            </div>
          )}
        </th>
        <td>
          <bdi dir="ltr" className="provider-catalogue-price">
            {formatPrice(locale, service)}
          </bdi>
          <span className="provider-catalogue-unit">
            {unitLabel(locale, service)}
          </span>
        </td>
        <td className="provider-catalogue-limits">
          <bdi>
            {formatNumber(locale, service.min)}–
            {formatNumber(locale, service.max)}
          </bdi>
        </td>
        <td className="provider-catalogue-toggle">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={detailsId}
            aria-label={`${open ? t.close : t.details}: ${name}`}
          >
            <ChevronDown aria-hidden="true" size={18} />
          </button>
        </td>
      </tr>
      <tr
        id={detailsId}
        className="provider-catalogue-detail-row"
        hidden={!open}
      >
        <td colSpan={4}>
          {open && (
            <div className="provider-catalogue-detail">
              <h3 dir="auto">{name}</h3>
              <dl>
                <div>
                  <dt>{t.price}</dt>
                  <dd>
                    <bdi dir="ltr">{formatPrice(locale, service)}</bdi> ·{" "}
                    {unitLabel(locale, service)}
                  </dd>
                </div>
                <div>
                  <dt>{t.limits}</dt>
                  <dd>
                    <bdi>
                      {formatNumber(locale, service.min)}–
                      {formatNumber(locale, service.max)}
                    </bdi>
                  </dd>
                </div>
                {service.sourceServiceId && (
                  <div>
                    <dt>{t.serviceId}</dt>
                    <dd>
                      <bdi>{service.sourceServiceId}</bdi>
                    </dd>
                  </div>
                )}
                {!service.billingCycle && (
                  <>
                    <div>
                      <dt>{pages.start}</dt>
                      <dd>{localizeDuration(locale, service.startTime)}</dd>
                    </div>
                    <div>
                      <dt>{pages.refill}</dt>
                      <dd>{localizeData(locale, service.refill)}</dd>
                    </div>
                    {service.retention != null && (
                      <div>
                        <dt>{pages.retention}</dt>
                        <dd>{percentLabel(service.retention)}</dd>
                      </div>
                    )}
                  </>
                )}
                {service.packageDescription && (
                  <div>
                    <dt>{pricingCopy[locale].packageDescription}</dt>
                    <dd dir="auto">{serviceScope(locale, service)}</dd>
                  </div>
                )}
              </dl>
              <OfferEvidence service={service} showTerms />
              <Button asChild size="sm" variant="outline">
                <Link href={compareHref}>
                  {service.priceUnit === "package" || !similarParams.size
                    ? copy[locale].compare
                    : t.similar}
                </Link>
              </Button>
            </div>
          )}
        </td>
      </tr>
    </>
  );
}
