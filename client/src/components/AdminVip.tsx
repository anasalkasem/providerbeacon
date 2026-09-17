import { useState } from "react";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { useLocale } from "@/contexts/LocaleContext";
import { vipText } from "@/i18n/providerVip";
import { vipGrantText } from "@/i18n/vipGrants";
import { businessText } from "@/i18n/providerBusiness";
import { trpc } from "@/lib/trpc";
import {
  BusinessCard,
  BusinessError,
  BusinessStatus,
  BusinessPager,
  businessField,
  businessPrimary,
  businessSecondary,
} from "./BusinessUi";
import { VipCard } from "./VipAlbum";
type Item =
  inferRouterOutputs<AppRouter>["admin"]["business"]["vip"]["list"]["items"][number];
export function AdminVip({ manage }: { manage: boolean }) {
  const { locale } = useLocale();
  const t = vipText(locale),
    b = businessText(locale);
  const [pendingOnly, setPending] = useState(true);
  const [cursor, setCursor] = useState<number | undefined>();
  const query = trpc.admin.business.vip.list.useQuery(
    { pendingOnly, cursor },
    { retry: false, staleTime: 0 }
  );
  return (
    <div className="space-y-5">
      <BusinessCard>
        <h2 className="text-xl font-bold">{t.reviewTitle}</h2>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={e => {
              setCursor(undefined);
              setPending(e.target.checked);
            }}
          />
          {b.pendingOnly}
        </label>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">{t.liveHelp}</p>
      </BusinessCard>
      {query.isError ? (
        <BusinessError message={query.error.message} />
      ) : !query.data ? (
        <p role="status">{b.loading}</p>
      ) : (
        <>
          {!query.data.items.length && (
            <BusinessCard>
              <p>{b.noItems}</p>
            </BusinessCard>
          )}
          {query.data.items.map(item => (
            <Review
              key={`${item.card.providerId}:${item.card.revision}`}
              item={item}
              manage={manage}
            />
          ))}
          <BusinessPager
            cursor={cursor}
            nextCursor={query.data.nextCursor ?? undefined}
            onChange={setCursor}
          />
        </>
      )}
    </div>
  );
}
function Review({ item, manage }: { item: Item; manage: boolean }) {
  const { locale } = useLocale();
  const t = vipText(locale),
    b = businessText(locale);
  const utils = trpc.useUtils();
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const review = trpc.admin.business.vip.review.useMutation({
    onSuccess: async () => {
      toast.success(b.saved);
      await Promise.all([
        utils.admin.business.vip.invalidate(),
        utils.business.vip.invalidate(),
      ]);
    },
  });
  const card = item.card;
  const save = (decision: "approved" | "rejected" | "hidden") =>
    review.mutate({
      providerId: card.providerId,
      revision: card.revision,
      decision,
      note,
      contentConfirmed: confirmed,
    });
  return (
    <BusinessCard>
      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <VipCard
          preview
          card={{
            ...card,
            name: item.name,
            slug: item.slug,
            logoUrl: item.logoUrl,
            ownershipVerified: false,
          }}
        />
        <div className="space-y-4">
          <BusinessStatus value={card.status} />
          <p className="text-xs text-muted-foreground" dir="ltr">
            {card.websiteHost}
          </p>
          {card.reviewNote && (
            <p dir="auto" className="rounded-lg bg-muted p-3 text-sm">
              {card.reviewNote}
            </p>
          )}
          {card.placement === "complimentary" ? (
            <p className="text-sm leading-7 text-secondary-foreground">
              {vipGrantText(locale).managed}
            </p>
          ) : (
            <fieldset
              disabled={!manage || review.isPending}
              className="space-y-4"
            >
              <label className="flex items-start gap-3 text-sm leading-7">
                <input
                  type="checkbox"
                  className="mt-2"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                />
                {t.reviewConfirm}
              </label>
              <label className="block text-sm font-semibold">
                {t.reviewNote}
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
                    !confirmed ||
                    note.trim().length < 8 ||
                    card.status !== "pending"
                  }
                  onClick={() => save("approved")}
                >
                  {b.approve}
                </button>
                <button
                  className={businessSecondary}
                  disabled={note.trim().length < 8}
                  onClick={() => save("rejected")}
                >
                  {b.reject}
                </button>
                <button
                  className={businessSecondary}
                  disabled={note.trim().length < 8}
                  onClick={() => save("hidden")}
                >
                  {b.hide}
                </button>
              </div>
            </fieldset>
          )}
          {review.isError && <BusinessError message={review.error.message} />}
        </div>
      </div>
    </BusinessCard>
  );
}
