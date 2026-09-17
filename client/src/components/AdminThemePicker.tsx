import { Check, ExternalLink } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { siteThemeCopy } from "@/i18n/siteThemes";
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
  return (
    <div className="border-b border-border p-5">
      <p className="mb-5 text-sm leading-7">{t.scope}</p>
      <div className="grid gap-5 lg:grid-cols-2">
        {siteThemeIds.map(theme => (
          <article
            key={theme}
            data-theme-option={theme}
            className="theme-choice"
          >
            <div
              className={`theme-thumbnail theme-thumbnail--${theme}`}
              aria-hidden="true"
            >
              <span className="theme-thumbnail-brand">ProviderBeacon</span>
              <div className="theme-thumbnail-copy">
                <i />
                <i />
                <b />
              </div>
              {theme === "orbit" && (
                <div className="theme-thumbnail-orbit">
                  <i />
                  <i />
                  <b />
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">
                  {t.themes[theme].name}
                </h3>
                {savedTheme === theme && (
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <Check className="size-4" />
                    {t.current}
                  </span>
                )}
              </div>
              <p className="mt-3 min-h-14 text-sm leading-7">
                {t.themes[theme].description}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
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
