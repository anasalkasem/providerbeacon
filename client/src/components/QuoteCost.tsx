import { useLocale } from "@/contexts/LocaleContext";
import type { Service } from "@/data/marketplace";
import { formatQuotePrice } from "@/i18n/pricing";
import { hasPricingBasis } from "../../../shared/pricing";

export default function QuoteCost({
  service,
  quantity,
  lowest = false,
}: {
  service: Service;
  quantity: number;
  lowest?: boolean;
}) {
  const { locale } = useLocale();
  const ar = locale === "ar";
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
              ? "بانتظار تأكيد وحدة السعر"
              : "Awaiting confirmation of the sale unit"
            : ar
              ? "حساب الإجمالي ينتظر تأكيد العملة ووحدة السعر"
              : "Total requires confirmed currency and sale unit"
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
      className={`mt-3 rounded-lg px-3 py-2 text-xs leading-6 ${amount == null ? "bg-amber-50" : lowest ? "bg-emerald-100" : service.featured ? "bg-violet-100" : "bg-slate-50"}`}
    >
      <p className="text-slate-600">
        {ar ? "تكلفة الكمية المحددة" : "Cost for selected quantity"}
      </p>
      {amount == null ? (
        <p className="text-amber-800">{reason}</p>
      ) : (
        <bdi
          dir="ltr"
          className={`break-all text-base font-extrabold ${lowest ? "text-emerald-800" : service.featured ? "text-violet-800" : "text-slate-800"}`}
        >
          {amount}
        </bdi>
      )}
    </div>
  );
}
