import { useState } from "react";
import { toast } from "sonner";
import { Gift, Upload } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { vipGrantInput } from "../../../shared/providerVip";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { vipText } from "@/i18n/providerVip";
import { vipGrantText } from "@/i18n/vipGrants";
import { businessText } from "@/i18n/providerBusiness";
import ProviderPicker from "./ProviderPicker";
import { prepareVipCover } from "./ProviderVip";
import { VipCard } from "./VipCard";
import {
  BusinessCard,
  BusinessError,
  BusinessStatus,
  businessField,
  businessPrimary,
  businessSecondary,
  useBusinessClock,
} from "./BusinessUi";

type GrantState =
  inferRouterOutputs<AppRouter>["admin"]["business"]["vip"]["grantState"];

export function AdminVipGrants() {
  const { locale } = useLocale();
  const t = vipGrantText(locale),
    b = businessText(locale);
  const [selected, setSelected] = useState("");
  const query = trpc.admin.business.vip.grantState.useQuery(
    { providerId: Number(selected) },
    { enabled: Boolean(selected), retry: false, staleTime: 0 }
  );
  return (
    <div className="space-y-5">
      <BusinessCard>
        <h2 className="flex items-center gap-3 text-xl font-bold">
          <Gift className="size-6 text-foreground" />
          {t.title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary-foreground">
          {t.help}
        </p>
        <div className="mt-5">
          <ProviderPicker
            value={selected}
            onChange={setSelected}
            emptyLabel={b.select}
          />
        </div>
      </BusinessCard>
      {selected &&
        (query.isError ? (
          <BusinessError message={query.error.message} />
        ) : !query.data ? (
          <p role="status">{b.loading}</p>
        ) : (
          <VipGrantForm
            key={`${query.data.provider.id}:${query.data.card?.revision ?? 0}`}
            data={query.data}
          />
        ))}
    </div>
  );
}

export function VipGrantForm({ data }: { data: GrantState }) {
  const { locale } = useLocale();
  const t = vipGrantText(locale),
    v = vipText(locale),
    b = businessText(locale);
  const utils = trpc.useUtils();
  const now = useBusinessClock();
  const [durationDays, setDuration] = useState<7 | 30 | 90>(30);
  const [tagline, setTagline] = useState(
    data.card?.tagline ?? t.defaultTagline
  );
  const [note, setNote] = useState(t.defaultNote);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [cover, setCover] = useState<string>();
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = async () => {
    toast.success(b.saved);
    await Promise.all([
      utils.admin.business.vip.invalidate(),
      utils.business.vip.invalidate(),
    ]);
  };
  const grant = trpc.admin.business.vip.grant.useMutation({
    onSuccess: refresh,
  });
  const revoke = trpc.admin.business.vip.revokeGrant.useMutation({
    onSuccess: refresh,
  });
  const busy = grant.isPending || revoke.isPending || imageBusy;
  const card = data.card;
  const complimentary = card?.placement === "complimentary";
  const active =
    complimentary &&
    card.status === "approved" &&
    Boolean(
      card.complimentaryEndsAt &&
        new Date(card.complimentaryEndsAt).getTime() > now
    );
  const blocked = data.paidCardActive || data.provider.status !== "active";
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <BusinessCard>
        <h3 className="text-xl font-bold" dir="auto">
          {data.provider.name}
        </h3>
        {complimentary && (
          <div className="mt-4 space-y-3">
            <BusinessStatus
              value={
                active
                  ? "active"
                  : card.status === "hidden"
                    ? "hidden"
                    : "expired"
              }
            />
            {card.complimentaryEndsAt && (
              <p className="text-sm text-secondary-foreground">
                {t.activeUntil}:{" "}
                <bdi>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  }).format(new Date(card.complimentaryEndsAt))}
                </bdi>
              </p>
            )}
          </div>
        )}
        {blocked && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-warning-muted p-4 text-sm leading-7 text-warning"
          >
            {data.paidCardActive ? t.paidCard : t.unavailable}
          </p>
        )}
        <form
          className="mt-5 space-y-5"
          onSubmit={event => {
            event.preventDefault();
            if (blocked || busy) return;
            const parsed = vipGrantInput.safeParse({
              providerId: data.provider.id,
              revision: card?.revision ?? 0,
              durationDays,
              tagline,
              note,
              contentConfirmed: confirmed,
              cover,
            });
            if (!parsed.success) {
              setError(v.invalid);
              return;
            }
            setError("");
            grant.mutate(parsed.data);
          }}
        >
          <fieldset disabled={blocked || busy} className="space-y-5">
            <label className="block text-sm font-semibold">
              {t.duration}
              <select
                className={businessField}
                value={durationDays}
                onChange={e =>
                  setDuration(Number(e.target.value) as 7 | 30 | 90)
                }
              >
                {[7, 30, 90].map(days => (
                  <option key={days} value={days}>
                    {days} {v.days}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              {v.cover}
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-input bg-muted p-4">
                <Upload className="size-5 shrink-0 text-foreground" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="w-full min-w-0 text-xs"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImageBusy(true);
                    setError("");
                    try {
                      setCover(await prepareVipCover(file));
                    } catch {
                      setError(v.imageError);
                    } finally {
                      setImageBusy(false);
                    }
                  }}
                />
              </span>
            </label>
            <p className="text-xs leading-6 text-muted-foreground">{t.coverHelp}</p>
            <label className="block text-sm font-semibold">
              {v.tagline}
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
              {t.reason}
              <input
                required
                minLength={8}
                maxLength={600}
                dir="auto"
                className={businessField}
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </label>
            <label className="flex items-start gap-3 text-sm leading-7">
              <input
                type="checkbox"
                className="mt-2"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
              />
              {t.confirm}
            </label>
            <button
              className={businessPrimary}
              disabled={
                !confirmed ||
                note.trim().length < 8 ||
                tagline.trim().length < 12
              }
            >
              {imageBusy ? b.loading : active ? t.renew : t.activate}
            </button>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          {grant.isError && <BusinessError message={grant.error.message} />}
        </form>
        {complimentary && card.status !== "hidden" && (
          <div className="mt-6 border-t border-border pt-5">
            {confirmStop && <p className="mb-3 text-sm">{t.stopConfirm}</p>}
            <button
              className={businessSecondary}
              disabled={busy}
              onClick={() => {
                if (!confirmStop) {
                  setConfirmStop(true);
                  return;
                }
                revoke.mutate({
                  providerId: data.provider.id,
                  revision: card.revision,
                  note: note.trim().length >= 8 ? note : t.defaultNote,
                });
              }}
            >
              {t.stop}
            </button>
            {confirmStop && (
              <button
                className={`${businessSecondary} ms-2`}
                disabled={busy}
                onClick={() => setConfirmStop(false)}
              >
                {b.cancel}
              </button>
            )}
            {revoke.isError && <BusinessError message={revoke.error.message} />}
          </div>
        )}
      </BusinessCard>
      <aside className="min-w-0 xl:sticky xl:top-24">
        <h3 className="mb-4 text-sm font-bold text-secondary-foreground">{v.preview}</h3>
        <VipCard
          preview
          card={{
            providerId: data.provider.id,
            revision: card?.revision ?? 0,
            name: data.provider.name,
            slug: data.provider.slug,
            logoUrl: data.provider.logoUrl,
            coverUrl: cover ?? card?.coverUrl ?? "",
            tagline,
            specialties: [],
            offer: "",
            offerEndsAt: null,
            placement: "complimentary",
            ownershipVerified: false,
          }}
        />
      </aside>
    </div>
  );
}
