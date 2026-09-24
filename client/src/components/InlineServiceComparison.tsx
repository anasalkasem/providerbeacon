import { Link } from "wouter";
import { Scale, X } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { catalogueIndex } from "@/lib/catalogue";
import {
  lowestVisiblePriceIds,
  publishedRateExact,
} from "@/lib/priceHighlights";
import { comparablePrices, quantityQuoteExact } from "@shared/pricing";
import { comparisonGroup } from "@shared/offerComparison";
import { localizeData, localizeDuration } from "@/i18n/messages";
import { serviceName } from "./OfferEvidence";
import OfferPrice from "./OfferPrice";
import QuoteCost from "./QuoteCost";

export default function InlineServiceComparison({
  ids,
  quantity,
  remove,
  clear,
}: {
  ids: string[];
  quantity?: number;
  remove: (id: string) => void;
  clear: () => void;
}) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  // This query owns its provider index. Catalogue pagination must never change
  // a selected service's identity, price or availability.
  const query = trpc.marketplace.snapshot.useQuery(
    {
      scope: "compare",
      ids: ids.map(id => Number(id.slice(8))),
    },
    { enabled: ids.length > 0, staleTime: 30_000, retry: 1 }
  );
  const data = query.isError ? undefined : query.data;
  const index = catalogueIndex(data?.providers ?? [], data?.services ?? []);
  const selected = ids.flatMap(id => {
    const service = index.serviceFor(id);
    return service ? [service] : [];
  });
  const group = selected[0] && comparisonGroup(selected[0]);
  const equivalent =
    selected.length === ids.length &&
    Boolean(group) &&
    selected.every(service => comparisonGroup(service) === group) &&
    comparablePrices(selected) &&
    selected.every(service =>
      quantity === undefined
        ? publishedRateExact(service) !== null
        : quantityQuoteExact(service, quantity) !== null
    );
  const lowest = equivalent
    ? lowestVisiblePriceIds(selected, quantity)
    : new Set<string>();
  const failed = query.isError || data?.source === "unavailable";
  const labels = ar
    ? [
        "السعر ووحدته",
        "إجمالي الكمية",
        "المنصة والنوع",
        "السوق",
        "التعويض",
        "حدود الطلب",
        "بدء التنفيذ",
        "المصدر",
      ]
    : [
        "Rate and unit",
        "Quantity total",
        "Platform and type",
        "Market",
        "Refill",
        "Order limits",
        "Start time",
        "Source",
      ];
  return (
    <section
      id="service-comparison"
      className="my-6 scroll-mt-28 overflow-hidden rounded-2xl border border-input bg-card"
      aria-labelledby="inline-comparison-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <h2
            id="inline-comparison-title"
            tabIndex={-1}
            className="flex items-center gap-2 text-lg font-extrabold outline-none"
          >
            <Scale className="size-5 text-primary" />
            {ar ? "مقارنتك" : "Your comparison"}
            <span
              className="text-sm font-normal text-muted-foreground"
              aria-live="polite"
            >
              {ids.length} / 4
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ar
              ? "اختر عروضًا من النتائج أدناه. تبقى اختياراتك عند تغيير الفلاتر والصفحات."
              : "Choose offers below. Your selection stays with you across filters and pages."}
          </p>
        </div>
        {ids.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="min-h-11 px-3 text-sm font-semibold underline underline-offset-4"
          >
            {ar ? "إلغاء الاختيار" : "Clear selection"}
          </button>
        )}
      </div>
      {ids.length === 0 ? (
        <p className="border-t border-border bg-muted px-5 py-4 text-sm text-secondary-foreground">
          {ar
            ? "اضغط «قارن» بجانب أي خدمة لإضافتها إلى هذا الجدول."
            : "Select Compare beside a service to add it to this table."}
        </p>
      ) : (
        <>
          {failed && (
            <p role="alert" className="px-5 pb-4 text-sm text-danger">
              {ar
                ? "تعذر تحديث أسعار المقارنة."
                : "Comparison prices could not be refreshed."}{" "}
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="min-h-11 px-2 underline"
              >
                {ar ? "إعادة المحاولة" : "Retry"}
              </button>
            </p>
          )}
          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label={
              ar
                ? "جدول المقارنة، قابل للتمرير أفقيًا"
                : "Comparison table, scroll horizontally"
            }
            aria-busy={query.isFetching}
          >
            <table
              className="w-full table-fixed text-start text-sm"
              style={{ minWidth: Math.max(620, 128 + ids.length * 240) }}
            >
              <caption className="sr-only">
                {ar
                  ? "مقارنة الأسعار والشروط للعروض المختارة"
                  : "Prices and terms of your selected offers"}
              </caption>
              <thead>
                <tr className="border-y border-border bg-muted">
                  <th scope="col" className="w-32 p-4 text-start">
                    {ar ? "الخدمة والمزود" : "Service and provider"}
                  </th>
                  {ids.map(id => {
                    const service = index.serviceFor(id);
                    const provider = service && index.providerFor(service);
                    return (
                      <th
                        key={id}
                        scope="col"
                        className="min-w-48 p-4 text-start align-top"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {provider && (
                              <Link
                                href={`/providers/${provider.slug}`}
                                className="font-extrabold text-primary underline underline-offset-4"
                              >
                                {provider.name}
                              </Link>
                            )}
                            <p
                              className="mt-2 break-words font-semibold"
                              dir="auto"
                            >
                              {service
                                ? serviceName(locale, service)
                                : query.isLoading
                                  ? ar
                                    ? "جارٍ التحميل…"
                                    : "Loading…"
                                  : ar
                                    ? "هذا العرض غير متاح حاليًا"
                                    : "This offer is currently unavailable"}
                            </p>
                            <bdi className="mt-1 block text-xs font-normal text-muted-foreground">
                              {service?.sourceServiceId ?? id}
                            </bdi>
                          </div>
                          <button
                            type="button"
                            onClick={() => remove(id)}
                            aria-label={`${ar ? "إزالة" : "Remove"}: ${service ? serviceName(locale, service) : id}`}
                            className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-card hover:bg-secondary"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {labels.map((label, row) =>
                  row === 1 && quantity === undefined ? null : (
                    <tr
                      key={label}
                      className="border-b border-border last:border-0"
                    >
                      <th
                        scope="row"
                        className="p-4 text-start align-top font-semibold text-secondary-foreground"
                      >
                        {label}
                      </th>
                      {ids.map(id => {
                        const service = index.serviceFor(id);
                        return (
                          <td key={id} className="p-4 align-top">
                            {!service ? (
                              "—"
                            ) : row === 0 ? (
                              <OfferPrice
                                service={service}
                                lowest={lowest.has(id)}
                              />
                            ) : row === 1 && quantity !== undefined ? (
                              <QuoteCost
                                service={service}
                                quantity={quantity}
                                lowest={lowest.has(id)}
                              />
                            ) : row === 2 ? (
                              `${service.platform} · ${localizeData(locale, service.category)}`
                            ) : row === 3 ? (
                              (service.countryCode ??
                              (ar ? "غير محدد" : "Unspecified"))
                            ) : row === 4 ? (
                              localizeData(locale, service.refill)
                            ) : row === 5 ? (
                              <bdi>
                                {service.min.toLocaleString(locale)} –{" "}
                                {service.max.toLocaleString(locale)}
                              </bdi>
                            ) : row === 6 ? (
                              localizeDuration(locale, service.startTime)
                            ) : service.sourceUrl ? (
                              <a
                                href={service.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                              >
                                {ar ? "راجع شروط المصدر" : "Check source terms"}
                              </a>
                            ) : ar ? (
                              "غير متاح"
                            ) : (
                              "Unavailable"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted p-4 text-xs leading-6 text-secondary-foreground">
            <p className="max-w-3xl">
              {ids.length < 2
                ? ar
                  ? "أضف عرضًا آخر للمقارنة."
                  : "Add another offer to compare."
                : ar
                  ? `الأخضر يظهر فقط عندما تتطابق العملة ووحدة السعر والخدمة والسوق والتعويض والجودة المعلنة${quantity === undefined ? ". راجع حدود الطلب لكل عرض" : "، وتقبل العروض الكمية"}. السعر الأقل ليس تقييمًا للجودة.`
                  : `Green appears only when currency, unit, service, market, refill and stated quality match${quantity === undefined ? ". Check each offer's order limits" : " and offers accept the quantity"}. Lowest price is not a quality rating.`}
            </p>
            {selected.length === ids.length && selected.length >= 2 && (
              <Link
                href={`/compare?services=${ids.join(",")}${quantity !== undefined && Number.isSafeInteger(quantity) && quantity > 0 ? `&quantity=${quantity}` : ""}`}
                className="inline-flex min-h-11 items-center font-bold text-primary underline"
              >
                {ar ? "حفظ ومشاركة المقارنة" : "Save and share comparison"}
              </Link>
            )}
          </div>
        </>
      )}
    </section>
  );
}
