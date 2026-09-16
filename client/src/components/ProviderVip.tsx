import { useState } from "react";
import { toast } from "sonner";
import { Diamond, Eye, MousePointer2, Percent, Upload } from "lucide-react";
import { VIP_COVER_BYTES, vipSaveInput } from "../../../shared/providerVip";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import type { OwnedProvider } from "./ProviderDashboard";
import { useLocale } from "@/contexts/LocaleContext";
import { vipText } from "@/i18n/providerVip";
import { businessText } from "@/i18n/providerBusiness";
import { trpc } from "@/lib/trpc";
import {
  BusinessCard,
  BusinessError,
  BusinessStatus,
  businessField,
  businessPrimary,
  businessSecondary,
  businessDateInput,
  businessParseDate,
} from "./BusinessUi";
import { VipCard } from "./VipAlbum";

type Card = NonNullable<
  inferRouterOutputs<AppRouter>["business"]["vip"]["mine"]
>;
// Re-encode raster uploads to remove metadata and fit the full artwork. Nothing
// is cropped and only the bounded result is sent to the application server.
export async function prepareVipCover(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw new Error("image");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 32000000
    )
      throw new Error("image");
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("image");
    ctx.fillStyle = "#20241f";
    ctx.fillRect(0, 0, 1280, 800);
    const scale = Math.min(
      1280 / image.naturalWidth,
      800 / image.naturalHeight
    );
    const width = image.naturalWidth * scale,
      height = image.naturalHeight * scale;
    ctx.drawImage(image, (1280 - width) / 2, (800 - height) / 2, width, height);
    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const value = canvas.toDataURL("image/jpeg", quality);
      if (value.length <= Math.ceil(VIP_COVER_BYTES / 3) * 4 + 24) return value;
    }
    throw new Error("image");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ProviderVip({
  accountId,
  owned,
  active,
  savedOnly = false,
}: {
  accountId: number;
  owned: OwnedProvider;
  active: boolean;
  savedOnly?: boolean;
}) {
  const { locale } = useLocale();
  const t = vipText(locale),
    b = businessText(locale);
  const query = trpc.business.vip.mine.useQuery(
    { accountId, providerId: owned.provider.id },
    { retry: false, staleTime: 0 }
  );
  if (savedOnly && !query.isError && !query.data) return null;
  return (
    <div className="space-y-6">
      <BusinessCard>
        <div className="flex items-center gap-3">
          <Diamond className="size-6 text-beacon-700" />
          <h2 className="text-xl font-bold">{t.ownerTitle}</h2>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          {t.ownerHelp}
        </p>
      </BusinessCard>
      {query.isError ? (
        <BusinessError message={query.error.message} />
      ) : query.isLoading ? (
        <p role="status">{b.loading}</p>
      ) : (
        <VipEditor
          key={`${owned.provider.id}:${query.data?.revision ?? 0}`}
          card={query.data ?? null}
          owned={owned}
          active={active}
        />
      )}
      {active && (
        <VipMetrics accountId={accountId} providerId={owned.provider.id} />
      )}
    </div>
  );
}

export function VipEditor({
  card,
  owned,
  active,
}: {
  card: Card | null;
  owned: OwnedProvider;
  active: boolean;
}) {
  const { locale } = useLocale();
  const t = vipText(locale),
    b = businessText(locale);
  const utils = trpc.useUtils();
  const [tagline, setTagline] = useState(card?.tagline ?? "");
  const [specialties, setSpecialties] = useState(
    card?.specialties.join(", ") ?? ""
  );
  const [offer, setOffer] = useState(card?.offer ?? "");
  const [endsAt, setEndsAt] = useState(businessDateInput(card?.offerEndsAt));
  const [cover, setCover] = useState<string | undefined>();
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmHide, setConfirmHide] = useState(false);
  const refresh = async () => {
    await Promise.all([
      utils.business.vip.mine.invalidate(),
      utils.business.vip.list.invalidate(),
    ]);
  };
  const submit = trpc.business.vip.submit.useMutation({
    onSuccess: async () => {
      toast.success(t.saved);
      await refresh();
    },
  });
  const withdraw = trpc.business.vip.withdraw.useMutation({
    onSuccess: refresh,
  });
  const busy = submit.isPending || withdraw.isPending || imageBusy;
  const tags = specialties
    .split(/[,،，]/)
    .map(s => s.trim())
    .filter(Boolean);
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <BusinessCard>
        {card ? (
          <div className="mb-5 space-y-3">
            <BusinessStatus value={card.status} />
            <p className="text-xs leading-6 text-slate-500">{t.liveHelp}</p>
            {card.reviewNote && (
              <p
                dir="auto"
                className="rounded-xl bg-slate-50 p-4 text-sm leading-7"
              >
                {card.reviewNote}
              </p>
            )}
          </div>
        ) : (
          <p className="mb-5 text-sm text-slate-600">{t.noCard}</p>
        )}
        <form
          className="space-y-5"
          onSubmit={event => {
            event.preventDefault();
            if (busy || !active) return;
            if (!cover && !card) {
              setError(t.coverRequired);
              return;
            }
            const parsed = vipSaveInput.safeParse({
              providerId: owned.provider.id,
              revision: card?.revision ?? 0,
              tagline,
              specialties: tags,
              offer,
              offerEndsAt: offer ? businessParseDate(endsAt) : null,
              cover,
            });
            if (!parsed.success) {
              setError(t.invalid);
              return;
            }
            setError("");
            submit.mutate(parsed.data);
          }}
        >
          <fieldset disabled={!active || busy} className="space-y-5">
            <label className="block text-sm font-semibold">
              {t.cover}
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <Upload className="size-5 shrink-0 text-beacon-700" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="w-full min-w-0 text-xs file:me-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:font-semibold file:text-ink"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImageBusy(true);
                    setError("");
                    try {
                      setCover(await prepareVipCover(file));
                    } catch {
                      setError(t.imageError);
                    } finally {
                      setImageBusy(false);
                    }
                  }}
                />
              </span>
            </label>
            <p className="text-xs leading-6 text-slate-500">{t.coverHelp}</p>
            <label className="block text-sm font-semibold">
              {t.tagline}
              <textarea
                required
                minLength={12}
                maxLength={140}
                rows={3}
                dir="auto"
                className={businessField}
                value={tagline}
                onChange={e => setTagline(e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t.specialties}
              <input
                required
                maxLength={80}
                dir="auto"
                className={businessField}
                value={specialties}
                onChange={e => setSpecialties(e.target.value)}
              />
            </label>
            <p className="text-xs leading-6 text-slate-500">
              {t.specialtiesHelp}
            </p>
            <label className="block text-sm font-semibold">
              {t.offer}
              <input
                maxLength={80}
                dir="auto"
                className={businessField}
                value={offer}
                onChange={e => setOffer(e.target.value)}
              />
            </label>
            {offer && (
              <label className="block text-sm font-semibold">
                {t.offerUntil}
                <input
                  type="datetime-local"
                  required
                  dir="ltr"
                  className={businessField}
                  value={endsAt}
                  onChange={e => setEndsAt(e.target.value)}
                />
              </label>
            )}
            <p className="text-xs leading-6 text-slate-500">{t.offerHelp}</p>
          </fieldset>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          {submit.isError && <BusinessError message={submit.error.message} />}
          <button className={businessPrimary} disabled={!active || busy}>
            {imageBusy ? b.loading : t.submit}
          </button>
        </form>
        {card && card.status !== "hidden" && (
          <div className="mt-6 border-t pt-5">
            {confirmHide ? (
              <div>
                <p className="text-sm">{t.withdrawConfirm}</p>
                <div className="mt-3 flex gap-3">
                  <button
                    className={businessSecondary}
                    disabled={busy}
                    onClick={() =>
                      withdraw.mutate({
                        providerId: card.providerId,
                        revision: card.revision,
                      })
                    }
                  >
                    {t.withdraw}
                  </button>
                  <button
                    className={businessSecondary}
                    disabled={busy}
                    onClick={() => setConfirmHide(false)}
                  >
                    {b.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className={businessSecondary}
                disabled={busy}
                onClick={() => setConfirmHide(true)}
              >
                {t.withdraw}
              </button>
            )}
            {withdraw.isError && (
              <BusinessError message={withdraw.error.message} />
            )}
          </div>
        )}
      </BusinessCard>
      <aside className="min-w-0 xl:sticky xl:top-24">
        <h3 className="mb-4 text-sm font-bold text-slate-600">{t.preview}</h3>
        <VipCard
          preview
          card={{
            providerId: owned.provider.id,
            revision: card?.revision ?? 0,
            name: owned.provider.name,
            slug: owned.provider.slug,
            logoUrl: owned.provider.logoUrl,
            coverUrl: cover ?? card?.coverUrl ?? "",
            tagline,
            specialties: tags.slice(0, 3),
            offer,
            offerEndsAt: businessParseDate(endsAt),
            ownershipVerified: owned.ownershipValid,
          }}
        />
        <p className="mt-4 text-xs leading-6 text-slate-500">{t.disclosure}</p>
      </aside>
    </div>
  );
}
export function VipMetrics({
  accountId,
  providerId,
}: {
  accountId: number;
  providerId: number;
}) {
  const { locale } = useLocale();
  const t = vipText(locale),
    b = businessText(locale);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const query = trpc.business.vip.analytics.useQuery(
    { accountId, providerId, days },
    { retry: false, staleTime: 0, refetchInterval: 60000 }
  );
  const data = query.isError ? undefined : query.data;
  const number = new Intl.NumberFormat(locale);
  const metrics = data
    ? [
        {
          label: t.impressions,
          value: number.format(data.impressions),
          icon: Eye,
        },
        {
          label: t.clicks,
          value: number.format(data.clicks),
          icon: MousePointer2,
        },
        {
          label: t.ctr,
          value: data.impressions
            ? new Intl.NumberFormat(locale, {
                style: "percent",
                maximumFractionDigits: 1,
              }).format(data.clicks / data.impressions)
            : "—",
          icon: Percent,
        },
      ]
    : [];
  return (
    <BusinessCard>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">{t.metrics}</h2>
        <select
          aria-label={t.metrics}
          className="rounded-xl border px-3 py-2 text-sm"
          value={days}
          onChange={e => setDays(Number(e.target.value) as 7 | 30 | 90)}
        >
          {[7, 30, 90].map(n => (
            <option key={n} value={n}>
              {n} {t.days}
            </option>
          ))}
        </select>
      </div>
      {query.isError ? (
        <div className="mt-5">
          <BusinessError message={query.error.message} />
        </div>
      ) : !data ? (
        <p role="status" className="mt-5">
          {b.loading}
        </p>
      ) : !data.collectionEnabled ? (
        <p className="mt-5 text-sm text-amber-900">{t.metricsDisabled}</p>
      ) : (
        <>
          <p className="mt-3 text-xs text-slate-500" dir="ltr">
            {data.from} — {data.to} · UTC
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {metrics.map(m => (
              <div
                key={m.label}
                className="beacon-metric rounded-xl border bg-slate-50 p-5"
              >
                <m.icon className="mb-3 size-5 text-beacon-700" />
                <p className="text-xs font-semibold text-slate-600">
                  {m.label}
                </p>
                <p className="mt-3 text-3xl font-extrabold">{m.value}</p>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="mt-5 max-w-4xl text-xs leading-7 text-slate-500">
        {t.metricsHelp}
      </p>
    </BusinessCard>
  );
}
