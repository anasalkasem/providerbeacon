export const siteThemeIds = ["beacon"] as const;
export type SiteThemeId = (typeof siteThemeIds)[number];

// Old saved selections and stale client responses resolve to the adopted design.
export function resolveSiteTheme(_value: unknown): SiteThemeId {
  return "beacon";
}

export const siteThemes: Record<
  SiteThemeId,
  { mode: "dark"; background: string }
> = {
  beacon: { mode: "dark", background: "#080b10" },
};
