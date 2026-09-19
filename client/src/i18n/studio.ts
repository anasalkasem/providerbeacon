import type { Locale } from "@/contexts/LocaleContext";

const en = {
  announcement: "ProviderBeacon, on your phone",
  readMore: "Discover the app",
  title: "Your next provider.",
  accent: "A clearer choice.",
  intro:
    "Discover real provider offers, understand their terms and compare your options. One place to make your next move.",
  start: "Find your service",
  how: "How it works",
  workspace: "Your comparison workspace",
  browse: "All services",
};

export const studioCopy: Record<Locale, typeof en> = {
  en,
  ar: {
    announcement: "ProviderBeacon، على هاتفك",
    readMore: "اكتشف التطبيق",
    title: "مزوّدك القادم،",
    accent: "يبدأ باختيار أوضح.",
    intro:
      "اكتشف عروض المزوّدين الفعلية، افهم شروطها وقارن خياراتك. كل ما تحتاجه لخطوتك القادمة، في مكان واحد.",
    start: "ابحث عن خدمتك",
    how: "كيف تعمل المنصة",
    workspace: "مساحة المقارنة",
    browse: "جميع الخدمات",
  },
  es: {
    announcement: "ProviderBeacon, en tu teléfono",
    readMore: "Descubre la app",
    title: "Tu próximo proveedor.",
    accent: "Una decisión más clara.",
    intro:
      "Descubre ofertas reales, entiende sus condiciones y compara tus opciones. Un solo lugar para dar el siguiente paso.",
    start: "Encuentra tu servicio",
    how: "Cómo funciona",
    workspace: "Tu espacio de comparación",
    browse: "Todos los servicios",
  },
  hi: {
    announcement: "ProviderBeacon, अब आपके फ़ोन पर",
    readMore: "ऐप देखें",
    title: "आपका अगला प्रदाता।",
    accent: "एक स्पष्ट चुनाव।",
    intro:
      "वास्तविक ऑफ़र खोजें, उनकी शर्तें समझें और अपने विकल्पों की तुलना करें। आपके अगले कदम के लिए एक ही जगह।",
    start: "अपनी सेवा खोजें",
    how: "यह कैसे काम करता है",
    workspace: "आपका तुलना कार्यक्षेत्र",
    browse: "सभी सेवाएँ",
  },
  zh: {
    announcement: "在手机上使用 ProviderBeacon",
    readMore: "了解应用",
    title: "发现下一家服务商。",
    accent: "做出更清晰的选择。",
    intro:
      "探索真实报价，了解服务条款，比较不同选项。在同一个地方，找到下一步的方向。",
    start: "查找服务",
    how: "使用流程",
    workspace: "你的比较工作区",
    browse: "全部服务",
  },
};
