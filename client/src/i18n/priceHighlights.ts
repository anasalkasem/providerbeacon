import type { Locale } from "@/contexts/LocaleContext";

const en = {
  lowest: "Lowest comparable price",
  featured: "Featured offer",
  regular: "Regular price",
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
    visibleScope: "بين العروض المماثلة في هذه الصفحة",
    comparisonScope: "ضمن العروض المختارة",
    featuredHint: "عرض مميز في الدليل؛ لا يعني وجود خصم أو أنه الأقل سعرًا.",
    legend: "ألوان الأسعار",
  },
  es: {
    lowest: "Menor precio comparable",
    featured: "Oferta destacada",
    regular: "Precio normal",
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
    visibleScope: "在本页条件相同的服务中",
    comparisonScope: "在所选服务中",
    featuredHint: "目录精选不代表折扣或最低价格。",
    legend: "价格颜色说明",
  },
};
