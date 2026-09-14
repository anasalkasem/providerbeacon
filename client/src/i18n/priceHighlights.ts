import type { Locale } from "@/contexts/LocaleContext";

const en = {
  lowest: "Lowest comparable price",
  featured: "Featured offer",
  regular: "Regular price",
  unconfirmed: "Pricing unconfirmed",
  unconfirmedHint: "Currency or sale unit needs confirmation before ranking.",
  pendingNotice:
    "Amber amounts are not included in lowest-price ranking until their currency and sale unit are confirmed.",
  visibleScope: "Among matching offers on this page",
  comparisonScope: "Among the selected offers",
  featuredHint:
    "Highlighted in the catalogue; this does not imply a discount or the lowest price.",
  legend: "Price colors",
};

export const priceHighlightCopy: Record<Locale, typeof en> = {
  en,
  ar: {
    lowest: "أقل سعر قابل للمقارنة",
    featured: "عرض مميز",
    regular: "سعر عادي",
    unconfirmed: "السعر قيد التحقق",
    unconfirmedHint: "يلزم تأكيد العملة ووحدة السعر قبل ترتيب الأرخص.",
    pendingNotice:
      "الأرقام بالكهرماني لا تدخل ترتيب الأرخص قبل تأكيد عملتها ووحدة سعرها.",
    visibleScope: "بين العروض المماثلة في هذه الصفحة",
    comparisonScope: "ضمن العروض المختارة",
    featuredHint: "عرض مميز في الدليل؛ لا يعني وجود خصم أو أنه الأقل سعرًا.",
    legend: "ألوان الأسعار",
  },
  es: {
    lowest: "Menor precio comparable",
    featured: "Oferta destacada",
    regular: "Precio normal",
    unconfirmed: "Precio sin confirmar",
    unconfirmedHint: "Falta confirmar la moneda o la unidad antes de comparar.",
    pendingNotice:
      "Los importes en ámbar no participan en el ranking de menor precio hasta confirmar su moneda y unidad.",
    visibleScope: "Entre ofertas equivalentes de esta página",
    comparisonScope: "Entre las ofertas seleccionadas",
    featuredHint:
      "Destacada en el catálogo; no implica un descuento ni el menor precio.",
    legend: "Colores de precios",
  },
  hi: {
    lowest: "तुलनीय ऑफ़र में सबसे कम कीमत",
    featured: "चुनिंदा ऑफ़र",
    regular: "सामान्य कीमत",
    unconfirmed: "मूल्य की पुष्टि बाकी",
    unconfirmedHint:
      "रैंकिंग से पहले मुद्रा और बिक्री इकाई की पुष्टि आवश्यक है।",
    pendingNotice:
      "मुद्रा और बिक्री इकाई की पुष्टि होने तक एम्बर रंग की राशियाँ सबसे कम कीमत की रैंकिंग में शामिल नहीं हैं।",
    visibleScope: "इस पेज के समान ऑफ़र में",
    comparisonScope: "चुने गए ऑफ़र में",
    featuredHint:
      "कैटलॉग में चुनिंदा ऑफ़र; इसका अर्थ छूट या सबसे कम कीमत नहीं है।",
    legend: "कीमतों के रंग",
  },
  zh: {
    lowest: "可比服务中的最低价",
    featured: "精选服务",
    regular: "普通价格",
    unconfirmed: "价格待确认",
    unconfirmedHint: "需先确认货币和销售单位，才能进行最低价排名。",
    pendingNotice: "琥珀色金额在货币和销售单位确认前不参与最低价排名。",
    visibleScope: "在本页条件相同的服务中",
    comparisonScope: "在所选服务中",
    featuredHint: "目录精选不代表折扣或最低价格。",
    legend: "价格颜色说明",
  },
};
