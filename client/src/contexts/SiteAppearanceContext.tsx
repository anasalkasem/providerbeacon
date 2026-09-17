import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { EdgeGlow } from "@/components/EdgeGlow";
import { trpc } from "@/lib/trpc";
import { ThemeProvider } from "./ThemeContext";
import {
  readThemePreview,
  resolveSiteTheme,
  siteThemes,
  type SiteThemeId,
} from "../../../shared/siteThemes";
import { useLocale } from "./LocaleContext";
import { siteThemeCopy } from "@/i18n/siteThemes";

const SiteAppearanceContext = createContext<{
  preview: boolean;
  setPreview: Dispatch<SetStateAction<boolean>>;
  theme: SiteThemeId;
} | null>(null);

export function SiteAppearanceProvider({ children }: { children: ReactNode }) {
  const appearance = trpc.appearance.public.useQuery(undefined, {
    staleTime: 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const [preview, setPreview] = useState(false);
  const [themePreview, setThemePreview] = useState(() =>
    typeof window === "undefined"
      ? null
      : readThemePreview(
          new URLSearchParams(window.location.search).get("previewTheme")
        )
  );
  const theme = themePreview ?? resolveSiteTheme(appearance.data?.theme);
  const value = useMemo(
    () => ({ preview, setPreview, theme }),
    [preview, theme]
  );
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.getAttribute("data-site-theme");
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]'
    );
    const previousColor = meta?.content;
    root.setAttribute("data-site-theme", theme);
    if (meta) meta.content = siteThemes[theme].background;
    return () => {
      if (previousTheme === null) root.removeAttribute("data-site-theme");
      else root.setAttribute("data-site-theme", previousTheme);
      if (meta && previousColor !== undefined) meta.content = previousColor;
    };
  }, [theme]);
  // Retain the last saved setting if a background refresh fails, so the light
  // doesn't blink with network activity. Initial loading/errors stay off.
  const enabled = appearance.data?.edgeGlowEnabled === true || preview;
  return (
    <SiteAppearanceContext.Provider value={value}>
      <ThemeProvider forcedTheme={siteThemes[theme].mode}>
        <div
          className="beacon-appearance"
          data-beacon-glow={enabled ? "on" : "off"}
        >
          {themePreview && (
            <ThemePreviewBanner
              theme={themePreview}
              onExit={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete("previewTheme");
                window.history.replaceState(window.history.state, "", url);
                setThemePreview(null);
              }}
            />
          )}
          {children}
          <EdgeGlow enabled={enabled} />
        </div>
      </ThemeProvider>
    </SiteAppearanceContext.Provider>
  );
}

// Locale is a dependency of the preview copy, not of appearance rendering.
function ThemePreviewBanner({
  theme,
  onExit,
}: {
  theme: SiteThemeId;
  onExit: () => void;
}) {
  const { locale } = useLocale();
  const t = siteThemeCopy[locale];
  return (
    <aside className="theme-preview-banner" aria-label={t.previewBanner}>
      <span>
        {t.previewBanner} · {t.themes[theme].name}
      </span>
      <button onClick={onExit}>{t.leavePreview}</button>
    </aside>
  );
}

export function useSiteTheme(): SiteThemeId {
  return useContext(SiteAppearanceContext)?.theme ?? "beacon";
}

export function useSiteAppearancePreview() {
  const context = useContext(SiteAppearanceContext);
  if (!context) throw new Error("SiteAppearanceProvider is required");
  return context;
}
