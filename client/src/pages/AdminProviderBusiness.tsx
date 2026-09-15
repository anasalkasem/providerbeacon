import { useState } from "react";
import { toast } from "sonner";
import { Building2, ExternalLink } from "lucide-react";
import { BusinessPricing } from "@/components/BusinessPricing";
import { providerPricingText } from "@/i18n/providerPricing";
import { providerMonthAnniversary } from "../../../shared/providerBusinessPricing";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import {
  planStatuses,
  subscriptionInput,
} from "../../../shared/providerBusiness";
import DashboardLayout from "@/components/DashboardLayout";
import ProviderPicker from "@/components/ProviderPicker";
import { useLocale } from "@/contexts/LocaleContext";
import { trpc } from "@/lib/trpc";
import { businessError, businessText } from "@/i18n/providerBusiness";
import {
  BusinessCard,
  BusinessError,
  BusinessPager,
  BusinessStatus,
  businessDateInput,
  businessField,
  businessParseDate,
  businessPrimary,
  businessSecondary,
} from "@/components/BusinessUi";

type Output = inferRouterOutputs<AppRouter>["admin"]["business"];
type Claim = Output["claims"]["items"][number];
type Offer = Output["promotions"]["items"][number];

export default function AdminProviderBusiness() {
  return (
    <DashboardLayout>
      <AdminBusinessPanel />
    </DashboardLayout>
  );
}
export function AdminBusinessPanel() {
  const { locale } = useLocale();
  const t = businessText(locale);
  const access = trpc.admin.access.useQuery();
  const allowed = access.data?.permissions.includes("business.read") ?? false;
  const manage = access.data?.permissions.includes("business.manage") ?? false;
  const [tab, setTab] = useState<"subscription" | "claims" | "offers">(
    "subscription"
  );
  if (access.isError || (access.data && !allowed)) return <BusinessError />;
  if (!allowed) return <p role="status">{t.loading}</p>;
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Building2 className="size-7 text-teal-700" />
        <h1 className="text-2xl font-extrabold text-[#0B2A68]">
          {t.adminTitle}
        </h1>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label={t.adminTitle}>
        {[
          { key: "subscription", title: t.plan },
          { key: "claims", title: t.requests },
          { key: "offers", title: t.reviewOffers },
        ].map(item => (
          <button
            key={item.key}
            className={tab === item.key ? businessPrimary : businessSecondary}
            aria-pressed={tab === item.key}
            onClick={() => setTab(item.key as typeof tab)}
          >
            {item.title}
          </button>
        ))}
      </nav>
      {tab === "subscription" && <SubscriptionPicker manage={manage} />}{" "}
      {tab === "claims" && <ClaimsQueue manage={manage} />}{" "}
      {tab === "offers" && <OffersQueue manage={manage} />}
    </div>
  );
}
function SubscriptionPicker({ manage }: { manage: boolean }) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const [selected, setSelected] = useState("");
  const query = trpc.admin.business.account.useQuery(
    { providerId: Number(selected) },
    { enabled: Boolean(selected), retry: false, staleTime: 0 }
  );
  return (
    <div className="space-y-5">
      <BusinessCard>
        <ProviderPicker
          value={selected}
          onChange={setSelected}
          emptyLabel={t.select}
        />
      </BusinessCard>
      {selected &&
        (query.isError ? (
          <BusinessError message={query.error.message} />
        ) : !query.data ? (
          <p role="status">{t.loading}</p>
        ) : (
          <SubscriptionForm
            key={`${query.data.provider.id}:${query.data.subscription.revision}`}
            data={query.data}
            manage={manage}
          />
        ))}
    </div>
  );
}
export function SubscriptionForm({
  data,
  manage,
}: {
  data: Output["account"];
  manage: boolean;
}) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const pricingText = providerPricingText(locale);
  const utils = trpc.useUtils();
  const [status, setStatus] = useState(data.subscription.status);
  const [startsAt, setStart] = useState(
    businessDateInput(data.subscription.startsAt ?? new Date())
  );
  const [endsAt, setEnd] = useState(
    businessDateInput(
      data.subscription.endsAt ??
        providerMonthAnniversary(businessParseDate(startsAt)!, 1)
    )
  );
  const [note, setNote] = useState("");
  const [confirmRevoke, setConfirm] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const refresh = async () => {
    toast.success(t.saved);
    await Promise.all([
      utils.admin.business.invalidate(),
      utils.business.invalidate(),
      utils.community.list.invalidate(),
      utils.marketplace.snapshot.invalidate(),
    ]);
  };
  const save = trpc.admin.business.setSubscription.useMutation({
    onSuccess: refresh,
  });
  const revoke = trpc.admin.business.revokeOwner.useMutation({
    onSuccess: refresh,
  });
  const busy = save.isPending || revoke.isPending;
  return (
    <BusinessCard>
      <div className="flex flex-wrap justify-between gap-4">
        <h2 className="text-xl font-bold text-[#0B2A68]" dir="auto">
          {data.provider.name}
        </h2>
        <BusinessStatus value={data.subscription.state} />
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-600">{t.manualHelp}</p>
      <div className="mt-5 rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-500">{t.owner}</p>
        <p className="mt-2 font-semibold" dir="auto">
          {data.owner?.name ?? t.noOwner}
        </p>
        {data.owner?.email && (
          <p className="mt-1 text-sm text-slate-600" dir="ltr">
            {data.owner.email}
          </p>
        )}
      </div>
      <form
        className="mt-6 space-y-4"
        onSubmit={e => {
          e.preventDefault();
          if (busy || !manage) return;
          const value = subscriptionInput.safeParse({
            providerId: data.provider.id,
            revision: data.subscription.revision,
            status,
            startsAt: businessParseDate(startsAt),
            endsAt: businessParseDate(endsAt),
            note,
          });
          if (!value.success) {
            setInvalid(true);
            return;
          }
          setInvalid(false);
          save.mutate(value.data);
        }}
      >
        <fieldset disabled={!manage || busy} className="space-y-4">
          <label className="block max-w-sm text-sm font-semibold">
            {t.status}
            <select
              className={businessField}
              value={status}
              onChange={e => setStatus(e.target.value as typeof status)}
            >
              {planStatuses.map(value => (
                <option key={value} value={value}>
                  {t[value]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              {t.startsAt}
              <input
                type="datetime-local"
                dir="ltr"
                required={status === "active"}
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
                required={status === "active"}
                className={businessField}
                value={endsAt}
                onChange={e => setEnd(e.target.value)}
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">{t.utc}</p>
          {!data.subscription.firstActivatedAt &&
            status === "active" &&
            startsAt && (
              <p className="text-sm font-semibold text-slate-600">
                {pricingText.preview}
              </p>
            )}
          <BusinessPricing
            firstActivatedAt={
              data.subscription.firstActivatedAt ??
              (status === "active" ? businessParseDate(startsAt) : null)
            }
          />
          <p className="text-xs leading-6 text-slate-500">
            {pricingText.customPeriod}
          </p>
          <label className="block text-sm font-semibold">
            {t.note}
            <textarea
              className={businessField}
              required
              minLength={8}
              maxLength={600}
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </label>
        </fieldset>
        {save.isError && <BusinessError message={save.error.message} />}{" "}
        {invalid && <BusinessError />}
        <button className={businessPrimary} disabled={!manage || busy}>
          {t.savePlan}
        </button>
      </form>
      {data.owner && manage && (
        <div className="mt-8 border-t border-slate-200 pt-5">
          <label className="flex items-start gap-3 text-sm leading-7 text-slate-600">
            <input
              type="checkbox"
              className="mt-2"
              checked={confirmRevoke}
              onChange={e => setConfirm(e.target.checked)}
            />
            {t.revokeConfirm}
          </label>
          <button
            className={`${businessSecondary} mt-4 border-red-200 text-red-700`}
            disabled={busy || !confirmRevoke || note.trim().length < 8}
            onClick={() =>
              revoke.mutate({
                providerId: data.provider.id,
                revision: data.subscription.revision,
                note,
              })
            }
          >
            {t.revoke}
          </button>
          {revoke.isError && <BusinessError message={revoke.error.message} />}
        </div>
      )}
    </BusinessCard>
  );
}
function ClaimsQueue({ manage }: { manage: boolean }) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const [pendingOnly, setPending] = useState(true);
  const [cursor, setCursor] = useState<number>();
  const query = trpc.admin.business.claims.useQuery(
    { pendingOnly, cursor },
    { retry: false, staleTime: 0 }
  );
  return (
    <div className="space-y-5">
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={pendingOnly}
          onChange={e => {
            setPending(e.target.checked);
            setCursor(undefined);
          }}
        />
        {t.pendingOnly}
      </label>
      {query.isError ? (
        <BusinessError message={query.error.message} />
      ) : !query.data ? (
        <p role="status">{t.loading}</p>
      ) : (
        <>
          {!query.data.items.length && (
            <BusinessCard>
              <p className="text-slate-500">{t.noItems}</p>
            </BusinessCard>
          )}
          {query.data.items.map(claim => (
            <ClaimReview
              key={`${claim.id}:${claim.revision}`}
              claim={claim}
              manage={manage}
            />
          ))}
          <BusinessPager
            cursor={cursor}
            nextCursor={query.data.nextCursor}
            onChange={setCursor}
          />
        </>
      )}
    </div>
  );
}
function ClaimReview({ claim, manage }: { claim: Claim; manage: boolean }) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const utils = trpc.useUtils();
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const review = trpc.admin.business.reviewClaim.useMutation({
    onSuccess: async () => {
      toast.success(t.saved);
      await utils.admin.business.invalidate();
    },
    onError: e => toast.error(businessError(e.message, locale)),
  });
  return (
    <BusinessCard>
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-lg font-bold" dir="auto">
          {claim.providerName}
        </h2>
        <BusinessStatus value={claim.status} />
      </div>
      <p className="mt-3 text-sm" dir="auto">
        {claim.memberName}
      </p>
      <p className="mt-1 text-sm text-slate-500" dir="ltr">
        {claim.memberEmail}
      </p>
      <p
        className="mt-3 break-all text-sm font-semibold text-teal-700"
        dir="ltr"
      >
        {claim.websiteHost}
      </p>
      <code
        className="mt-3 block break-all rounded-xl bg-slate-100 p-3 text-sm"
        dir="ltr"
      >
        {claim.token}
      </code>
      {claim.proofUrl && (
        <a
          href={claim.proofUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-4 inline-flex max-w-full items-start gap-2 break-all text-sm text-teal-700 underline"
          dir="ltr"
        >
          {claim.proofUrl}
          <ExternalLink className="size-4 shrink-0" />
        </a>
      )}
      {claim.reviewNote && (
        <p className="mt-3 whitespace-pre-line text-sm leading-7" dir="auto">
          {claim.reviewNote}
        </p>
      )}
      {manage && claim.status === "pending" && (
        <div className="mt-5 space-y-4">
          <label className="flex items-start gap-3 text-sm leading-7">
            <input
              type="checkbox"
              className="mt-2"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
            />
            {t.tokenConfirm}
          </label>
          <label className="block text-sm font-semibold">
            {t.note}
            <textarea
              className={businessField}
              minLength={8}
              maxLength={600}
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              className={businessPrimary}
              disabled={
                review.isPending ||
                !confirmed ||
                note.trim().length < 8 ||
                new Date(claim.expiresAt).getTime() <= Date.now()
              }
              onClick={() =>
                review.mutate({
                  id: claim.id,
                  revision: claim.revision,
                  decision: "approved",
                  tokenConfirmed: confirmed,
                  note,
                })
              }
            >
              {t.approve}
            </button>
            <button
              className={businessSecondary}
              disabled={review.isPending || note.trim().length < 8}
              onClick={() =>
                review.mutate({
                  id: claim.id,
                  revision: claim.revision,
                  decision: "rejected",
                  tokenConfirmed: false,
                  note,
                })
              }
            >
              {t.reject}
            </button>
          </div>
        </div>
      )}
    </BusinessCard>
  );
}
function OffersQueue({ manage }: { manage: boolean }) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const [pendingOnly, setPending] = useState(true);
  const [cursor, setCursor] = useState<number>();
  const query = trpc.admin.business.promotions.useQuery(
    { pendingOnly, cursor },
    { retry: false, staleTime: 0 }
  );
  return (
    <div className="space-y-5">
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={pendingOnly}
          onChange={e => {
            setPending(e.target.checked);
            setCursor(undefined);
          }}
        />
        {t.pendingOnly}
      </label>
      {query.isError ? (
        <BusinessError message={query.error.message} />
      ) : !query.data ? (
        <p role="status">{t.loading}</p>
      ) : (
        <>
          {!query.data.items.length && (
            <BusinessCard>
              <p className="text-slate-500">{t.noItems}</p>
            </BusinessCard>
          )}
          {query.data.items.map(offer => (
            <OfferReview
              key={`${offer.promotion.id}:${offer.promotion.revision}`}
              offer={offer}
              manage={manage}
            />
          ))}
          <BusinessPager
            cursor={cursor}
            nextCursor={query.data.nextCursor}
            onChange={setCursor}
          />
        </>
      )}
    </div>
  );
}
function OfferReview({ offer, manage }: { offer: Offer; manage: boolean }) {
  const { locale } = useLocale();
  const t = businessText(locale);
  const utils = trpc.useUtils();
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const review = trpc.admin.business.reviewPromotion.useMutation({
    onSuccess: async () => {
      toast.success(t.saved);
      await Promise.all([
        utils.admin.business.promotions.invalidate(),
        utils.business.promotions.list.invalidate(),
      ]);
    },
    onError: e => toast.error(businessError(e.message, locale)),
  });
  const row = offer.promotion;
  return (
    <BusinessCard>
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-lg font-bold" dir="auto">
          {offer.providerName} — {row.title}
        </h2>
        <BusinessStatus value={row.status} />
      </div>
      <p
        className="mt-4 whitespace-pre-line break-words text-sm leading-7 text-slate-600"
        dir="auto"
      >
        {row.description}
      </p>
      {row.couponCode && (
        <code className="mt-3 block" dir="ltr">
          {row.couponCode}
        </code>
      )}
      <a
        href={row.destinationUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-4 block break-all text-sm text-teal-700 underline"
        dir="ltr"
      >
        {row.destinationUrl}
      </a>
      <p className="mt-3 text-xs text-slate-500" dir="ltr">
        {businessDateInput(row.startsAt)} — {businessDateInput(row.endsAt)} UTC
      </p>
      {row.reviewNote && (
        <p className="mt-3 whitespace-pre-line text-sm leading-7" dir="auto">
          {row.reviewNote}
        </p>
      )}
      {manage && (
        <div className="mt-5 space-y-4">
          <label className="flex items-start gap-3 text-sm leading-7">
            <input
              type="checkbox"
              className="mt-2"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
            />
            {t.offerConfirm}
          </label>
          <label className="block text-sm font-semibold">
            {t.note}
            <textarea
              className={businessField}
              minLength={8}
              maxLength={600}
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            {(["approved", "rejected", "hidden"] as const).map(decision => (
              <button
                key={decision}
                className={
                  decision === "approved" ? businessPrimary : businessSecondary
                }
                disabled={
                  review.isPending ||
                  note.trim().length < 8 ||
                  (decision === "approved" &&
                    (!confirmed ||
                      new Date(row.endsAt).getTime() <= Date.now()))
                }
                onClick={() =>
                  review.mutate({
                    id: row.id,
                    revision: row.revision,
                    decision,
                    destinationConfirmed: confirmed,
                    note,
                  })
                }
              >
                {decision === "approved"
                  ? t.approve
                  : decision === "rejected"
                    ? t.reject
                    : t.hide}
              </button>
            ))}
          </div>
        </div>
      )}
    </BusinessCard>
  );
}
