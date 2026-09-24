import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import {
  priceSnapshots,
  providerRecords,
  serviceRecords,
} from "../drizzle/schema";
import { reviewBatchInput, reviewEditInput } from "../shared/serviceReview";
import { getDb } from "./db";
import { writeAudit } from "./marketplaceDb";
import {
  catalogueSource,
  classifyService,
  isStale,
  NORMALIZATION_VERSION,
  reviewBlockers,
} from "./serviceNormalizer";

type Actor = { actorUserId: number; ipAddress?: string };
const conflict = () =>
  new TRPCError({ code: "CONFLICT", message: "review_conflict" });
const notReady = () =>
  new TRPCError({ code: "BAD_REQUEST", message: "review_not_ready" });
export async function getServiceReview(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [row] = await db
    .select({
      service: serviceRecords,
      providerName: providerRecords.name,
      providerStatus: providerRecords.status,
    })
    .from(serviceRecords)
    .innerJoin(
      providerRecords,
      eq(providerRecords.id, serviceRecords.providerId)
    )
    .where(eq(serviceRecords.id, id))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  const prices = await db
    .select()
    .from(priceSnapshots)
    .where(eq(priceSnapshots.serviceId, id))
    .orderBy(desc(priceSnapshots.id))
    .limit(20);
  return {
    ...row,
    blockers: reviewBlockers(row.service),
    stale: isStale(row.service),
    prices,
  };
}

export async function editServiceReview(
  raw: z.input<typeof reviewEditInput> & Actor
) {
  const input = reviewEditInput.parse(raw);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const [before] = await tx
      .select()
      .from(serviceRecords)
      .where(eq(serviceRecords.id, input.id))
      .for("update");
    if (!before || before.revision !== input.revision) throw conflict();
    if (before.normalizationVersion < NORMALIZATION_VERSION) throw notReady();
    const changes = {
      platform: input.platform,
      category: input.category,
      countryCode: input.countryCode,
      priceAmount: input.price.toFixed(4),
      priceCurrency: input.priceCurrency,
      priceUnit: input.priceUnit ?? "per_1000",
      packageDescription:
        input.priceUnit === "package" ? input.packageDescription : null,
      minOrder: input.minOrder,
      maxOrder: input.maxOrder,
      refillMode: input.refillMode,
      refillDays: ["manual", "automatic"].includes(input.refillMode)
        ? input.refillDays
        : null,
      evidenceUrl: input.evidenceUrl,
      pricingConfirmed: input.pricingConfirmed,
      policyReviewed: input.policyReviewed,
      priceCheckedAt: input.pricingConfirmed ? new Date() : null,
      reviewStatus: "pending" as const,
      status: before.status === "active" ? ("draft" as const) : before.status,
      revision: before.revision + 1,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewReason: input.reason,
    };
    const after = { ...before, ...changes };
    const priceChanged =
      before.priceAmount !== changes.priceAmount ||
      before.priceCurrency !== changes.priceCurrency ||
      before.priceUnit !== changes.priceUnit ||
      before.packageDescription !== changes.packageDescription;
    await tx
      .update(serviceRecords)
      .set({
        ...changes,
        incomplete: reviewBlockers(after).length > 0,
        ...(priceChanged ? { lastPriceChangeAt: new Date() } : {}),
      })
      .where(eq(serviceRecords.id, input.id));
    if (priceChanged)
      await tx.insert(priceSnapshots).values({
        serviceId: input.id,
        priceAmount: changes.priceAmount,
        priceCurrency: changes.priceCurrency,
        priceUnit: changes.priceUnit,
        packageDescription: changes.packageDescription,
        kind: "review",
      });
    await writeAudit(
      {
        actorUserId: raw.actorUserId,
        ipAddress: raw.ipAddress,
        action: "service.review.edit",
        entityType: "service",
        entityId: String(input.id),
        summary: "Corrected service details; approval reset",
        metadata: {
          reason: input.reason,
          before: Object.fromEntries(
            Object.keys(changes).map(key => [
              key,
              before[key as keyof typeof before],
            ])
          ),
          after: changes,
        },
      },
      tx
    );
    return { success: true, revision: changes.revision };
  });
}

export async function applyServiceReview(
  raw: z.input<typeof reviewBatchInput> &
    Actor & { action: "approve" | "request_changes" | "publish" }
) {
  const input = reviewBatchInput.parse(raw);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    // Provider locks precede service locks, matching the importer and provider status mutations.
    const ids = input.items.map(item => item.id).sort((a, b) => a - b);
    const owners = await tx
      .select({ providerId: serviceRecords.providerId })
      .from(serviceRecords)
      .where(inArray(serviceRecords.id, ids));
    const providerIds = Array.from(
      new Set(owners.map(row => row.providerId))
    ).sort((a, b) => a - b);
    if (!providerIds.length) throw conflict();
    const providers = await tx
      .select()
      .from(providerRecords)
      .where(inArray(providerRecords.id, providerIds))
      .orderBy(asc(providerRecords.id))
      .for("update");
    const rows = await tx
      .select()
      .from(serviceRecords)
      .where(inArray(serviceRecords.id, ids))
      .orderBy(asc(serviceRecords.id))
      .for("update");
    if (
      rows.length !== ids.length ||
      rows.some(
        row =>
          input.items.find(item => item.id === row.id)?.revision !==
          row.revision
      )
    )
      throw conflict();
    for (const before of rows) {
      if (
        raw.action !== "request_changes" &&
        (reviewBlockers(before).length || isStale(before))
      )
        throw notReady();
      if (
        raw.action === "publish" &&
        (before.screeningStatus === "held" || before.reviewStatus !== "approved" ||
          providers.find(provider => provider.id === before.providerId)
            ?.status !== "active" ||
          ["paused", "archived"].includes(before.status))
      )
        throw notReady();
      const after = {
        reviewStatus:
          raw.action === "request_changes"
            ? ("changes_requested" as const)
            : ("approved" as const),
        status:
          raw.action === "publish"
            ? ("active" as const)
            : raw.action === "request_changes" && before.status === "active"
              ? ("draft" as const)
              : before.status,
        revision: before.revision + 1,
        reviewedAt: new Date(),
        reviewedByUserId: raw.actorUserId,
        reviewReason: input.reason,
      };
      await tx
        .update(serviceRecords)
        .set(after)
        .where(eq(serviceRecords.id, before.id));
      await writeAudit(
        {
          actorUserId: raw.actorUserId,
          ipAddress: raw.ipAddress,
          action: `service.review.${raw.action}`,
          entityType: "service",
          entityId: String(before.id),
          summary: `Service review: ${raw.action}`,
          metadata: {
            reason: input.reason,
            before: {
              reviewStatus: before.reviewStatus,
              status: before.status,
              revision: before.revision,
            },
            after,
          },
        },
        tx
      );
    }
    return { success: true, count: rows.length };
  });
}

// Idempotent, bounded repair of legacy classifications. Never refreshes source timestamps or publishes.
export async function normalizeLegacyBatch(limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const candidates = await tx
      .select({ id: serviceRecords.id, providerId: serviceRecords.providerId })
      .from(serviceRecords)
      .where(eq(serviceRecords.normalizationVersion, 0))
      .orderBy(asc(serviceRecords.id))
      .limit(Math.min(100, Math.max(1, limit)));
    if (!candidates.length) return 0;
    const providerIds = Array.from(
      new Set(candidates.map(row => row.providerId))
    ).sort((a, b) => a - b);
    await tx
      .select({ id: providerRecords.id })
      .from(providerRecords)
      .where(inArray(providerRecords.id, providerIds))
      .orderBy(asc(providerRecords.id))
      .for("update");
    const rows = await tx
      .select()
      .from(serviceRecords)
      .where(
        and(
          inArray(
            serviceRecords.id,
            candidates.map(row => row.id)
          ),
          eq(serviceRecords.normalizationVersion, 0)
        )
      )
      .orderBy(asc(serviceRecords.id))
      .for("update");
    for (const row of rows) {
      const source = catalogueSource({
        service: row.externalId,
        name: row.name,
        category: row.category,
        rate: row.priceAmount,
        min: row.minOrder,
        max: row.maxOrder,
      });
      const { notes, ...classified } = classifyService(source);
      await tx
        .update(serviceRecords)
        .set({
          ...classified,
          refillMode: classified.refillMode as typeof row.refillMode,
          sourceData: row.sourceData ?? source,
          originalSourceData: row.originalSourceData ?? {
            ...source,
            legacyPlatform: row.platform,
            legacyCategory: row.category,
            legacyRefillMode: row.refillMode,
            legacyRefillDays: row.refillDays,
            legacyCountry: row.countryCode,
            legacyStatus: row.status,
          },
          sourceKind: "legacy",
          pricingConfirmed: false,
          policyReviewed: false,
          evidenceUrl: null,
          priceCheckedAt: null,
          reviewedAt: null,
          reviewedByUserId: null,
          classificationNotes: notes,
          normalizationVersion: NORMALIZATION_VERSION,
          incomplete: true,
          status: row.status === "active" ? "draft" : row.status,
          reviewStatus: "pending",
          revision: row.revision + 1,
        })
        .where(eq(serviceRecords.id, row.id));
    }
    await writeAudit(
      {
        action: "service.classification.backfill",
        entityType: "catalogue",
        entityId: "legacy",
        summary: `Classified ${rows.length} legacy services; original data retained`,
        metadata: {
          ids: rows.map(row => row.id),
          normalizationVersion: NORMALIZATION_VERSION,
          reason:
            "Replace first-word platform parsing with conservative classification; preserve original source and timestamps",
        },
      },
      tx
    );
    return rows.length;
  });
}

export async function runLegacyNormalization() {
  try {
    let total = 0;
    while (true) {
      const count = await normalizeLegacyBatch();
      if (!count) break;
      total += count;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.info(
      `[Catalogue] Legacy normalization completed: ${total} services`
    );
  } catch {
    console.error(
      "[Catalogue] Legacy normalization stopped; pending rows are retained for retry on next startup"
    );
  }
}
