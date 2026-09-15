import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { memberWatches } from "../drizzle/workspaceSchema";
import { memberAccounts } from "../drizzle/memberSchema";
import { emailOutbox, emailSuppressions } from "../drizzle/emailSchema";
import {
  PRICE_ALERT_CHECK_MS,
  PRICE_ALERT_CONSENT_VERSION,
  PRICE_ALERT_MAX_AGE_MS,
  priceAlertQuote,
} from "../shared/priceAlerts";
import { compareQuoteAmounts } from "../shared/pricing";
import { assistantOffersByIds } from "./assistantCatalogue";
import { getMarketplaceSnapshot } from "./marketplaceDb";
import {
  enqueueEmail,
  mailConfiguration,
  mailDatabase,
  type MailTransaction,
} from "./emailDb";
import {
  memberAuthOrigin,
  memberEmailKey,
  MemberAuthError,
} from "./memberSecurity";
import { reserveMemberRequests } from "./memberDb";

export const priceAlertKey = (id: number, revision: number) =>
  `price-target:${id}:${revision}`;

export async function cancelWatchEmails(
  tx: MailTransaction,
  memberId: number,
  watchId?: number
) {
  await tx
    .update(emailOutbox)
    .set({
      status: "cancelled",
      payload: null,
      lastError: "price_alert_disabled",
    })
    .where(
      and(
        eq(emailOutbox.memberId, memberId),
        eq(emailOutbox.kind, "price_target"),
        inArray(emailOutbox.status, ["queued", "processing"]),
        watchId == null
          ? undefined
          : sql`json_extract(${emailOutbox.priceAlert}, '$.watchId') = ${watchId}`
      )
    );
}

// Uncached, public-eligibility-filtered data is used both at evaluation and at
// dispatch. A hidden/deleted provider cannot leak through a saved watch.
export async function currentWatchOffer(serviceId: number | null) {
  if (!serviceId) return null;
  return (
    (
      await assistantOffersByIds(
        [`service-${serviceId}`],
        getMarketplaceSnapshot
      )
    )[0] ?? null
  );
}

export async function evaluateOnePriceAlert() {
  if (!mailConfiguration().enabled) return false;
  const db = await mailDatabase();
  const now = new Date();
  const due = and(
    eq(memberWatches.emailAlertEnabled, true),
    isNull(memberWatches.emailAlertTriggeredAt),
    lte(memberWatches.emailAlertNextCheckAt, now)
  );
  const [snapshot] = await db
    .select()
    .from(memberWatches)
    .where(due)
    .orderBy(memberWatches.emailAlertNextCheckAt, memberWatches.id)
    .limit(1);
  if (!snapshot) return false;
  let candidate;
  try {
    candidate = await currentWatchOffer(snapshot.serviceId);
  } catch (error) {
    // A temporarily unreadable offer must not starve later due watches.
    await db
      .update(memberWatches)
      .set({
        emailAlertNextCheckAt: new Date(now.getTime() + PRICE_ALERT_CHECK_MS),
      })
      .where(
        and(
          eq(memberWatches.id, snapshot.id),
          eq(memberWatches.emailAlertRevision, snapshot.emailAlertRevision),
          due
        )
      );
    throw error;
  }
  return db.transaction(async tx => {
    // Same account -> watch -> outbox lock order as preference changes/deletion.
    const [member] = await tx
      .select()
      .from(memberAccounts)
      .where(eq(memberAccounts.id, snapshot.memberId))
      .for("update");
    const [watch] = await tx
      .select()
      .from(memberWatches)
      .where(and(eq(memberWatches.id, snapshot.id), due))
      .for("update");
    if (!member || !watch) return false;
    if (watch.emailAlertRevision !== snapshot.emailAlertRevision) return false;
    await tx
      .update(memberWatches)
      .set({
        emailAlertNextCheckAt: new Date(now.getTime() + PRICE_ALERT_CHECK_MS),
      })
      .where(eq(memberWatches.id, watch.id));
    if (
      member.status !== "active" ||
      !member.emailVerifiedAt ||
      watch.emailAlertConsentVersion !== PRICE_ALERT_CONSENT_VERSION ||
      !watch.emailAlertConsentAt
    )
      return false;
    const [blocked] = await tx
      .select()
      .from(emailSuppressions)
      .where(eq(emailSuppressions.recipientHash, memberEmailKey(member.email)))
      .limit(1);
    if (blocked) return false;
    const service = candidate?.service ?? null;
    const quote = priceAlertQuote(
      watch.baseline,
      service,
      watch.quantity,
      watch.targetTotal
    );
    if (
      !quote.reached ||
      !service ||
      !candidate ||
      !quote.now ||
      !quote.original
    )
      return false;
    const reference = {
      watchId: watch.id,
      revision: watch.emailAlertRevision,
      historyKey: service.historyKey!,
      total: quote.now,
      target: watch.targetTotal!,
      currency: service.priceCurrency!,
      quantity: watch.quantity,
      observedAt: service.checkedAt!,
    };
    await enqueueEmail(tx, member, {
      kind: "price_target",
      key: priceAlertKey(watch.id, watch.emailAlertRevision),
      url: `${memberAuthOrigin()}/compare?services=${service.id}&quantity=${watch.quantity}&currency=${service.priceCurrency}&lang=${member.locale}`,
      priceAlert: reference,
      priceTarget: {
        service: service.name,
        provider: candidate.provider.name,
        quantity: watch.quantity,
        currency: reference.currency,
        original: quote.original,
        current: quote.now,
        target: reference.target,
        observedAt: reference.observedAt,
      },
      // Do not deliver yesterday's price after an extended mail outage.
      expiresAt: new Date(
        Math.min(
          now.getTime() + 3600000,
          Date.parse(reference.observedAt) + PRICE_ALERT_MAX_AGE_MS
        )
      ),
    });
    await tx
      .update(memberWatches)
      .set({
        emailAlertTriggeredAt: now,
        emailAlertNextCheckAt: null,
      })
      .where(eq(memberWatches.id, watch.id));
    return true;
  });
}

export async function priceAlertStillEligible(
  mail: typeof emailOutbox.$inferSelect
) {
  if (mail.kind !== "price_target") return true;
  const ref = mail.priceAlert;
  if (!ref || mail.expiresAt.getTime() <= Date.now()) return false;
  const db = await mailDatabase();
  const [watch] = await db
    .select()
    .from(memberWatches)
    .where(
      and(
        eq(memberWatches.id, ref.watchId),
        eq(memberWatches.memberId, mail.memberId),
        eq(memberWatches.emailAlertEnabled, true),
        eq(memberWatches.emailAlertRevision, ref.revision)
      )
    )
    .limit(1);
  if (
    !watch ||
    !watch.emailAlertConsentAt ||
    watch.emailAlertConsentVersion !== PRICE_ALERT_CONSENT_VERSION ||
    watch.baseline.historyKey !== ref.historyKey ||
    watch.quantity !== ref.quantity ||
    watch.targetTotal !== ref.target
  )
    return false;
  const candidate = await currentWatchOffer(watch.serviceId);
  const quote = priceAlertQuote(
    watch.baseline,
    candidate?.service ?? null,
    watch.quantity,
    watch.targetTotal
  );
  // A further decrease is fine: the email explicitly dates its observed price.
  return (
    quote.reached &&
    !!quote.now &&
    candidate?.service.priceCurrency === ref.currency &&
    compareQuoteAmounts(quote.now, ref.total) <= 0 &&
    Date.now() - Date.parse(ref.observedAt) <= PRICE_ALERT_MAX_AGE_MS
  );
}

export function startPriceAlertWorker() {
  let busy = false;
  const tick = async () => {
    if (busy || !mailConfiguration().enabled) return;
    busy = true;
    try {
      await reserveMemberRequests([
        { key: "mail:price-target:global", limit: 1, windowMs: 1000 },
      ]);
      await evaluateOnePriceAlert();
    } catch (error) {
      if (!(error instanceof MemberAuthError && error.code === "rate_limited"))
        console.warn("[Email] Price target evaluation temporarily unavailable");
    } finally {
      busy = false;
    }
  };
  // Independent of delivery: a slow catalogue never blocks security emails.
  const timer = setInterval(() => {
    void tick();
  }, 2000);
  timer.unref();
  return () => clearInterval(timer);
}
