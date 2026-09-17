import { useEffect, useRef, useState } from "react";
import { Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/contexts/LocaleContext";
import { appearanceCopy } from "@/i18n/appearance";
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { EdgeGlow } from "./EdgeGlow";

export default function AdminAppearance() {
  const { locale } = useLocale();
  const t = appearanceCopy[locale];
  const utils = trpc.useUtils();
  const settings = trpc.admin.appearance.get.useQuery(undefined, {
    retry: false,
  });
  const [preview, setPreview] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const update = trpc.admin.appearance.update.useMutation({
    onSuccess(data) {
      utils.admin.appearance.get.setData(undefined, data);
      utils.appearance.public.setData(undefined, {
        edgeGlowEnabled: data.edgeGlowEnabled,
      });
      void utils.admin.audit.list.invalidate();
      if (!data.edgeGlowEnabled) setPreview(false);
      toast.success(t.saved);
    },
    onError(error) {
      toast.error(error.data?.code === "CONFLICT" ? t.conflict : t.error);
      void settings.refetch();
    },
  });
  function showPreview() {
    clearTimeout(timer.current);
    setPreview(true);
    timer.current = setTimeout(() => setPreview(false), 3200);
  }
  return (
    <section
      className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-labelledby="appearance-title"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 id="appearance-title" className="font-extrabold text-slate-950">
          {t.title}
        </h2>
        <span className="text-xs font-medium text-slate-500">{t.owner}</span>
      </div>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-100 via-violet-100 to-pink-100 text-violet-700"
        >
          <Sparkles className="size-6" />
        </div>
        <div className="flex-1">
          <label
            htmlFor="edge-glow-switch"
            className="font-bold text-slate-950"
          >
            {t.name}
          </label>
          <p
            id="edge-glow-description"
            className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600"
          >
            {t.description}
          </p>
          <p className="mt-2 text-xs text-slate-500">{t.scope}</p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-5 sm:flex-col sm:items-end">
          {settings.isError ? (
            <p role="alert" className="text-sm text-red-700">
              {t.loadError}{" "}
              <button
                onClick={() => void settings.refetch()}
                className="underline"
              >
                {t.retry}
              </button>
            </p>
          ) : !settings.data ? (
            <p role="status" className="text-sm text-slate-500">
              {t.loading}
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <span
                aria-live="polite"
                className="text-sm font-semibold text-slate-600"
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
            onClick={showPreview}
            disabled={preview}
            className="gap-2 rounded-xl"
          >
            <Eye className="size-4" />
            {t.preview}
          </Button>
        </div>
      </div>
      <EdgeGlow phase={preview ? "welcome" : null} />
    </section>
  );
}
