export const siteThemeIds = ["beacon", "orbit"] as const;
export type SiteThemeId = (typeof siteThemeIds)[number];

// Old saved selections and stale client responses resolve to the adopted design.
export function resolveSiteTheme(value: unknown): SiteThemeId {
  return value === "orbit" ? "orbit" : "beacon";
}

// A preview is a local presentation choice, never a write to site settings.
export function readThemePreview(value: unknown): SiteThemeId | null {
  return value === "beacon" || value === "orbit" ? value : null;
}

export const siteThemes: Record<
  SiteThemeId,
  { mode: "dark"; background: string }
> = {
  beacon: { mode: "dark", background: "#080b10" },
  orbit: { mode: "dark", background: "#000000" },
};
