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
  resolveSiteTheme,
  siteThemes,
  type SiteThemeId,
} from "../../../shared/siteThemes";

const SiteAppearanceContext = createContext<{
  preview: boolean;
  setPreview: Dispatch<SetStateAction<boolean>>;
  previewTheme: SiteThemeId | null;
  setPreviewTheme: Dispatch<SetStateAction<SiteThemeId | null>>;
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
  const [previewTheme, setPreviewTheme] = useState<SiteThemeId | null>(null);
  const theme = previewTheme ?? resolveSiteTheme(appearance.data?.theme);
  const value = useMemo(
    () => ({ preview, setPreview, previewTheme, setPreviewTheme }),
    [preview, previewTheme]
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
          {children}
          <EdgeGlow enabled={enabled} />
        </div>
      </ThemeProvider>
    </SiteAppearanceContext.Provider>
  );
}

export function useSiteAppearancePreview() {
  const context = useContext(SiteAppearanceContext);
  if (!context) throw new Error("SiteAppearanceProvider is required");
  return context;
}
