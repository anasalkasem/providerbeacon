import type { Locale } from "@/contexts/LocaleContext";

const en = {
  lowest: "Lowest comparable price",
  featured: "Featured offer",
  regular: "Regular price",
  sourceAmount: "Provider price",
  currencyUnspecified: "currency unspecified",
  currencyMissing: "The source does not identify the currency of this amount.",
  packageMissing: "The contents of this package have not been specified.",
  sourceLink: "View provider details",
  unconfirmed: "Pricing details",
  unconfirmedHint:
    "Shown as published by the provider; excluded from quantity totals and lowest-price ranking.",
  pendingNotice:
    "Lowest prices are calculated for equivalent offers with a known currency. Other amounts are shown as published by the provider.",
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
    sourceAmount: "سعر المزوّد",
    currencyUnspecified: "العملة غير محددة",
    currencyMissing: "المصدر لا يحدد عملة هذا المبلغ.",
    packageMissing: "محتويات هذه الباقة غير محددة.",
    sourceLink: "عرض التفاصيل لدى المزوّد",
    unconfirmed: "تفاصيل التسعير",
    unconfirmedHint:
      "نعرض المبلغ كما نشره المزوّد؛ لا يدخل في حساب إجمالي الكمية أو ترتيب الأرخص.",
    pendingNotice:
      "نحسب الأقل سعرًا بين العروض المتكافئة ذات العملة المحددة. بقية المبالغ تظهر كما نشرها المزوّد.",
    visibleScope: "بين العروض المماثلة في هذه الصفحة",
    comparisonScope: "ضمن العروض المختارة",
    featuredHint: "عرض مميز في الدليل؛ لا يعني وجود خصم أو أنه الأقل سعرًا.",
    legend: "ألوان الأسعار",
  },
  es: {
    lowest: "Menor precio comparable",
    featured: "Oferta destacada",
    regular: "Precio normal",
    sourceAmount: "Precio del proveedor",
    currencyUnspecified: "moneda sin especificar",
    currencyMissing: "La fuente no especifica la moneda de este importe.",
    packageMissing: "El contenido de este paquete no está especificado.",
    sourceLink: "Ver detalles del proveedor",
    unconfirmed: "Detalles del precio",
    unconfirmedHint:
      "Se muestra el importe publicado; se excluye de los totales por cantidad y del ranking de menor precio.",
    pendingNotice:
      "El menor precio se calcula entre ofertas equivalentes con moneda conocida. Los demás importes se muestran como los publicó el proveedor.",
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
    sourceAmount: "प्रदाता की कीमत",
    currencyUnspecified: "मुद्रा निर्दिष्ट नहीं",
    currencyMissing: "स्रोत इस राशि की मुद्रा नहीं बताता है।",
    packageMissing: "इस पैकेज की सामग्री निर्दिष्ट नहीं है।",
    sourceLink: "प्रदाता का विवरण देखें",
    unconfirmed: "मूल्य विवरण",
    unconfirmedHint:
      "प्रदाता की प्रकाशित राशि दिखाई गई है; यह मात्रा के कुल या सबसे कम कीमत की रैंकिंग में शामिल नहीं है।",
    pendingNotice:
      "सबसे कम कीमत समान ऑफ़र में ज्ञात मुद्रा के आधार पर निकाली जाती है। अन्य राशियाँ प्रदाता के अनुसार दिखाई जाती हैं।",
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
    sourceAmount: "供应商报价",
    currencyUnspecified: "未指定货币",
    currencyMissing: "来源未说明此金额的货币。",
    packageMissing: "未说明此套餐的具体内容。",
    sourceLink: "查看供应商详情",
    unconfirmed: "计价详情",
    unconfirmedHint: "按供应商公布的金额展示；不计入数量总价或最低价排名。",
    pendingNotice:
      "最低价仅在货币明确的同类服务中计算。其他金额按供应商公布的报价展示。",
    visibleScope: "在本页条件相同的服务中",
    comparisonScope: "在所选服务中",
    featuredHint: "目录精选不代表折扣或最低价格。",
    legend: "价格颜色说明",
  },
};
