export const siteThemeIds = [
  "copper",
  "summer",
  "midnight",
  "pearl",
  "fire",
  "navy",
] as const;
export type SiteThemeId = (typeof siteThemeIds)[number];

export function resolveSiteTheme(value: unknown): SiteThemeId {
  return siteThemeIds.includes(value as SiteThemeId)
    ? (value as SiteThemeId)
    : "copper";
}

export const siteThemes: Record<
  SiteThemeId,
  { mode: "light" | "dark"; background: string }
> = {
  copper: { mode: "dark", background: "#191d23" },
  summer: { mode: "light", background: "#f2faf7" },
  midnight: { mode: "dark", background: "#0e192c" },
  pearl: { mode: "light", background: "#f6f3ee" },
  fire: { mode: "dark", background: "#0c0c0e" },
  navy: { mode: "light", background: "#ffffff" },
};
