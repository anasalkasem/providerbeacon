import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  auditEntries,
  priceSnapshots,
  providerRecords,
  serviceRecords,
} from "../drizzle/schema";
import { getDb } from "./db";
import { writeAudit } from "./marketplaceDb";
import {
  normalizeApiService,
  NORMALIZATION_VERSION,
} from "./serviceNormalizer";

export type SyncTransaction = Parameters<
  Parameters<NonNullable<Awaited<ReturnType<typeof getDb>>>["transaction"]>[0]
>[0];
export type NormalizedService = ReturnType<typeof normalizeApiService>;

// The caller holds a short provider lock and commits this batch together with its job checkpoint.
export async function applyCatalogueBatch(
  tx: SyncTransaction,
  input: {
    provider: typeof providerRecords.$inferSelect;
    rows: NormalizedService[];
    sourceUrl: string;
    now: Date;
    actorUserId?: number;
    jobId: number;
  }
) {
  const { provider, rows: normalized, sourceUrl, now, actorUserId } = input;
  if (!normalized.length || normalized.length > 100)
    throw new Error("Invalid catalogue batch size");
  // Read only the current batch, never the entire provider catalogue or retained source JSON.
  const existingRows = await tx
    .select({
      id: serviceRecords.id,
      externalId: serviceRecords.externalId,
      sourceHash: serviceRecords.sourceHash,
      sourceUrl: serviceRecords.sourceUrl,
      sourceKind: serviceRecords.sourceKind,
      available: serviceRecords.available,
      normalizationVersion: serviceRecords.normalizationVersion,
      revision: serviceRecords.revision,
      status: serviceRecords.status,
      reviewStatus: serviceRecords.reviewStatus,
      name: serviceRecords.name,
      platform: serviceRecords.platform,
      category: serviceRecords.category,
      countryCode: serviceRecords.countryCode,
      pricePerThousandUsd: serviceRecords.pricePerThousandUsd,
      minOrder: serviceRecords.minOrder,
      maxOrder: serviceRecords.maxOrder,
      refillMode: serviceRecords.refillMode,
      refillDays: serviceRecords.refillDays,
    })
    .from(serviceRecords)
    .where(
      and(
        eq(serviceRecords.providerId, provider.id),
        inArray(
          serviceRecords.externalId,
          normalized.map(row => row.externalId)
        )
      )
    )
    .orderBy(asc(serviceRecords.id))
    .limit(201)
    .for("update");
  const existingById = new Map<string, (typeof existingRows)[number]>();
  for (const row of existingRows) {
    if (row.externalId == null) continue;
    if (existingById.has(row.externalId))
      throw new Error(
        "Existing provider catalogue contains duplicate external IDs; manual review is required"
      );
    existingById.set(row.externalId, row);
  }
  let reviewCount = 0;
  let priceChangeCount = 0;
  const unchanged: number[] = [];
  const inserts: (typeof serviceRecords.$inferInsert)[] = [];
  const snapshots: (typeof priceSnapshots.$inferInsert)[] = [];
  const changeAudits: (typeof auditEntries.$inferInsert)[] = [];
  for (const item of normalized) {
    const existing = existingById.get(item.externalId);
    const changed =
      !existing ||
      existing.sourceHash !== item.sourceHash ||
      existing.pricePerThousandUsd !== item.pricePerThousandUsd ||
      !existing.available ||
      existing.normalizationVersion < NORMALIZATION_VERSION ||
      existing.sourceUrl !== sourceUrl;
    if (!changed) {
      unchanged.push(existing!.id);
      continue;
    }
    const priceChanged = Boolean(
      existing && existing.pricePerThousandUsd !== item.pricePerThousandUsd
    );
    const { notes, ...data } = item;
    const values = {
      ...data,
      refillMode:
        data.refillMode as typeof serviceRecords.$inferSelect.refillMode,
      classificationNotes: notes,
      sourceKind: "provider_api" as const,
      sourceUrl,
      sourceUpdatedAt: now,
      normalizationVersion: NORMALIZATION_VERSION,
      reviewStatus: "pending" as const,
      incomplete: true,
      pricingConfirmed: false,
      policyReviewed: false,
      priceCheckedAt: null,
      evidenceUrl: null,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewReason: null,
      available: true,
      missingSourceAt: null,
    };
    if (existing) {
      const legacySource = JSON.stringify({
        service: existing.externalId,
        name: existing.name,
        category: existing.category,
        rate: existing.pricePerThousandUsd,
        min: existing.minOrder,
        max: existing.maxOrder,
        legacyPlatform: existing.platform,
        legacyRefillMode: existing.refillMode,
        legacyRefillDays: existing.refillDays,
        legacyCountry: existing.countryCode,
      });
      await tx
        .update(serviceRecords)
        .set({
          ...values,
          revision: existing.revision + 1,
          originalSourceData: sql`coalesce(${serviceRecords.originalSourceData}, cast(${legacySource} as json))`,
          status: existing.status === "active" ? "draft" : existing.status,
          ...(priceChanged ? { lastPriceChangeAt: now } : {}),
        })
        .where(eq(serviceRecords.id, existing.id));
      if (priceChanged) {
        priceChangeCount++;
        snapshots.push({
          serviceId: existing.id,
          pricePerThousandUsd: item.pricePerThousandUsd,
        });
      }
      const keys = [
        "name",
        "platform",
        "category",
        "countryCode",
        "pricePerThousandUsd",
        "minOrder",
        "maxOrder",
        "refillMode",
        "refillDays",
        "sourceHash",
        "sourceUrl",
        "available",
      ] as const;
      changeAudits.push({
        actorUserId: actorUserId,
        action: "service.source.changed",
        entityType: "service",
        entityId: String(existing.id),
        summary: "Provider source changed; service returned to review",
        metadata: {
          reason: "Provider catalogue synchronization",
          before: {
            ...Object.fromEntries(keys.map(key => [key, existing[key]])),
            revision: existing.revision,
            status: existing.status,
            reviewStatus: existing.reviewStatus,
          },
          after: {
            ...Object.fromEntries(keys.map(key => [key, values[key]])),
            revision: existing.revision + 1,
            status: existing.status === "active" ? "draft" : existing.status,
            reviewStatus: "pending",
          },
        },
      });
    } else {
      const slug = `${provider.slug}-${createHash("sha256").update(item.externalId).digest("hex").slice(0, 24)}`;
      inserts.push({
        ...values,
        originalSourceData: item.sourceData,
        providerId: provider.id,
        slug,
        status: "draft",
      });
    }
    reviewCount++;
  }
  for (let offset = 0; offset < inserts.length; offset += 100) {
    const batch = inserts.slice(offset, offset + 100);
    const inserted = await tx
      .insert(serviceRecords)
      .values(batch)
      .$returningId();
    inserted.forEach((row, index) =>
      snapshots.push({
        serviceId: row.id,
        pricePerThousandUsd: batch[index]!.pricePerThousandUsd,
      })
    );
  }
  for (let offset = 0; offset < unchanged.length; offset += 250) {
    await tx
      .update(serviceRecords)
      .set({ sourceUpdatedAt: now })
      .where(inArray(serviceRecords.id, unchanged.slice(offset, offset + 250)));
  }
  for (let offset = 0; offset < snapshots.length; offset += 250)
    await tx
      .insert(priceSnapshots)
      .values(snapshots.slice(offset, offset + 250));
  for (let offset = 0; offset < changeAudits.length; offset += 100)
    await tx
      .insert(auditEntries)
      .values(changeAudits.slice(offset, offset + 100));
  await writeAudit(
    {
      actorUserId,
      action: "integration.services.batch",
      entityType: "provider",
      entityId: String(provider.id),
      summary: `Processed ${normalized.length} services; ${reviewCount} require review`,
      metadata: {
        jobId: input.jobId,
        importedCount: normalized.length,
        reviewCount,
        priceChangeCount,
        unchangedCount: unchanged.length,
        newCount: inserts.length,
      },
    },
    tx
  );
  return { importedCount: normalized.length, reviewCount, priceChangeCount };
}
