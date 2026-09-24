import {
  standardRate,
  quantityQuoteExact,
  type PricingMetadata,
} from "../../../shared/pricing";

const en = {
  price: "Price",
  currency: "Currency",
  allCurrencies: "All currencies",
  unknown: "Not confirmed",
  packageDescription: "Package contents",
  sourceRate: "Original API rate",
  history_source: "Source price",
  history_legacy: "Legacy price record",
  history_review: "Review entry",
  sortHint:
    "To sort by price, select one currency.",
  mixed:
    "Currencies, service types, markets or refill terms differ or are unconfirmed, packages are included, or quantity limits are exceeded. No lowest-price ranking is applied.",
  confirm:
    "I checked the amount and currency against the linked evidence.",
  sourceHelp:
    "The API rate is preserved as received. Check the amount and currency against the service source.",
};
export const pricingCopy: Record<string, typeof en> = {
  en,
  ar: {
    price: "السعر",
    currency: "العملة",
    allCurrencies: "جميع العملات",
    unknown: "غير مؤكد",
    packageDescription: "محتويات الباقة",
    sourceRate: "قيمة API الأصلية",
    history_source: "سعر المصدر",
    history_legacy: "سجل أسعار قديم",
    history_review: "سجل مراجعة",
    sortHint: "للترتيب بالسعر، اختر عملة واحدة.",
    mixed:
      "تختلف بعض الشروط أو الأسواق أو لم تُحدد؛ وقد تكون الكمية خارج حدود عرض. لا نضع علامة الأرخص عند غياب أساس مقارنة موحد.",
    confirm: "تحققت من المبلغ والعملة بالرجوع إلى الدليل المرتبط.",
    sourceHelp:
      "نحتفظ بقيمة API كما وردت. تحقق من المبلغ والعملة بالرجوع إلى مصدر الخدمة.",
  },
  es: {
    price: "Precio",
    currency: "Moneda",
    allCurrencies: "Todas las monedas",
    unknown: "Sin confirmar",
    packageDescription: "Contenido del paquete",
    sourceRate: "Tarifa original del API",
    history_source: "Precio de origen",
    history_legacy: "Registro de precio antiguo",
    history_review: "Revisión",
    sortHint:
      "Para ordenar por precio, selecciona una moneda.",
    mixed:
      "Las monedas, servicios o mercados difieren, o incluyen paquetes. No se aplica un ranking de menor precio.",
    confirm:
      "Verifiqué el importe y la moneda con la evidencia enlazada.",
    sourceHelp:
      "Se conserva la tarifa original del API. Comprueba el importe y la moneda en la fuente del servicio.",
  },
  hi: {
    price: "कीमत",
    currency: "मुद्रा",
    allCurrencies: "सभी मुद्राएँ",
    unknown: "पुष्टि नहीं हुई",
    packageDescription: "पैकेज में शामिल सेवाएँ",
    sourceRate: "मूल API दर",
    history_source: "स्रोत कीमत",
    history_legacy: "पुराना मूल्य रिकॉर्ड",
    history_review: "समीक्षा रिकॉर्ड",
    sortHint:
      "कीमत के अनुसार क्रम के लिए एक मुद्रा चुनें।",
    mixed:
      "मुद्रा, सेवा या बाज़ार अलग हैं, या पैकेज शामिल हैं। सबसे सस्ती कीमत की रैंकिंग नहीं की गई।",
    confirm: "मैंने राशि, मुद्रा को जुड़े प्रमाण से जाँचा।",
    sourceHelp:
      "API दर मूल रूप में सुरक्षित है। सेवा के स्रोत से राशि और मुद्रा की पुष्टि करें।",
  },
  zh: {
    price: "价格",
    currency: "货币",
    allCurrencies: "所有货币",
    unknown: "未确认",
    packageDescription: "套餐内容",
    sourceRate: "原始 API 费率",
    history_source: "来源价格",
    history_legacy: "历史价格记录",
    history_review: "审核记录",
    sortHint: "按价格排序前，请选择一种货币。",
    mixed: "货币、服务或目标市场不同，或包含套餐，因此不进行最低价排名。",
    confirm: "我已根据关联证据核实金额、货币。",
    sourceHelp: "保留 API 原始费率。请根据服务来源核实金额和货币。",
  },
};
export function formatQuotePrice(
  locale: string,
  row: Parameters<typeof quantityQuoteExact>[0],
  quantity: number
) {
  const amount = quantityQuoteExact(row, quantity);
  return amount == null ? null : `${row.priceCurrency} ${amount}`;
}
export function formatPrice(
  locale: string,
  row: PricingMetadata & {
    priceAmount: number | string;
    priceType?: "listed" | "from";
    catalogueListing?: string;
    sourceRate?: string | null;
  }
) {
  if (row.catalogueListing === "api_source" && row.sourceRate)
    return row.priceCurrency
      ? `${row.priceCurrency} ${standardRate(row.sourceRate, row.priceUnit)}`
      : standardRate(row.sourceRate, row.priceUnit);
  // Four decimals preserve small rates; currency codes avoid ambiguous dollar symbols.
  const amount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(standardRate(String(row.priceAmount), row.priceUnit)));
  const formatted = row.priceCurrency
    ? `${row.priceCurrency} ${amount}`
    : amount;
  return row.priceType === "from"
    ? `${locale === "ar" ? "ابتداءً من" : "From"} ${formatted}`
    : formatted;
}
