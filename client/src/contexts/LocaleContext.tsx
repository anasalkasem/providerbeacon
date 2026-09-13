import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "es" | "ar" | "hi" | "zh";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: "ltr" | "rtl";
};

const supported: Locale[] = ["en", "es", "ar", "hi", "zh"];
const LocaleContext = createContext<LocaleContextValue | null>(null);

function detectLocale(): Locale {
  const requested = new URLSearchParams(window.location.search).get("lang") as Locale | null;
  if (requested && supported.includes(requested)) {
    window.localStorage.setItem("providerbeacon-locale", requested);
    return requested;
  }
  const saved = window.localStorage.getItem("providerbeacon-locale") as Locale | null;
  if (saved && supported.includes(saved)) return saved;
  const language = navigator.language.toLowerCase();
  if (language.startsWith("ar")) return "ar";
  if (language.startsWith("hi")) return "hi";
  if (language.startsWith("zh")) return "zh";
  if (language.startsWith("es")) return "es";
  return "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());
  const setLocale = (value: Locale) => {
    window.localStorage.setItem("providerbeacon-locale", value);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", value);
    window.history.replaceState(window.history.state, "", url);
    setLocaleState(value);
  };
  const dir: "ltr" | "rtl" = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const value = useMemo(() => ({ locale, setLocale, dir }), [locale, dir]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ar: "العربية",
  hi: "हिन्दी",
  zh: "简体中文",
};

export const copy = {
  en: { navServices: "Discover services", navProviders: "Providers", navCompare: "Compare", navInsights: "Trust methodology", signIn: "Sign in", heroEyebrow: "The provider intelligence layer", heroTitle: "Find the right growth service, with data you can trust.", heroBody: "Compare prices, delivery speed, quality, refill protection and provider reliability in one transparent workspace.", searchPlaceholder: "Describe what you need, e.g. fast TikTok views under $2", askAi: "Ask Beacon AI", explore: "Explore all services", verified: "Verified providers", services: "Services indexed", checked: "Prices checked today", bestMatches: "Best matches for you", bestBody: "Ranked using price, retention, delivery and provider reliability.", viewAll: "View all services", compare: "Compare", viewProvider: "View provider", trustedTitle: "Trusted providers, evaluated beyond price", trustedBody: "Every score explains the signals behind it—so you can make a decision, not a guess.", methodology: "See our methodology", admin: "Control Center" },
  es: { navServices: "Descubrir servicios", navProviders: "Proveedores", navCompare: "Comparar", navInsights: "Metodología de confianza", signIn: "Ingresar", heroEyebrow: "La capa de inteligencia de proveedores", heroTitle: "Encuentra el servicio adecuado con datos confiables.", heroBody: "Compara precios, velocidad, calidad, reposición y confiabilidad en un solo espacio transparente.", searchPlaceholder: "Describe lo que necesitas, p. ej. vistas rápidas de TikTok por menos de $2", askAi: "Preguntar a Beacon AI", explore: "Explorar servicios", verified: "Proveedores verificados", services: "Servicios indexados", checked: "Precios revisados hoy", bestMatches: "Mejores opciones para ti", bestBody: "Ordenadas por precio, retención, entrega y confiabilidad.", viewAll: "Ver todos", compare: "Comparar", viewProvider: "Ver proveedor", trustedTitle: "Proveedores confiables, evaluados más allá del precio", trustedBody: "Cada puntaje explica sus señales para que puedas decidir con claridad.", methodology: "Ver metodología", admin: "Centro de control" },
  ar: { navServices: "اكتشف الخدمات", navProviders: "المزودون", navCompare: "المقارنة", navInsights: "منهجية الثقة", signIn: "تسجيل الدخول", heroEyebrow: "طبقة معلومات المزودين", heroTitle: "اعثر على خدمة النمو المناسبة ببيانات يمكنك الوثوق بها.", heroBody: "قارن الأسعار والسرعة والجودة والضمان وموثوقية المزود في مساحة شفافة واحدة.", searchPlaceholder: "صف ما تحتاجه، مثال: مشاهدات تيك توك سريعة بأقل من دولارين", askAi: "اسأل Beacon AI", explore: "استكشف الخدمات", verified: "مزودون موثقون", services: "خدمات مفهرسة", checked: "أسعار تحقّقنا منها اليوم", bestMatches: "أفضل الخيارات لك", bestBody: "مرتبة حسب السعر والاستبقاء والتسليم وموثوقية المزود.", viewAll: "عرض كل الخدمات", compare: "قارن", viewProvider: "عرض المزود", trustedTitle: "مزودون موثوقون، بتقييم يتجاوز السعر", trustedBody: "كل درجة تشرح الإشارات التي صنعتها كي تتخذ قرارًا لا تخمينًا.", methodology: "شاهد المنهجية", admin: "مركز التحكم" },
  hi: { navServices: "सेवाएँ खोजें", navProviders: "प्रदाता", navCompare: "तुलना", navInsights: "विश्वास पद्धति", signIn: "साइन इन", heroEyebrow: "प्रदाता इंटेलिजेंस लेयर", heroTitle: "भरोसेमंद डेटा के साथ सही ग्रोथ सेवा पाएँ।", heroBody: "कीमत, गति, गुणवत्ता, रिफिल सुरक्षा और विश्वसनीयता की तुलना एक जगह करें।", searchPlaceholder: "अपनी ज़रूरत बताएँ, जैसे $2 से कम में तेज़ TikTok views", askAi: "Beacon AI से पूछें", explore: "सभी सेवाएँ देखें", verified: "सत्यापित प्रदाता", services: "सूचीबद्ध सेवाएँ", checked: "आज जाँची गई कीमतें", bestMatches: "आपके लिए सर्वोत्तम विकल्प", bestBody: "कीमत, रिटेंशन, डिलीवरी और विश्वसनीयता पर क्रमबद्ध।", viewAll: "सभी सेवाएँ", compare: "तुलना करें", viewProvider: "प्रदाता देखें", trustedTitle: "कीमत से आगे मूल्यांकन किए गए विश्वसनीय प्रदाता", trustedBody: "हर स्कोर के पीछे स्पष्ट संकेत दिखते हैं।", methodology: "पद्धति देखें", admin: "कंट्रोल सेंटर" },
  zh: { navServices: "发现服务", navProviders: "服务商", navCompare: "比较", navInsights: "信任方法", signIn: "登录", heroEyebrow: "服务商智能层", heroTitle: "用可信数据找到合适的增长服务。", heroBody: "在一个透明空间中比较价格、速度、质量、补充保障和服务商可靠性。", searchPlaceholder: "描述需求，例如 2 美元以下的快速 TikTok 播放量", askAi: "询问 Beacon AI", explore: "浏览所有服务", verified: "已验证服务商", services: "已索引服务", checked: "今日已核价格", bestMatches: "最适合您的选项", bestBody: "根据价格、留存、交付和可靠性排序。", viewAll: "查看全部", compare: "比较", viewProvider: "查看服务商", trustedTitle: "可信服务商，不止比较价格", trustedBody: "每个评分都解释其依据，帮助您做出清晰决定。", methodology: "查看方法", admin: "控制中心" },
} as const;
