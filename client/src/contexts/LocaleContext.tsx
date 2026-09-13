import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "es";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: "ltr";
};

const supported: Locale[] = ["en", "es"];
const LocaleContext = createContext<LocaleContextValue | null>(null);

function detectLocale(): Locale {
  const saved = window.localStorage.getItem("providerbeacon-locale") as Locale | null;
  if (saved && supported.includes(saved)) return saved;
  const language = navigator.language.toLowerCase();
  if (language.startsWith("es")) return "es";
  return "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());
  const setLocale = (value: Locale) => {
    window.localStorage.setItem("providerbeacon-locale", value);
    setLocaleState(value);
  };
  const dir = "ltr" as const;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, dir }), [locale]);
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
};

export const copy = {
  en: {
    navServices: "Discover services",
    navProviders: "Our Trusted Providers",
    navCompare: "Compare",
    navInsights: "Trust methodology",
    signIn: "Sign in",
    heroEyebrow: "The SMM Provider Intelligence Layer",
    heroTitle: "Find verified SMM panels & compare real prices with zero guesswork.",
    heroBody: "Aggregate prices, API response times, retention guarantees, and refill protection across top-tier SMM providers in one transparent workspace.",
    searchPlaceholder: "Search any service, e.g. TikTok views under $1, Instagram followers, YouTube subscribers...",
    askAi: "Compare with AI",
    explore: "Explore all services",
    verified: "Audited SMM panels",
    services: "Services indexed",
    checked: "Real-time API sync",
    bestMatches: "Best wholesale matches",
    bestBody: "Ranked dynamically using price index, verified retention, API speed, and refill reliability.",
    viewAll: "View all services",
    compare: "Compare",
    viewProvider: "View provider audit",
    trustedTitle: "Our Trusted SMM Providers & Verified Panels",
    trustedBody: "Every SMM panel is independently tested on API latency, order fulfillment rate, refill integrity, and payment diversity.",
    methodology: "See our audit methodology",
    admin: "Control Center",
  },
  es: {
    navServices: "Descubrir servicios",
    navProviders: "Nuestros proveedores confiables",
    navCompare: "Comparar",
    navInsights: "Metodología de confianza",
    signIn: "Ingresar",
    heroEyebrow: "La capa de inteligencia de paneles SMM",
    heroTitle: "Encuentra paneles SMM verificados y compara precios reales sin adivinanzas.",
    heroBody: "Compara precios, tiempos de respuesta de API, garantías de retención y protección de reposición en un solo espacio transparente.",
    searchPlaceholder: "Busca servicios, ej: vistas de TikTok por menos de $1, seguidores de Instagram...",
    askAi: "Comparar con IA",
    explore: "Explorar todos los servicios",
    verified: "Paneles SMM auditados",
    services: "Servicios indexados",
    checked: "Sincronización de API en vivo",
    bestMatches: "Mejores opciones mayoristas",
    bestBody: "Clasificadas dinámicamente según precio, retención comprobada, velocidad de API y reposición.",
    viewAll: "Ver todos los servicios",
    compare: "Comparar",
    viewProvider: "Ver auditoría del panel",
    trustedTitle: "Nuestros proveedores confiables y paneles verificados",
    trustedBody: "Cada panel SMM es probado independientemente en latencia de API, tasa de entrega, reposición y métodos de pago.",
    methodology: "Ver metodología de auditoría",
    admin: "Centro de control",
  },
} as const;
