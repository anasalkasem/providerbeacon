import { standardRate } from "../shared/pricing";
import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { memberComparisons, memberWatches } from "../drizzle/workspaceSchema";
import { priceSnapshots } from "../drizzle/schema";
import {
  comparisonInput,
  savedPrice,
  targetInput,
  watchChange,
  watchInput,
} from "../shared/buyerWorkspace";
import { compareQuoteAmounts, quantityQuoteExact } from "../shared/pricing";
import {
  PRICE_ALERT_CONSENT_VERSION,
  priceAlertQuote,
} from "../shared/priceAlerts";
import { emailOutbox, emailSuppressions } from "../drizzle/emailSchema";
import { mailConfiguration } from "./emailDb";
import { memberEmailKey } from "./memberSecurity";
import {
  cancelWatchEmails,
  currentWatchOffer,
  priceAlertKey,
} from "./priceAlerts";
import {
  assistantOffersByIds,
  type AssistantCandidate,
} from "./assistantCatalogue";
import { getDb } from "./db";
import { lockedAuth, type MemberAuth } from "./memberDb";

const fail = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });
async function database() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "workspace_unavailable",
    });
  return db;
}
export async function workspaceIds(auth: MemberAuth) {
  const db = await database();
  return db
    .select({ id: memberWatches.id, serviceId: memberWatches.serviceId })
    .from(memberWatches)
    .where(eq(memberWatches.memberId, auth.member.id))
    .limit(20);
}
export async function saveWatch(
  auth: MemberAuth,
  input: z.infer<typeof watchInput>
) {
  const [candidate] = await assistantOffersByIds([input.serviceId]);
  if (!candidate) throw fail("workspace_missing");
  const { service, provider } = candidate;
  if (service.priceUnit === "package") throw fail("workspace_unconfirmed");
  const db = await database();
  return db.transaction(async tx => {
    await lockedAuth(tx, auth);
    const owned = await tx
      .select()
      .from(memberWatches)
      .where(eq(memberWatches.memberId, auth.member.id))
      .limit(21);
    const existing = owned.find(
      watch => watch.serviceId === Number(input.serviceId.slice(8))
    );
    if (existing) return { id: existing.id };
    if (owned.length >= 20) throw fail("workspace_limit");
    const [created] = await tx
      .insert(memberWatches)
      .values({
        memberId: auth.member.id,
        serviceId: Number(input.serviceId.slice(8)),
        quantity: input.quantity,
        baseline: savedPrice(service),
        providerName: provider.name,
      })
      .$returningId();
    // Record only this real observation. No generated or retroactive price history.
    if (
      service.historyKey &&
      service.priceUnit &&
      service.priceCurrency &&
      service.priceType !== "from" &&
      quantityQuoteExact(service, input.quantity) != null
    )
      await tx.insert(priceSnapshots).values({
        serviceId: Number(input.serviceId.slice(8)),
        priceAmount: service.priceAmount.toFixed(4),
        sourceRate:
          service.catalogueListing === "api_source"
            ? service.sourceRate
            : String(service.priceAmount),
        priceCurrency: service.priceCurrency,
        priceUnit: service.priceUnit,
        packageDescription: service.packageDescription,
        kind: service.catalogueListing === "api_source" ? "source" : "review",
        comparisonKey: service.historyKey,
        capturedAt: new Date(service.checkedAt || Date.now()),
      });
    return { id: created!.id };
  });
}
export async function readWorkspace(auth: MemberAuth) {
  const db = await database();
  const [emailBlocked] = await db
    .select({ hash: emailSuppressions.recipientHash })
    .from(emailSuppressions)
    .where(
      eq(emailSuppressions.recipientHash, memberEmailKey(auth.member.email))
    )
    .limit(1);
  const emailAvailable =
    mailConfiguration().enabled &&
    !!auth.member.emailVerifiedAt &&
    !emailBlocked;
  const [watches, comparisons] = await Promise.all([
    db
      .select()
      .from(memberWatches)
      .where(eq(memberWatches.memberId, auth.member.id))
      .orderBy(desc(memberWatches.id))
      .limit(20),
    db
      .select()
      .from(memberComparisons)
      .where(eq(memberComparisons.memberId, auth.member.id))
      .orderBy(desc(memberComparisons.id))
      .limit(20),
  ]);
  const ids = watches.flatMap(w =>
    w.serviceId ? [`service-${w.serviceId}`] : []
  );
  const candidates: AssistantCandidate[] = [];
  const mailKeys = watches
    .filter(w => w.emailAlertTriggeredAt)
    .map(w => priceAlertKey(w.id, w.emailAlertRevision));
  const alerts = mailKeys.length
    ? await db
        .select({ key: emailOutbox.dedupeKey, status: emailOutbox.status })
        .from(emailOutbox)
        .where(
          and(
            eq(emailOutbox.memberId, auth.member.id),
            inArray(emailOutbox.dedupeKey, mailKeys)
          )
        )
    : [];
  for (let start = 0; start < ids.length; start += 8) {
    const chunks = [
      ids.slice(start, start + 4),
      ids.slice(start + 4, start + 8),
    ].filter(chunk => chunk.length);
    const pages = await Promise.all(
      chunks.map(chunk => assistantOffersByIds(chunk))
    );
    candidates.push(...pages.flat());
  }
  return {
    watches: watches.map(w => {
      const candidate =
        candidates.find(c => c.service.id === `service-${w.serviceId}`) ?? null;
      return {
        id: w.id,
        quantity: w.quantity,
        baseline: w.baseline,
        providerName: w.providerName,
        target: w.targetTotal,
        emailAlert: {
          enabled: w.emailAlertEnabled,
          available: emailAvailable,
          revision: w.emailAlertRevision,
          status: !w.emailAlertEnabled
            ? "off"
            : w.emailAlertTriggeredAt
              ? (alerts.find(
                  a => a.key === priceAlertKey(w.id, w.emailAlertRevision)
                )?.status ?? "recorded")
              : !emailAvailable
                ? "unavailable"
                : priceAlertQuote(
                      w.baseline,
                      candidate?.service ?? null,
                      w.quantity,
                      w.targetTotal
                    ).ready
                  ? "watching"
                  : "paused",
        },
        createdAt: w.createdAt,
        candidate,
        change: watchChange(
          w.baseline,
          candidate?.service ?? null,
          w.quantity,
          w.targetTotal
        ),
      };
    }),
    comparisons: comparisons.map(
      ({ memberId, fingerprint, ...comparison }) => comparison
    ),
  };
}
export async function removeWorkspaceItem(
  auth: MemberAuth,
  id: number,
  kind: "watch" | "comparison"
) {
  const db = await database();
  await db.transaction(async tx => {
    await lockedAuth(tx, auth);
    if (kind === "watch") await cancelWatchEmails(tx, auth.member.id, id);
    const table = kind === "watch" ? memberWatches : memberComparisons;
    await tx
      .delete(table)
      .where(and(eq(table.id, id), eq(table.memberId, auth.member.id)));
  });
  return { ok: true };
}
export async function setWatchTarget(
  auth: MemberAuth,
  input: z.infer<typeof targetInput>
) {
  const db = await database();
  return db.transaction(async tx => {
    const member = await lockedAuth(tx, auth);
    const [watch] = await tx
      .select()
      .from(memberWatches)
      .where(
        and(
          eq(memberWatches.id, input.id),
          eq(memberWatches.memberId, auth.member.id)
        )
      );
    if (!watch) throw fail("workspace_missing");
    const enabled =
      input.target != null && (input.emailAlert ?? watch.emailAlertEnabled);
    if (input.emailAlert && !input.target)
      throw fail("price_alert_target_required");
    const sameTarget =
      input.target == null || watch.targetTotal == null
        ? input.target === watch.targetTotal
        : compareQuoteAmounts(input.target, watch.targetTotal) === 0;
    const changed = !sameTarget || enabled !== watch.emailAlertEnabled;
    if (enabled && changed) {
      if (!member.emailVerifiedAt)
        throw fail("price_alert_verification_required");
      if (!mailConfiguration().enabled) throw fail("price_alert_unavailable");
      const [blocked] = await tx
        .select()
        .from(emailSuppressions)
        .where(
          eq(emailSuppressions.recipientHash, memberEmailKey(member.email))
        )
        .limit(1);
      if (blocked) throw fail("price_alert_unavailable");
      const candidate = await currentWatchOffer(watch.serviceId);
      if (
        !priceAlertQuote(
          watch.baseline,
          candidate?.service ?? null,
          watch.quantity,
          input.target
        ).ready
      )
        throw fail("price_alert_unconfirmed");
    }
    if (
      input.target != null &&
      (watch.baseline.priceType === "from" ||
        quantityQuoteExact(watch.baseline, watch.quantity) == null)
    )
      throw fail("workspace_unconfirmed");
    await tx
      .update(memberWatches)
      .set({
        targetTotal: sameTarget ? watch.targetTotal : input.target,
        ...(changed
          ? {
              emailAlertEnabled: enabled,
              emailAlertRevision: watch.emailAlertRevision + 1,
              emailAlertTriggeredAt: null,
              emailAlertNextCheckAt: enabled ? new Date() : null,
              ...(enabled
                ? {
                    emailAlertConsentAt: new Date(),
                    emailAlertConsentVersion: PRICE_ALERT_CONSENT_VERSION,
                  }
                : {}),
            }
          : {}),
      })
      .where(eq(memberWatches.id, watch.id));
    if (changed) await cancelWatchEmails(tx, member.id, watch.id);
    return { ok: true };
  });
}
export async function saveComparison(
  auth: MemberAuth,
  input: z.infer<typeof comparisonInput>
) {
  const candidates = await assistantOffersByIds(input.serviceIds);
  if (candidates.length !== input.serviceIds.length)
    throw fail("workspace_missing");
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        [...input.serviceIds].sort(),
        input.quantity,
        input.currency,
      ])
    )
    .digest("hex");
  const db = await database();
  return db.transaction(async tx => {
    await lockedAuth(tx, auth);
    const owned = await tx
      .select({
        id: memberComparisons.id,
        fingerprint: memberComparisons.fingerprint,
      })
      .from(memberComparisons)
      .where(eq(memberComparisons.memberId, auth.member.id))
      .limit(21);
    const existing = owned.find(c => c.fingerprint === fingerprint);
    if (existing) return { id: existing.id };
    if (owned.length >= 20) throw fail("workspace_limit");
    const [created] = await tx
      .insert(memberComparisons)
      .values({ ...input, memberId: auth.member.id, fingerprint })
      .$returningId();
    return { id: created!.id };
  });
}
export async function watchHistory(auth: MemberAuth, id: number) {
  const db = await database();
  const [watch] = await db
    .select()
    .from(memberWatches)
    .where(
      and(eq(memberWatches.id, id), eq(memberWatches.memberId, auth.member.id))
    );
  if (!watch) throw fail("workspace_missing");
  const [candidate] = watch.serviceId
    ? await assistantOffersByIds([`service-${watch.serviceId}`])
    : [];
  const service = candidate?.service;
  if (!service?.historyKey || !service.priceUnit || !service.priceCurrency)
    return { points: [], currency: null, unit: null };
  const rows = await db
    .select({
      at: priceSnapshots.capturedAt,
      sourceRate: priceSnapshots.sourceRate,
      amount: priceSnapshots.priceAmount,
      unit: priceSnapshots.priceUnit,
    })
    .from(priceSnapshots)
    .where(
      and(
        eq(priceSnapshots.serviceId, watch.serviceId!),
        eq(priceSnapshots.comparisonKey, service.historyKey),
        eq(priceSnapshots.priceCurrency, service.priceCurrency),
        eq(
          priceSnapshots.kind,
          service.catalogueListing === "api_source" ? "source" : "review"
        )
      )
    )
    .orderBy(desc(priceSnapshots.capturedAt), desc(priceSnapshots.id))
    .limit(60);
  const points = rows
    .reverse()
    .map(row => ({ at: row.at, rate: standardRate(row.sourceRate ?? row.amount, row.unit) }))
    .filter(point => /^\d+(\.\d+)?$/.test(point.rate));
  const rate =
    service.catalogueListing === "api_source"
      ? service.sourceRate
      : String(service.priceAmount);
  const at = service.checkedAt ? new Date(service.checkedAt) : null;
  if (
    rate &&
    /^\d+(\.\d+)?$/.test(rate) &&
    at &&
    Number.isFinite(at.getTime()) &&
    (!points.length || at > points.at(-1)!.at)
  )
    points.push({ at, rate });
  const unique = points.filter(
    (p, i) =>
      !i ||
      p.at.getTime() !== points[i - 1]!.at.getTime() ||
      p.rate !== points[i - 1]!.rate
  );
  return {
    points: unique,
    currency: service.priceCurrency,
    unit: service.priceUnit,
  };
}
