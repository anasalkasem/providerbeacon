import type { Locale } from "@/contexts/LocaleContext";

export const siteThemeCopy: Record<
  Locale,
  { name: string; current: string; description: string }
> = {
  ar: {
    name: "تصميم ProviderBeacon",
    current: "التصميم المعتمد",
    description:
      "خلفية سوداء، نصوص بيضاء، وأزرار وإطارات باللون الأزرق. هذا هو التصميم المعتمد لجميع صفحات الموقع.",
  },
  en: {
    name: "ProviderBeacon design",
    current: "Active design",
    description:
      "Black backgrounds, white text, and blue buttons and borders. This design applies across the entire site.",
  },
  es: {
    name: "Diseño de ProviderBeacon",
    current: "Diseño activo",
    description:
      "Fondos negros, texto blanco, botones y bordes azules. Este diseño se aplica a todo el sitio.",
  },
  hi: {
    name: "ProviderBeacon डिज़ाइन",
    current: "सक्रिय डिज़ाइन",
    description:
      "काली पृष्ठभूमि, सफ़ेद पाठ और नीले बटन व बॉर्डर। पूरी साइट पर यही डिज़ाइन लागू है।",
  },
  zh: {
    name: "ProviderBeacon 设计",
    current: "当前设计",
    description:
      "黑色背景、白色文字以及蓝色按钮和边框。整个网站统一使用此设计。",
  },
};
