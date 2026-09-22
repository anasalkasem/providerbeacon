import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { pricingCopy } from "@/i18n/pricing";
import type { ProviderCataloguePricing } from "../../../shared/providerCataloguePricing";

const translations = {
  en: { title: "Published service prices", unavailable: "Prices temporarily unavailable", empty: "No published prices", unconfirmed: "Pricing basis not confirmed", pending: "Services with an unconfirmed currency or sale unit", note: "Ranges cover different services, not equivalent offers or a final quote.", all: "View all services and prices", more: "Additional pricing groups" },
  ar: { title: "أسعار الخدمات المنشورة", unavailable: "الأسعار غير متاحة مؤقتًا", empty: "لا توجد أسعار منشورة", unconfirmed: "أساس التسعير غير مؤكد", pending: "خدمات لم تُؤكد عملتها أو وحدة بيعها", note: "النطاقات تشمل خدمات مختلفة، وليست مقارنة لعروض متكافئة أو عرض سعر نهائيًا.", all: "عرض جميع الخدمات والأسعار", more: "مجموعات أسعار إضافية" },
  es: { title: "Precios de servicios publicados", unavailable: "Precios temporalmente no disponibles", empty: "No hay precios publicados", unconfirmed: "Base de precios sin confirmar", pending: "Servicios con moneda o unidad sin confirmar", note: "Los rangos abarcan servicios distintos; no son ofertas equivalentes ni una cotización final.", all: "Ver todos los servicios y precios", more: "Grupos de precios adicionales" },
  hi: { title: "प्रकाशित सेवाओं की कीमतें", unavailable: "कीमतें अस्थायी रूप से उपलब्ध नहीं हैं", empty: "कोई प्रकाशित कीमत नहीं", unconfirmed: "मूल्य आधार की पुष्टि नहीं हुई", pending: "अपुष्ट मुद्रा या बिक्री इकाई वाली सेवाएँ", note: "सीमाएँ अलग-अलग सेवाओं की हैं, समान ऑफ़र या अंतिम मूल्य नहीं।", all: "सभी सेवाएँ और कीमतें देखें", more: "अतिरिक्त मूल्य समूह" },
  zh: { title: "已发布服务价格", unavailable: "价格暂时不可用", empty: "暂无已发布价格", unconfirmed: "计价依据未确认", pending: "货币或销售单位未确认的服务", note: "价格范围涵盖不同服务，并非同等报价比较或最终报价。", all: "查看所有服务和价格", more: "更多价格分组" },
};

export default function ProviderPrices({ summary, slug, name }: { summary?: ProviderCataloguePricing | null; slug: string; name: string }) {
  const { locale } = useLocale();
  const t = translations[locale] ?? translations.en;
  const units = pricingCopy[locale] ?? pricingCopy.en;
  return <section className="provider-price-summary rounded-2xl border border-border bg-card p-5" aria-label={`${t.title}: ${name}`}>
    <h3 className="text-sm font-bold text-foreground">{t.title}</h3>
    {summary == null ? <p className="mt-3 text-sm text-muted-foreground">{t.unavailable}</p>
      : <>
        {!summary.ranges.length && <p className="mt-3 text-sm text-muted-foreground">{summary.unconfirmedServices ? t.unconfirmed : t.empty}</p>}
        <div className="mt-3 space-y-3">{summary.ranges.map(range => <div key={`${range.currency}-${range.unit}`}>
          <bdi dir="ltr" className="break-words text-lg font-extrabold text-foreground">{range.currency} {range.minimum}{range.minimum !== range.maximum ? ` – ${range.maximum}` : ""}</bdi>
          <p className="text-xs text-muted-foreground">{units[range.unit]}</p>
        </div>)}</div>
        {summary.ranges.length > 0 && <p className="mt-3 text-xs leading-5 text-muted-foreground">{t.note}</p>}
        {summary.unconfirmedServices > 0 && <p className="mt-3 text-xs text-muted-foreground">{t.pending}: <bdi>{summary.unconfirmedServices}</bdi></p>}
        {summary.additionalGroups > 0 && <p className="mt-2 text-xs text-muted-foreground">{t.more}: <bdi>{summary.additionalGroups}</bdi></p>}
      </>}
    <Link className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold underline underline-offset-4" href={`/providers/${encodeURIComponent(slug)}#provider-services`}>{t.all}</Link>
  </section>;
}
