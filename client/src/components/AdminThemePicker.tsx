import { Check, Eye, Palette } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { siteThemeCopy } from "@/i18n/siteThemes";
import { appearanceCopy } from "@/i18n/appearance";
import { siteThemeIds, type SiteThemeId } from "../../../shared/siteThemes";
import { Button } from "./ui/button";

export default function AdminThemePicker({
  active,
  preview,
  onPreview,
  onApply,
  busy,
  canSave,
}: {
  active?: SiteThemeId;
  preview: SiteThemeId | null;
  onPreview: (theme: SiteThemeId | null) => void;
  onApply: (theme: SiteThemeId) => void;
  busy: boolean;
  canSave: boolean;
}) {
  const { locale } = useLocale();
  const t = siteThemeCopy[locale];
  return (
    <div
      className="border-b border-border p-5"
      aria-labelledby="site-themes-title"
    >
      <h3 id="site-themes-title" className="flex items-center gap-2 font-bold">
        <Palette className="size-5" />
        {t.title}
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {t.description}
      </p>
      <div
        className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        role="group"
        aria-labelledby="site-themes-title"
      >
        {siteThemeIds.map(id => (
          <button
            key={id}
            type="button"
            data-theme-option={id}
            className="theme-option"
            aria-label={`${t.preview}: ${t.themes[id].name}`}
            aria-pressed={(preview ?? active) === id}
            disabled={busy}
            onClick={() => onPreview(id === active ? null : id)}
          >
            <span
              className="theme-sample"
              data-theme-sample={id}
              aria-hidden="true"
            >
              <span className="theme-sample-nav">
                <b dir="ltr" className="text-[10px]">
                  ProviderBeacon
                </b>
                <span>◇</span>
              </span>
              <span className="theme-sample-title">{t.themes[id].name}</span>
              <span className="theme-sample-grid">
                <span className="theme-sample-card" />
                <span className="theme-sample-card" />
                <span className="theme-sample-card" />
              </span>
              <span className="theme-sample-action" />
            </span>
            <span className="mt-4 flex flex-wrap items-center justify-between gap-2 font-bold">
              {t.themes[id].name}
              {active === id ? (
                <span className="inline-flex items-center gap-1 text-xs text-success">
                  <Check className="size-3" />
                  {t.current}
                </span>
              ) : (
                <Eye
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="mt-2 block min-h-12 text-xs leading-6 text-muted-foreground">
              {t.themes[id].description}
            </span>
          </button>
        ))}
      </div>
      {preview && preview !== active && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-input bg-muted p-4">
          <p role="status" className="text-sm leading-relaxed">
            <strong>{t.themes[preview].name}</strong>
            <span className="mt-1 block text-muted-foreground">
              {t.previewing}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              data-apply-theme
              disabled={!canSave || busy}
              onClick={() => onApply(preview)}
            >
              {busy ? appearanceCopy[locale].saving : t.apply}
            </Button>
            <Button
              type="button"
              data-cancel-theme
              variant="outline"
              disabled={busy}
              onClick={() => onPreview(null)}
            >
              {t.cancel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
