import { Check, ExternalLink } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { siteThemeCopy } from "@/i18n/siteThemes";
import { workspaceCopy } from "@/i18n/workspace";
import { landingCopy } from "@/i18n/landing";
import { studioCopy } from "@/i18n/studio";
import { siteThemeIds, type SiteThemeId } from "../../../shared/siteThemes";

export default function AdminThemePicker({
  savedTheme,
  disabled,
  onApply,
}: {
  savedTheme?: SiteThemeId;
  disabled: boolean;
  onApply: (theme: SiteThemeId) => void;
}) {
  const { locale } = useLocale();
  const t = siteThemeCopy[locale];
  const w = workspaceCopy[locale];
  const l = landingCopy[locale];
  const s = studioCopy[locale];
  const palettes: Record<SiteThemeId, string[]> = {
    beacon: ["#080b10", "#fff", "#0285fe", "#1e2f48"],
    orbit: ["#000", "#fff", "#8052ff", "#9adfff"],
    studio: ["#000", "#fff", "#a3a3a3", "#343438"],
    daylight: ["#ffffff", "#0061fe", "#142238", "#eaf2ff"],
  };
  return (
    <div className="border-b border-border p-5">
      <p className="mb-5 text-sm leading-7">{t.scope}</p>
      <div className="grid gap-5 lg:grid-cols-2">
        {siteThemeIds.map(theme => (
          <article
            key={theme}
            data-theme-option={theme}
            data-active={savedTheme === theme}
            className="theme-choice"
          >
            <div
              className={`theme-thumbnail theme-thumbnail--${theme}`}
              aria-hidden="true"
            >
              <div className="theme-thumbnail-toolbar">
                <i />
                <i />
                <i />
                <span>providerbeacon.com</span>
              </div>
              <div className="theme-thumbnail-nav">
                <span>ProviderBeacon</span>
                <i />
                <i />
                <i />
              </div>
              <div className="theme-thumbnail-copy">
                <strong>
                  {theme === "studio"
                    ? s.title
                    : theme === "orbit"
                      ? t.hero.title
                      : w.title}
                  <br />
                  {theme === "studio"
                    ? s.accent
                    : theme === "orbit"
                      ? t.hero.accent
                      : w.accent}
                </strong>
                <div className="theme-thumbnail-search">
                  <span>{w.ask}</span>
                  <b>{theme === "studio" ? s.start : l.search}</b>
                </div>
              </div>
              {theme === "orbit" && (
                <div className="theme-thumbnail-orbit">
                  <i />
                  <i />
                  <img
                    src="/images/orbit-lighthouse.webp"
                    alt=""
                    width={960}
                    height={960}
                    loading="lazy"
                  />
                </div>
              )}
              <div className="theme-thumbnail-offers">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">
                  {t.themes[theme].name}
                </h3>
                {savedTheme === theme && (
                  <span className="theme-active-badge inline-flex items-center gap-1.5 text-xs">
                    <Check className="size-4" />
                    {t.current}
                  </span>
                )}
              </div>
              <p className="mt-3 min-h-14 text-sm leading-7">
                {t.themes[theme].description}
              </p>
              <div className="theme-palette" aria-hidden="true">
                {palettes[theme].map(color => (
                  <i key={color} style={{ background: color }} />
                ))}
              </div>
              <div className="theme-choice-actions mt-5 flex flex-wrap items-center gap-3">
                <button
                  className="beacon-button min-h-11 px-5 py-2 disabled:cursor-default disabled:opacity-50"
                  data-apply-theme={theme}
                  disabled={disabled || savedTheme === theme}
                  onClick={() => onApply(theme)}
                >
                  {savedTheme === theme ? t.current : t.apply}
                </button>
                <a
                  href={`/?previewTheme=${theme}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 px-3 text-sm underline underline-offset-4"
                >
                  {t.preview}
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
