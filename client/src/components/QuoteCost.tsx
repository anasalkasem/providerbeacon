import { useLocale } from "@/contexts/LocaleContext";
import type { Service } from "@/data/marketplace";
import { formatQuotePrice } from "@/i18n/pricing";
import { hasPricingBasis } from "../../../shared/pricing";

export default function QuoteCost({
  service,
  quantity,
  lowest = false,
  hideMissingBasis = false,
}: {
  service: Service;
  quantity: number;
  lowest?: boolean;
  hideMissingBasis?: boolean;
}) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  if (hideMissingBasis && !hasPricingBasis(service)) return null;
  const amount =
    service.priceType === "from"
      ? null
      : formatQuotePrice(locale, service, quantity);
  const reason =
    service.priceType === "from"
      ? ar
        ? "سعر ابتدائي؛ يلزم عرض سعر نهائي"
        : "Starting price; a final quote is needed"
      : !Number.isSafeInteger(quantity) || quantity < 1
        ? ar
          ? "أدخل كمية صحيحة أكبر من صفر"
          : "Enter a positive whole quantity"
        : !hasPricingBasis(service)
          ? service.priceCurrency
            ? ar
              ? "الإجمالي غير متاح: وحدة البيع غير محددة"
              : "Total unavailable: sale unit unspecified"
            : ar
              ? "الإجمالي غير متاح: عملة السعر غير محددة"
              : "Total unavailable: currency unspecified"
          : service.priceUnit === "package"
            ? ar
              ? "السعر للباقة المحددة"
              : "Price applies to the defined package"
            : quantity < service.min
              ? ar
                ? `أقل من الحد الأدنى: ${service.min.toLocaleString(locale)}`
                : `Below minimum: ${service.min.toLocaleString(locale)}`
              : quantity > service.max
                ? ar
                  ? `أعلى من الحد الأقصى: ${service.max.toLocaleString(locale)}`
                  : `Above maximum: ${service.max.toLocaleString(locale)}`
                : ar
                  ? "تعذر حساب المبلغ من السعر المتاح"
                  : "Unable to calculate this rate";
  return (
    <div
      className={`mt-3 rounded-lg px-3 py-2 text-xs leading-6 ${amount == null ? "bg-muted" : lowest ? "bg-success-muted" : service.featured ? "bg-secondary" : "bg-muted"}`}
    >
      <p className="text-secondary-foreground">
        {ar ? "تكلفة الكمية المحددة" : "Cost for selected quantity"}
      </p>
      {amount == null ? (
        <p className="text-secondary-foreground">{reason}</p>
      ) : (
        <bdi
          dir="ltr"
          className={`break-all text-base font-extrabold ${lowest ? "text-success" : service.featured ? "text-foreground" : "text-foreground"}`}
        >
          {amount}
        </bdi>
      )}
    </div>
  );
}
