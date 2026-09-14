import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { type Service } from "@/data/marketplace";
import { formatPrice, unitLabel } from "@/i18n/pricing";
import { localizeData, localizeDuration, formatNumber } from "@/i18n/messages";
import OfferEvidence, { serviceName, serviceScope } from "./OfferEvidence";
import { quantityQuote } from "../../../shared/pricing";

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
  const { providerFor } = useMarketplaceData();
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
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
            const total = quantityQuote(service, quantity);
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
                  <p className="mt-1 font-semibold text-slate-950">
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
                  <OfferEvidence service={service} />
                </td>
                <td className="p-4 align-top">
                  <bdi
                    dir="ltr"
                    className="whitespace-nowrap text-xl font-extrabold text-[#0B2A48]"
                  >
                    {formatPrice(locale, service)}
                  </bdi>
                  <p className="mt-1 text-xs text-slate-500">
                    {unitLabel(locale, service)}
                  </p>
                  {service.priceUnit === "package" ? (
                    <p className="mt-2 max-w-xs">
                      {serviceScope(locale, service)}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs leading-6">
                      {ar ? "تكلفة الكمية المحددة: " : "Selected quantity: "}
                      {total == null ? (
                        <span className="text-amber-700">
                          {ar ? "خارج حدود الطلب" : "Outside order limits"}
                        </span>
                      ) : (
                        <bdi dir="ltr" className="font-bold">
                          {formatPrice(locale, {
                            ...service,
                            priceAmount: total,
                          })}
                        </bdi>
                      )}
                    </p>
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
