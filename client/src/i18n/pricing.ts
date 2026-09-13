import type { PricingMetadata } from "../../../shared/pricing";

const en = {
  price: "Price",
  currency: "Currency",
  unit: "Sale unit",
  allCurrencies: "All currencies",
  allUnits: "All units",
  unknown: "Not confirmed",
  per_1000: "per 1,000 units",
  per_item: "per item",
  package: "per package",
  packageDescription: "Package contents",
  sourceRate: "Original API rate",
  history_source: "Source rate · currency and unit unconfirmed",
  history_legacy: "Legacy record · pricing basis not retained",
  history_review: "Review entry",
  sortHint:
    "To sort by price, select one currency and a per-item or per-1,000 unit.",
  mixed:
    "Prices have different units, currencies, service types or target markets, or include packages. No lowest-price ranking is applied.",
  confirm:
    "I checked the amount, currency and sale unit against the linked evidence.",
  sourceHelp:
    "The API rate is preserved as received. Confirm the display amount and pricing basis using service-specific evidence.",
};
export const pricingCopy: Record<string, typeof en> = {
  en,
  ar: {
    price: "السعر",
    currency: "العملة",
    unit: "وحدة البيع",
    allCurrencies: "جميع العملات",
    allUnits: "جميع الوحدات",
    unknown: "غير مؤكد",
    per_1000: "لكل ١٬٠٠٠ وحدة",
    per_item: "للوحدة الواحدة",
    package: "للباقة",
    packageDescription: "محتويات الباقة",
    sourceRate: "قيمة API الأصلية",
    history_source: "قيمة المصدر · العملة والوحدة غير مؤكدتين",
    history_legacy: "سجل قديم · أساس التسعير غير محفوظ",
    history_review: "سجل مراجعة",
    sortHint: "للترتيب بالسعر، اختر عملة واحدة ووحدة بيع: للوحدة أو لكل ١٬٠٠٠.",
    mixed:
      "تختلف العملات أو وحدات البيع أو أنواع الخدمات أو الأسواق المستهدفة، أو تتضمن المقارنة باقات. لا نطبق ترتيبًا للأرخص.",
    confirm: "تحققت من المبلغ والعملة ووحدة البيع بالرجوع إلى الدليل المرتبط.",
    sourceHelp:
      "نحتفظ بقيمة API كما وردت. أكّد المبلغ المعروض وأساس التسعير بدليل يخص هذه الخدمة.",
  },
  es: {
    price: "Precio",
    currency: "Moneda",
    unit: "Unidad de venta",
    allCurrencies: "Todas las monedas",
    allUnits: "Todas las unidades",
    unknown: "Sin confirmar",
    per_1000: "por 1.000 unidades",
    per_item: "por unidad",
    package: "por paquete",
    packageDescription: "Contenido del paquete",
    sourceRate: "Tarifa original del API",
    history_source: "Tarifa de origen · moneda y unidad sin confirmar",
    history_legacy: "Registro antiguo · base no conservada",
    history_review: "Revisión",
    sortHint:
      "Para ordenar por precio, selecciona una moneda y una unidad individual o por 1.000.",
    mixed:
      "Las monedas, unidades, servicios o mercados difieren, o incluyen paquetes. No se aplica un ranking de menor precio.",
    confirm:
      "Verifiqué el importe, la moneda y la unidad con la evidencia enlazada.",
    sourceHelp:
      "Se conserva la tarifa original del API. Confirma el importe y su base con evidencia específica del servicio.",
  },
  hi: {
    price: "कीमत",
    currency: "मुद्रा",
    unit: "बिक्री इकाई",
    allCurrencies: "सभी मुद्राएँ",
    allUnits: "सभी इकाइयाँ",
    unknown: "पुष्टि नहीं हुई",
    per_1000: "प्रति 1,000 इकाइयाँ",
    per_item: "प्रति इकाई",
    package: "प्रति पैकेज",
    packageDescription: "पैकेज में शामिल सेवाएँ",
    sourceRate: "मूल API दर",
    history_source: "स्रोत दर · मुद्रा और इकाई अपुष्ट",
    history_legacy: "पुराना रिकॉर्ड · मूल्य आधार सुरक्षित नहीं",
    history_review: "समीक्षा रिकॉर्ड",
    sortHint:
      "कीमत के अनुसार क्रम के लिए एक मुद्रा और प्रति इकाई या प्रति 1,000 चुनें।",
    mixed:
      "मुद्रा, इकाई, सेवा या बाज़ार अलग हैं, या पैकेज शामिल हैं। सबसे सस्ती कीमत की रैंकिंग नहीं की गई।",
    confirm: "मैंने राशि, मुद्रा और बिक्री इकाई को जुड़े प्रमाण से जाँचा।",
    sourceHelp:
      "API दर मूल रूप में सुरक्षित है। सेवा के विशिष्ट प्रमाण से राशि और मूल्य आधार की पुष्टि करें।",
  },
  zh: {
    price: "价格",
    currency: "货币",
    unit: "销售单位",
    allCurrencies: "所有货币",
    allUnits: "所有单位",
    unknown: "未确认",
    per_1000: "每 1,000 单位",
    per_item: "每单位",
    package: "每套餐",
    packageDescription: "套餐内容",
    sourceRate: "原始 API 费率",
    history_source: "来源费率 · 货币和单位未确认",
    history_legacy: "历史记录 · 未保留计价依据",
    history_review: "审核记录",
    sortHint: "按价格排序前，请选择一种货币以及每单位或每 1,000 单位。",
    mixed: "货币、单位、服务或目标市场不同，或包含套餐，因此不进行最低价排名。",
    confirm: "我已根据关联证据核实金额、货币和销售单位。",
    sourceHelp: "保留 API 原始费率。请使用该服务的具体证据确认金额和计价依据。",
  },
};
export function unitLabel(locale: string, row: PricingMetadata) {
  const text = pricingCopy[locale] ?? en;
  return row.priceUnit &&
    ["per_1000", "per_item", "package"].includes(row.priceUnit)
    ? text[row.priceUnit as "per_1000" | "per_item" | "package"]
    : text.unknown;
}
export function formatPrice(
  locale: string,
  row: PricingMetadata & { priceAmount: number | string }
) {
  // Four decimals preserve small rates; currency codes avoid ambiguous dollar symbols.
  const amount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(row.priceAmount));
  return row.priceCurrency ? `${row.priceCurrency} ${amount}` : amount;
}
