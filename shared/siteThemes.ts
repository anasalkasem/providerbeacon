export const siteThemeIds = ["beacon", "orbit", "studio", "daylight"] as const;
export type SiteThemeId = (typeof siteThemeIds)[number];

// Old saved selections and stale client responses resolve to the adopted design.
export function resolveSiteTheme(value: unknown): SiteThemeId {
  return readThemePreview(value) ?? "beacon";
}

// A preview is a local presentation choice, never a write to site settings.
export function readThemePreview(value: unknown): SiteThemeId | null {
  return value === "beacon" ||
    value === "orbit" ||
    value === "studio" ||
    value === "daylight"
    ? value
    : null;
}

export const siteThemes: Record<
  SiteThemeId,
  { mode: "light" | "dark"; background: string }
> = {
  beacon: { mode: "dark", background: "#080b10" },
  orbit: { mode: "dark", background: "#000000" },
  studio: { mode: "dark", background: "#000000" },
  daylight: { mode: "light", background: "#ffffff" },
};
