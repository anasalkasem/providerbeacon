import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, WandSparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { linkMetadataCopy } from "@/i18n/linkMetadata";
import { ProviderImage } from "./ProviderMedia";
import { groupLink } from "@shared/community";
import {
  websiteHome,
  type GroupLinkMetadata,
  type LinkMetadata,
} from "@shared/linkMetadata";

export function GroupSourceDetails({
  data,
}: {
  data?: GroupLinkMetadata | null;
}) {
  const { locale } = useLocale();
  const t = linkMetadataCopy[locale];
  if (!data?.audience && !data?.avatarUrl) return null;
  return (
    <div className="my-3 flex min-w-0 items-center gap-3">
      {data.avatarUrl && (
        <img
          src={data.avatarUrl}
          alt={t.avatar}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-12 shrink-0 rounded-xl object-cover"
          onError={e => {
            e.currentTarget.hidden = true;
          }}
        />
      )}
      {data.audience && (
        <p className="text-xs leading-6 text-slate-600">
          <span className="block font-semibold">
            {data.audience.approximate ? "≈ " : ""}
            {data.audience.count.toLocaleString(locale)} {t[data.audience.kind]}
          </span>
          <span>
            {t.recorded} {new Date(data.fetchedAt).toLocaleDateString(locale)}
          </span>
        </p>
      )}
    </div>
  );
}

export default function LinkAutofill({
  kind,
  url,
  admin = false,
  automatic = true,
  onResolved,
  onPending,
  onUseImage,
}: {
  kind: LinkMetadata["kind"];
  url: string;
  admin?: boolean;
  automatic?: boolean;
  onResolved: (value: LinkMetadata) => void;
  onPending?: (value: boolean) => void;
  onUseImage?: (field: "logoUrl" | "websitePreviewUrl", url: string) => void;
}) {
  const { locale } = useLocale();
  const t = linkMetadataCopy[locale];
  const website = trpc.admin.providers.previewWebsite.useMutation();
  const staffGroup = trpc.admin.groups.previewTelegram.useMutation();
  const memberGroup = trpc.community.previewTelegram.useMutation();
  const telegram = groupLink(url);
  const source =
    kind === "website"
      ? websiteHome(url)
      : telegram?.platform === "telegram"
        ? telegram.url
        : null;
  const [manual, setManual] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    source: string;
    pending: boolean;
    data?: LinkMetadata;
    error?: string;
  } | null>(null);
  const current = useRef(source);
  current.current = source;
  const callbacks = useRef({ onResolved, onPending });
  callbacks.current = { onResolved, onPending };
  const load = useRef(website.mutateAsync);
  load.current =
    kind === "website"
      ? website.mutateAsync
      : admin
        ? staffGroup.mutateAsync
        : memberGroup.mutateAsync;
  const enabled = automatic || manual === source;
  useEffect(() => {
    if (!source || !enabled) {
      callbacks.current.onPending?.(false);
      return;
    }
    let cancelled = false;
    setState({ source, pending: true });
    callbacks.current.onPending?.(true);
    const timer = setTimeout(() => {
      void load
        .current({ url: source })
        .then(data => {
          if (cancelled || current.current !== source) return;
          setState({ source, pending: false, data });
          callbacks.current.onResolved(data);
        })
        .catch((error: { message?: string }) => {
          if (!cancelled && current.current === source)
            setState({ source, pending: false, error: error.message });
        })
        .finally(() => {
          if (!cancelled && current.current === source)
            callbacks.current.onPending?.(false);
        });
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      callbacks.current.onPending?.(false);
    };
  }, [source, enabled, attempt]);
  const visible = state?.source === source ? state : null;
  const data = visible?.data;
  const hasData = Boolean(
    data &&
      (data.name ||
        data.description ||
        data.logoUrl ||
        data.websitePreviewUrl ||
        data.avatarUrl)
  );
  return (
    <section
      aria-label={t[kind]}
      className="col-span-full min-w-0 rounded-xl border border-teal-100 bg-teal-50/60 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-bold text-teal-900">
          <WandSparkles className="size-4" />
          {t[kind]}
        </span>
        <button
          type="button"
          disabled={!source || visible?.pending}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-teal-200 bg-white px-3 text-xs font-semibold text-teal-800 disabled:opacity-50"
          onClick={() => {
            setManual(source);
            setAttempt(v => v + 1);
          }}
        >
          {visible?.pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          <span>
            {visible?.pending ? t.fetching : visible?.error ? t.retry : t.fetch}
          </span>
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="mt-2 text-xs leading-6 text-slate-600"
      >
        {visible?.pending
          ? t.fetching
          : visible?.error
            ? visible.error === "metadata_busy"
              ? t.busy
              : t.unavailable
            : data
              ? data.issue === "protected"
                ? t.protected
                : data.issue === "source_busy"
                  ? t.sourceBusy
                  : data.issue === "timeout"
                    ? t.timeout
                    : hasData
                      ? data.complete
                        ? t.ready
                        : t.partial
                      : t.unavailable
              : t.hint}
      </p>
      {data && (
        <div className="mt-3 min-w-0">
          {kind === "website" ? (
            <div className="flex flex-wrap items-start gap-4">
              {data.logoUrl && (
                <figure>
                  <ProviderImage
                    logo
                    src={data.logoUrl}
                    alt={t.logo}
                    errorText={t.unavailable}
                    className="size-16 rounded-lg border bg-white object-contain p-2"
                  />
                  <figcaption className="mt-1 text-xs text-slate-500">
                    {t.logo}
                  </figcaption>
                  {onUseImage && (
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-teal-800 underline"
                      onClick={() => onUseImage("logoUrl", data.logoUrl!)}
                    >
                      {t.useLogo}
                    </button>
                  )}
                </figure>
              )}
              {data.websitePreviewUrl && (
                <figure className="max-w-full">
                  <img
                    src={data.websitePreviewUrl}
                    alt={t.screenshot}
                    referrerPolicy="no-referrer"
                    className="aspect-[1200/750] w-60 max-w-full rounded-lg border bg-white object-cover"
                  />
                  <figcaption className="mt-1 text-xs text-slate-500">
                    {t.screenshot}
                  </figcaption>
                  {onUseImage && (
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-teal-800 underline"
                      onClick={() =>
                        onUseImage("websitePreviewUrl", data.websitePreviewUrl!)
                      }
                    >
                      {t.useScreenshot}
                    </button>
                  )}
                </figure>
              )}
            </div>
          ) : (
            <GroupSourceDetails data={data} />
          )}
          {kind === "website" && (
            <p className="mt-2 text-xs text-slate-500">
              {t.recorded} {new Date(data.fetchedAt).toLocaleDateString(locale)}
            </p>
          )}
          {data.name && (
            <p
              dir="auto"
              className="mt-2 break-words text-sm font-bold text-slate-800"
            >
              {data.name}
            </p>
          )}
          {data.aiSuggested && (
            <p className="mt-2 text-xs leading-6 text-slate-600">
              {t.suggested}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
