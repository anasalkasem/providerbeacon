import { DecisionOffer } from "./DecisionOffer";
import { FollowPrice } from "./WorkspaceActions";
import { workspaceCopy } from "@/i18n/workspace";
import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { type Service } from "@/data/marketplace";
import { lowestVisiblePriceIds } from "@/lib/priceHighlights";
import { localizeData, localizeDuration, formatNumber } from "@/i18n/messages";
import OfferEvidence, { serviceName, serviceScope } from "./OfferEvidence";
import QuoteCost from "./QuoteCost";
import OfferPrice, { PriceLegend } from "./OfferPrice";
import { hasPricingBasis } from "../../../shared/pricing";

export default function SmmOfferTable({
  services,
  selected,
  toggle,
  quantity = 1000,
}: {
  services: Service[];
  selected: Service[];
  toggle: (service: Service) => void;
  quantity?: number;
}) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const wt = workspaceCopy[locale];
  const { providerFor } = useMarketplaceData();
  const lowest = lowestVisiblePriceIds(services, quantity);
  return (
    <>
      {services.length > 0 && (
        <PriceLegend
          hasUnconfirmed={services.some(service => !hasPricingBasis(service))}
        />
      )}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:hidden">
        {services.map(service => {
          const chosen = selected.some(s => s.id === service.id);
          return (
            <div key={service.id}>
              <DecisionOffer
                service={service}
                provider={providerFor(service)}
                quantity={quantity}
                lowest={lowest.has(service.id)}
              />
              <button
                type="button"
                onClick={() => toggle(service)}
                disabled={!chosen && selected.length >= 4}
                aria-pressed={chosen}
                className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm font-bold ${chosen ? "border-teal-500 bg-teal-50 text-teal-900" : "border-slate-200 bg-white text-slate-700"} disabled:opacity-40`}
              >
                {chosen ? "✓ " : "+ "}
                {ar
                  ? "قارن"
                  : locale === "es"
                    ? "Comparar"
                    : locale === "zh"
                      ? "比较"
                      : locale === "hi"
                        ? "तुलना"
                        : "Compare"}
              </button>
            </div>
          );
        })}
      </div>
      <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-start text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {[
                ar ? "الخدمة والمزود" : "Service and provider",
                ar ? "السعر" : "Price",
                ar ? "حدود الطلب" : "Order limits",
                ar ? "البدء والتعويض" : "Start and refill",
                ar ? "المقارنة" : "Compare",
              ].map(label => (
                <th className="p-4 text-start font-bold" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map(service => {
              const provider = providerFor(service);
              const chosen = selected.some(item => item.id === service.id);
              return (
                <tr
                  key={service.id}
                  className={
                    chosen
                      ? "border-t border-teal-100 bg-teal-50/50"
                      : "border-t border-slate-100"
                  }
                >
                  <td className="max-w-sm p-4 align-top">
                    <Link
                      href={`/providers/${provider.slug}`}
                      className="font-bold text-teal-700 hover:underline"
                    >
                      {provider.name}
                    </Link>
                    <p
                      className="mt-1 line-clamp-2 font-semibold text-slate-950"
                      title={serviceName(locale, service)}
                    >
                      {serviceName(locale, service)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {service.platform} ·{" "}
                      {localizeData(locale, service.category)}
                      {service.sourceServiceId && (
                        <>
                          {" "}
                          · ID <bdi>{service.sourceServiceId}</bdi>
                        </>
                      )}
                    </p>
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-slate-500">
                        {wt.allDetails}
                      </summary>
                      <p dir="auto" className="mt-2 leading-6">
                        {serviceName(locale, service)}
                      </p>
                      <OfferEvidence service={service} />
                    </details>
                  </td>
                  <td className="p-4 align-top">
                    <OfferPrice
                      service={service}
                      lowest={lowest.has(service.id)}
                      scope="visible"
                    />
                    {service.priceUnit === "package" ? (
                      <p className="mt-2 max-w-xs">
                        {serviceScope(locale, service)}
                      </p>
                    ) : (
                      <QuoteCost
                        hideMissingBasis
                        service={service}
                        quantity={quantity}
                        lowest={lowest.has(service.id)}
                      />
                    )}
                  </td>
                  <td className="p-4 align-top">
                    <bdi className="whitespace-nowrap">
                      {formatNumber(locale, service.min)} –{" "}
                      {formatNumber(locale, service.max)}
                    </bdi>
                    <p className="mt-2 text-xs text-slate-500">
                      {service.countryCode === "WW"
                        ? ar
                          ? "عالمي"
                          : "Worldwide"
                        : (service.countryCode ??
                          (ar ? "السوق غير محدد" : "Market unspecified"))}
                    </p>
                  </td>
                  <td className="p-4 align-top">
                    <p>{localizeDuration(locale, service.startTime)}</p>
                    <p className="mt-2 text-teal-700">
                      {localizeData(locale, service.refill)}
                    </p>
                  </td>
                  <td className="p-4 align-top">
                    <button
                      type="button"
                      aria-pressed={chosen}
                      aria-label={`${ar ? "قارن" : "Compare"} ${provider.name}: ${serviceName(locale, service)}`}
                      disabled={!chosen && selected.length >= 4}
                      onClick={() => toggle(service)}
                      className="rounded-xl border border-[#0B2A48] px-4 py-2 font-bold text-[#0B2A48] hover:bg-slate-100 disabled:opacity-40"
                    >
                      {chosen
                        ? ar
                          ? "تم الاختيار ✓"
                          : "Selected ✓"
                        : ar
                          ? "قارن +"
                          : "Compare +"}
                    </button>
                    {service.priceUnit !== "package" && (
                      <div className="mt-2">
                        <FollowPrice
                          serviceId={service.id}
                          quantity={quantity}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
