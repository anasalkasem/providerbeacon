import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/contexts/LocaleContext";
import { providerProfileCopy } from "@/i18n/providerProfile";
import { trpc } from "@/lib/trpc";
import {
  providerProfileInput,
  type ProviderProfileInput,
} from "../../../shared/providerProfile";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { ProviderImage } from "./ProviderMedia";

type Draft = ProviderProfileInput;
type Profile = Omit<Draft, "description"> & {
  description: string | null;
  slug: string;
  isPublic: boolean;
};
const toDraft = ({ slug: _, isPublic: __, ...profile }: Profile): Draft => ({
  ...profile,
  description: profile.description ?? "",
});
export default function ProviderProfileEditor({
  providerId,
}: {
  providerId: number;
}) {
  const { locale } = useLocale();
  const t = providerProfileCopy[locale];
  const utils = trpc.useUtils();
  const profile = trpc.admin.providers.profile.useQuery(
    { id: providerId },
    { retry: false }
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [original, setOriginal] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<{
    logoUrl: string | null;
    websitePreviewUrl: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const adopt = (value: Profile) => {
    const next = toDraft(value);
    setDraft(next);
    setOriginal(next);
    setPreview(next);
    setError(null);
    setConflict(false);
  };
  useEffect(() => {
    // Background refetches must not overwrite an unsaved form or its revision.
    if (profile.data && !draft) adopt(profile.data);
  }, [profile.data, draft]);
  const save = trpc.admin.providers.saveProfile.useMutation({
    onSuccess: async value => {
      adopt(value);
      utils.admin.providers.profile.setData({ id: providerId }, value);
      toast.success(t.saved);
      await Promise.all([
        utils.admin.providers.page.invalidate(),
        utils.admin.providers.list.invalidate(),
        utils.admin.integrations.list.invalidate(),
        utils.admin.audit.list.invalidate(),
        utils.marketplace.snapshot.invalidate(),
      ]);
    },
    onError: failure => {
      const stale = failure.data?.code === "CONFLICT";
      setConflict(stale);
      setError(
        stale
          ? t.conflict
          : failure.message === "PROFILE_URL_UNREACHABLE"
            ? t.unreachable
            : failure.data?.code === "BAD_REQUEST"
              ? t.invalid
              : t.failed
      );
    },
  });
  if (profile.isLoading || (!draft && !profile.error))
    return (
      <p
        role="status"
        className="flex items-center gap-2 py-6 text-sm text-slate-600"
      >
        <Loader2 className="size-4 animate-spin" />
        {t.loading}
      </p>
    );
  if (!draft)
    return (
      <div role="alert" className="py-4">
        <p className="mb-3 text-sm text-red-700">{t.loadError}</p>
        <Button variant="outline" onClick={() => void profile.refetch()}>
          {t.retry}
        </Button>
      </div>
    );
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const update = (field: keyof Draft, value: string) =>
    setDraft(current => (current ? { ...current, [field]: value } : current));
  return (
    <form
      className="mt-5 space-y-5"
      aria-label={t.title}
      onSubmit={event => {
        event.preventDefault();
        const parsed = providerProfileInput.safeParse(draft);
        if (!parsed.success) {
          setError(t.invalid);
          return;
        }
        if (!dirty || save.isPending || conflict) return;
        setError(null);
        save.mutate(parsed.data);
      }}
    >
      <fieldset
        disabled={save.isPending}
        className="grid min-w-0 gap-4 sm:grid-cols-2 disabled:opacity-70"
      >
        <label className="grid gap-2 text-sm font-semibold">
          <span>{t.name}</span>
          <Input
            dir="auto"
            value={draft.name}
            minLength={2}
            maxLength={200}
            required
            onChange={event => update("name", event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          <span>{t.websiteUrl}</span>
          <Input
            dir="ltr"
            type="url"
            maxLength={500}
            value={draft.websiteUrl ?? ""}
            placeholder="https://provider.example"
            onChange={event => update("websiteUrl", event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
          <span>{t.description}</span>
          <Textarea
            dir="auto"
            rows={3}
            maxLength={2000}
            value={draft.description}
            onChange={event => update("description", event.target.value)}
          />
        </label>
        {(["logoUrl", "websitePreviewUrl"] as const).map(field => (
          <label key={field} className="grid gap-2 text-sm font-semibold">
            <span>{t[field]}</span>
            <Input
              dir="ltr"
              type="url"
              maxLength={500}
              value={draft[field] ?? ""}
              placeholder={
                field === "logoUrl"
                  ? "https://provider.example/logo.png"
                  : "https://provider.example/website.jpg"
              }
              onChange={event => update(field, event.target.value)}
            />
          </label>
        ))}
        <p className="text-xs leading-6 text-slate-500 sm:col-span-2">
          {t.linksHelp}
        </p>
        <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
          <span>{t.telegramUrl}</span>
          <Input
            dir="ltr"
            maxLength={500}
            value={draft.telegramUrl ?? ""}
            placeholder="https://t.me/username"
            onChange={event => update("telegramUrl", event.target.value)}
          />
          <small className="font-normal leading-5 text-slate-500">
            {t.telegramHelp}
          </small>
        </label>
        <div className="sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setPreview({
                logoUrl: draft.logoUrl,
                websitePreviewUrl: draft.websitePreviewUrl,
              })
            }
          >
            {t.previewImages}
          </Button>
        </div>
        {(preview?.logoUrl || preview?.websitePreviewUrl) && (
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[140px_1fr]">
            {preview.logoUrl && (
              <figure className="overflow-hidden rounded-xl border border-slate-200">
                <figcaption className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                  {t.logo}
                </figcaption>
                <ProviderImage
                  src={preview.logoUrl}
                  alt={t.logo}
                  errorText={t.imageFailed}
                  className="aspect-square w-full object-contain p-3"
                />
              </figure>
            )}
            {preview.websitePreviewUrl && (
              <figure className="max-w-lg overflow-hidden rounded-xl border border-slate-200">
                <figcaption className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                  {t.preview}
                </figcaption>
                <ProviderImage
                  src={preview.websitePreviewUrl}
                  alt={t.preview}
                  errorText={t.imageFailed}
                />
              </figure>
            )}
          </div>
        )}
      </fieldset>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
        >
          <p>{error}</p>
          {conflict && (
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={async () => {
                const latest = await profile.refetch();
                if (latest.data) adopt(latest.data);
              }}
            >
              {t.reload}
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
        <Button type="submit" disabled={!dirty || save.isPending || conflict}>
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          <span>{save.isPending ? t.saving : t.save}</span>
        </Button>
        {dirty && (
          <>
            <span role="status" className="text-xs text-slate-500">
              {t.unsaved}
            </span>
            {!conflict && (
              <Button
                type="button"
                variant="ghost"
                disabled={save.isPending}
                onClick={() => {
                  if (original) {
                    setDraft(original);
                    setPreview(original);
                    setError(null);
                  }
                }}
              >
                {t.reset}
              </Button>
            )}
          </>
        )}
        {profile.data?.isPublic && (
          <Button type="button" variant="ghost" asChild>
            <a
              href={`/providers/${encodeURIComponent(profile.data.slug)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.page}
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
      </div>
    </form>
  );
}
