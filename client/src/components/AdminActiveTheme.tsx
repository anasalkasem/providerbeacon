import { Check, Palette } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { siteThemeCopy } from "@/i18n/siteThemes";

export default function AdminActiveTheme() {
  const { locale } = useLocale();
  const t = siteThemeCopy[locale];
  return (
    <div className="grid gap-6 border-b border-border p-5 sm:grid-cols-[240px_1fr] sm:items-center">
      <div
        className="rounded-xl border border-input bg-background p-5"
        aria-hidden="true"
      >
        <b dir="ltr" className="text-sm">
          ProviderBeacon
        </b>
        <div className="mt-6 h-3 w-4/5 rounded bg-foreground" />
        <div className="mt-3 h-2 w-3/5 rounded bg-foreground/80" />
        <div className="mt-5 h-9 rounded-lg border border-primary bg-card" />
        <div className="mt-4 h-7 w-1/2 rounded-lg bg-primary" />
      </div>
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-input px-3 py-1.5 text-xs">
          <Check className="size-4 text-primary" />
          {t.current}
        </span>
        <h3 className="mt-4 flex items-center gap-2 text-xl font-bold">
          <Palette className="size-5 text-primary" />
          {t.name}
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-7">{t.description}</p>
      </div>
    </div>
  );
}
