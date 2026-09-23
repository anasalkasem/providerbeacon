import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { businessText } from "@/i18n/providerBusiness";
import { adText } from "@/i18n/advertising";
import {
  promotionInput,
  promotionCategories,
} from "../../../shared/providerBusiness";
import { prepareVipCover } from "./ProviderVip";
import {
  BusinessError,
  businessDateInput,
  businessField,
  businessParseDate,
  businessPrimary,
  businessSecondary,
} from "./BusinessUi";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
type Promotion =
  inferRouterOutputs<AppRouter>["business"]["promotions"]["mine"]["items"][number];

export function PromotionForm({
  providerId,
  initial,
  pending,
  error,
  onCancel,
  onSave,
  submitLabel,
}: {
  providerId: number;
  initial?: Promotion;
  pending: boolean;
  error?: string;
  onCancel: () => void;
  onSave: (input: typeof promotionInput._output) => void;
  submitLabel?: string;
}) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const a = adText(locale);
  const [category, setCategory] = useState(initial?.category ?? "all");
  const [cover, setCover] = useState<string>();
  const [removeCover, setRemoveCover] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [couponCode, setCoupon] = useState(initial?.couponCode ?? "");
  const [destinationUrl, setDestination] = useState(
    initial?.destinationUrl ?? ""
  );
  const [startsAt, setStart] = useState(
    businessDateInput(initial?.startsAt ?? new Date())
  );
  const [endsAt, setEnd] = useState(
    businessDateInput(initial?.endsAt ?? new Date(Date.now() + 7 * 86_400_000))
  );
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      className="mt-6 space-y-4 rounded-xl bg-muted p-5"
      onSubmit={e => {
        e.preventDefault();
        if (pending || imageBusy || imageError) return;
        const value = promotionInput.safeParse({
          providerId,
          title,
          description,
          couponCode,
          destinationUrl,
          category,
          cover,
          removeCover,
          startsAt: businessParseDate(startsAt),
          endsAt: businessParseDate(endsAt),
        });
        if (!value.success) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        onSave(value.data);
      }}
    >
      <fieldset disabled={pending || imageBusy} className="space-y-4">
        <label className="block text-sm font-semibold">
          {a.image}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={businessField}
            onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImageBusy(true);
              setImageError(false);
              try {
                setCover(await prepareVipCover(file));
                setRemoveCover(false);
              } catch {
                setImageError(true);
              } finally {
                setImageBusy(false);
              }
            }}
          />
        </label>
        <p className="text-xs text-muted-foreground">{a.imageHelp}</p>
        {!removeCover && (cover || initial?.coverUrl) && (
          <div className="space-y-2">
            <img
              src={cover || initial?.coverUrl}
              alt={a.image}
              className="max-h-64 w-full rounded-xl border bg-card object-contain"
            />
            <button
              type="button"
              className={businessSecondary}
              onClick={() => {
                setCover(undefined);
                setRemoveCover(true);
                setImageError(false);
              }}
            >
              {a.removeImage}
            </button>
          </div>
        )}
        {imageError && (
          <p role="alert" className="text-sm text-danger">
            {a.imageError}
          </p>
        )}
        <label className="block text-sm font-semibold">
          {a.category}
          <select
            className={businessField}
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {promotionCategories.map(c => (
              <option key={c} value={c}>
                {c === "all" ? a.all : c === "Other" ? a.other : c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          {t.titleLabel}
          <input
            required
            minLength={4}
            maxLength={120}
            className={businessField}
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          {t.description}
          <textarea
            required
            minLength={20}
            maxLength={1200}
            rows={4}
            className={businessField}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          {t.coupon}
          <input
            dir="ltr"
            maxLength={64}
            pattern="[A-Za-z0-9_-]*"
            className={businessField}
            value={couponCode}
            onChange={e => setCoupon(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          {t.destination}
          <input
            type="url"
            dir="ltr"
            required
            maxLength={500}
            className={businessField}
            value={destinationUrl}
            onChange={e => setDestination(e.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            {t.startsAt}
            <input
              type="datetime-local"
              dir="ltr"
              required
              className={businessField}
              value={startsAt}
              onChange={e => setStart(e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            {t.endsAt}
            <input
              type="datetime-local"
              dir="ltr"
              required
              className={businessField}
              value={endsAt}
              onChange={e => setEnd(e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{t.utc}</p>
      </fieldset>
      {error && <BusinessError message={error} />}{" "}
      {invalid && <BusinessError />}
      <div className="flex gap-3">
        <button
          className={businessPrimary}
          disabled={pending || imageBusy || imageError}
        >
          {imageBusy ? t.loading : (submitLabel ?? t.submit)}
        </button>
        <button
          type="button"
          className={businessSecondary}
          onClick={onCancel}
          disabled={pending}
        >
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
