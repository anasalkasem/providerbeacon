import type { Locale } from "@/contexts/LocaleContext";

const en = {
  results: "Offer results",
  serviceProvider: "Service and provider",
  compare: "Compare",
  selected: "Selected",
  startRefill: "Start and refill",
  market: "Market",
  worldwide: "Worldwide",
  unspecified: "Unspecified",
  lowest: "Lowest price",
  lowestFirst: "Lowest comparable prices on this page appear first.",
  lowestMarked: "Lowest comparable prices on this page are highlighted.",
  recommended: "Default order",
  method: "How prices are ordered",
  explanation:
    "Price sorting orders all matching results, across pages, in one currency. Advertising does not change this order. Select offers to compare their terms. A lower price is not a quality rating.",
};

export const offerResultsCopy: Record<Locale, typeof en> = {
  en,
  ar: {
    results: "نتائج العروض",
    serviceProvider: "الخدمة والمزود",
    compare: "قارن",
    selected: "تم الاختيار",
    startRefill: "البدء والتعويض",
    market: "السوق",
    worldwide: "عالمي",
    unspecified: "غير محدد",
    lowest: "الأقل سعرًا",
    lowestFirst: "أقل الأسعار بين العروض المتكافئة في هذه الصفحة تظهر أولًا.",
    lowestMarked:
      "أقل الأسعار بين العروض المتكافئة في هذه الصفحة مميزة بالأخضر.",
    recommended: "الترتيب الافتراضي",
    method: "كيف نرتّب الأسعار؟",
    explanation:
      "ترتيب السعر يشمل كل النتائج المطابقة عبر الصفحات ضمن عملة واحدة. الإعلان لا يغيّر هذا الترتيب. اختر العروض لمقارنة شروطها؛ السعر الأقل ليس تقييمًا للجودة.",
  },
  es: {
    results: "Resultados de ofertas",
    serviceProvider: "Servicio y proveedor",
    compare: "Comparar",
    selected: "Seleccionado",
    startRefill: "Inicio y reposición",
    market: "Mercado",
    worldwide: "Mundial",
    unspecified: "Sin especificar",
    lowest: "Menor precio",
    lowestFirst:
      "Los menores precios comparables de esta página aparecen primero.",
    lowestMarked:
      "Los menores precios comparables de esta página están destacados.",
    recommended: "Orden predeterminado",
    method: "Cómo se ordenan los precios",
    explanation:
      "El orden por precio abarca todas las páginas, con una misma moneda. Los anuncios no cambian este orden. Selecciona ofertas para comparar sus condiciones. Un menor precio no indica mayor calidad.",
  },
  hi: {
    results: "ऑफ़र के परिणाम",
    serviceProvider: "सेवा और प्रदाता",
    compare: "तुलना",
    selected: "चुना गया",
    startRefill: "शुरुआत और रीफ़िल",
    market: "बाज़ार",
    worldwide: "विश्वभर",
    unspecified: "निर्दिष्ट नहीं",
    lowest: "सबसे कम कीमत",
    lowestFirst: "इस पृष्ठ की सबसे कम तुलनीय कीमतें पहले दिखाई जाती हैं।",
    lowestMarked: "इस पृष्ठ की सबसे कम तुलनीय कीमतें हाइलाइट की गई हैं।",
    recommended: "डिफ़ॉल्ट क्रम",
    method: "कीमतें कैसे क्रमबद्ध होती हैं",
    explanation:
      "कीमत का क्रम सभी पृष्ठों पर एक ही मुद्रा वाले परिणामों पर लागू होता है। विज्ञापन क्रम नहीं बदलते। शर्तों की तुलना के लिए ऑफ़र चुनें। कम कीमत गुणवत्ता की रेटिंग नहीं है।",
  },
  zh: {
    results: "优惠结果",
    serviceProvider: "服务与供应商",
    compare: "比较",
    selected: "已选择",
    startRefill: "开始与补量",
    market: "市场",
    worldwide: "全球",
    unspecified: "未指定",
    lowest: "最低价格",
    lowestFirst: "本页各组可比优惠中的最低价格优先显示。",
    lowestMarked: "本页各组可比优惠中的最低价格已突出显示。",
    recommended: "默认排序",
    method: "价格排序说明",
    explanation:
      "价格排序涵盖所有页面中使用同一货币的匹配结果。广告不会改变排序。选择优惠以比较条款；价格更低不代表质量更好。",
  },
};
