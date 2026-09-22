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
  recommended: "Comparable lows first (this page)",
  method: "How highlights work",
  explanation:
    "Green marks the lowest price within each group of equivalent offers on this page, for your selected quantity. Currency, sale unit, service, market, refill and quality must match. Missing terms and starting prices are excluded. This is a price comparison, not a quality rating.",
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
    recommended: "الأقل بين العروض المتكافئة أولًا (بالصفحة)",
    method: "كيف نميّز الأسعار؟",
    explanation:
      "الأخضر يميّز أقل سعر ضمن كل مجموعة عروض متكافئة في هذه الصفحة، للكمية التي حددتها. يجب تطابق العملة ووحدة البيع والخدمة والسوق والتعويض والجودة. نستثني الشروط غير المحددة والأسعار الابتدائية. هذه مقارنة سعرية وليست تقييمًا للجودة.",
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
    recommended: "Menores precios comparables primero (esta página)",
    method: "Cómo se destacan los precios",
    explanation:
      "El verde indica el menor precio de cada grupo de ofertas equivalentes de esta página para la cantidad elegida. Deben coincidir moneda, unidad, servicio, mercado, reposición y calidad. Se excluyen condiciones desconocidas y precios iniciales. Se compara el precio, no la calidad.",
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
    recommended: "तुलनीय न्यूनतम कीमतें पहले (यह पृष्ठ)",
    method: "कीमतें कैसे हाइलाइट होती हैं",
    explanation:
      "हरा रंग चुनी गई मात्रा के लिए इस पृष्ठ के हर समान ऑफ़र समूह की सबसे कम कीमत दिखाता है। मुद्रा, इकाई, सेवा, बाज़ार, रीफ़िल और गुणवत्ता समान होनी चाहिए। अज्ञात शर्तें और शुरुआती कीमतें शामिल नहीं हैं। यह कीमत की तुलना है, गुणवत्ता की रेटिंग नहीं।",
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
    recommended: "本页可比最低价优先",
    method: "价格标记说明",
    explanation:
      "绿色标记本页每组同等优惠中适用于所选数量的最低价格。货币、计价单位、服务、市场、补量和质量必须一致。未知条款及起步价不参与比较。这是价格比较，不是质量评级。",
  },
};
