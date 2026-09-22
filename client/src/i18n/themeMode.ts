import type { Locale } from "@/contexts/LocaleContext";

export const themeModeCopy: Record<Locale, { light: string; dark: string }> = {
  ar: { light: "تفعيل الوضع النهاري", dark: "تفعيل الوضع الليلي" },
  en: { light: "Switch to light mode", dark: "Switch to dark mode" },
  es: { light: "Activar modo claro", dark: "Activar modo oscuro" },
  hi: { light: "लाइट मोड चालू करें", dark: "डार्क मोड चालू करें" },
  zh: { light: "切换到日间模式", dark: "切换到夜间模式" },
};
