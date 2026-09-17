import { useEffect } from "react";
import { Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/contexts/LocaleContext";
import { useSiteAppearancePreview } from "@/contexts/SiteAppearanceContext";
import { appearanceCopy } from "@/i18n/appearance";
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import AdminThemePicker from "./AdminThemePicker";

export default function AdminAppearance() {
  const { locale } = useLocale();
  const t = appearanceCopy[locale];
  const utils = trpc.useUtils();
  const settings = trpc.admin.appearance.get.useQuery(undefined, {
    retry: false,
  });
  const { preview, setPreview, previewTheme, setPreviewTheme } =
    useSiteAppearancePreview();
  useEffect(
    () => () => {
      setPreview(false);
      setPreviewTheme(null);
    },
    [setPreview, setPreviewTheme]
  );
  const update = trpc.admin.appearance.update.useMutation({
    onSuccess(data, input) {
      utils.admin.appearance.get.setData(undefined, data);
      utils.appearance.public.setData(undefined, {
        edgeGlowEnabled: data.edgeGlowEnabled,
        theme: data.theme,
      });
      void utils.admin.audit.list.invalidate();
      if (input.edgeGlowEnabled !== undefined) setPreview(false);
      if (input.theme !== undefined) setPreviewTheme(null);
      toast.success(t.saved);
    },
    onError(error) {
      toast.error(error.data?.code === "CONFLICT" ? t.conflict : t.error);
      void settings.refetch();
    },
  });
  return (
    <section
      className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-none"
      aria-labelledby="appearance-title"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id="appearance-title" className="font-extrabold text-foreground">
          {t.title}
        </h2>
        <span className="text-xs font-medium text-muted-foreground">
          {t.owner}
        </span>
      </div>
      <AdminThemePicker
        active={settings.isError ? undefined : settings.data?.theme}
        preview={previewTheme}
        onPreview={setPreviewTheme}
        onApply={theme => {
          if (settings.data && !settings.isError)
            update.mutate({ theme, revision: settings.data.revision });
        }}
        busy={update.isPending}
        canSave={!!settings.data && !settings.isError && !settings.isFetching}
      />
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-2xl border border-input bg-secondary text-foreground"
        >
          <Sparkles className="size-6" />
        </div>
        <div className="flex-1">
          <label
            htmlFor="edge-glow-switch"
            className="font-bold text-foreground"
          >
            {t.name}
          </label>
          <p
            id="edge-glow-description"
            className="mt-1 max-w-2xl text-sm leading-relaxed text-secondary-foreground"
          >
            {t.description}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{t.scope}</p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-5 sm:flex-col sm:items-end">
          {settings.isError ? (
            <p role="alert" className="text-sm text-danger">
              {t.loadError}{" "}
              <button
                onClick={() => void settings.refetch()}
                className="underline"
              >
                {t.retry}
              </button>
            </p>
          ) : !settings.data ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t.loading}
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <span
                aria-live="polite"
                className="text-sm font-semibold text-secondary-foreground"
              >
                {update.isPending
                  ? t.saving
                  : settings.data.edgeGlowEnabled
                    ? t.on
                    : t.off}
              </span>
              <Switch
                id="edge-glow-switch"
                dir="ltr"
                aria-describedby="edge-glow-description"
                checked={settings.data.edgeGlowEnabled}
                disabled={update.isPending || settings.isFetching}
                onCheckedChange={edgeGlowEnabled =>
                  update.mutate({
                    edgeGlowEnabled,
                    revision: settings.data!.revision,
                  })
                }
              />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreview(value => !value)}
            aria-pressed={preview}
            className="gap-2 rounded-xl"
          >
            <Eye className="size-4" />
            {preview ? t.stopPreview : t.preview}
          </Button>
        </div>
      </div>
    </section>
  );
}
