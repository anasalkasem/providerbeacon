import { priceHistoryKey } from "./priceHistory";
import { assertSameCatalogueSource } from "../shared/providerSourceIdentity";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  auditEntries,
  priceSnapshots,
  providerRecords,
  serviceRecords,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  compareQuoteAmounts,
  priceCurrencies,
  type PriceCurrency,
} from "../shared/pricing";
import { writeAudit } from "./marketplaceDb";
import { sourcePricingIdentity } from "./sourcePricing";
import { automaticSourcePricing } from "./providerPricing";
import type { ProviderPricingSnapshot } from "../shared/providerPricing";
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
    sourceCurrency?: string | null;
    pricingSnapshot?: ProviderPricingSnapshot | null;
    now: Date;
    actorUserId?: number;
    jobId: number;
  }
) {
  const { provider, sourceUrl, now, actorUserId } = input;
  const pricingSnapshot = input.pricingSnapshot ?? {
    currency: priceCurrencies.includes(input.sourceCurrency as PriceCurrency)
      ? input.sourceCurrency!
      : null,
    perThousandEvidenceUrl: null,
  };
  // Rebuild from retained source so pre-deployment staged payloads remain resumable.
  const normalized = input.rows.map((row, index) =>
    normalizeApiService(row.sourceData, index)
  );
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
      reviewReason: serviceRecords.reviewReason,
      reviewedAt: serviceRecords.reviewedAt,
      reviewedByUserId: serviceRecords.reviewedByUserId,
      name: serviceRecords.name,
      platform: serviceRecords.platform,
      category: serviceRecords.category,
      countryCode: serviceRecords.countryCode,
      priceAmount: serviceRecords.priceAmount,
      sourceRate: serviceRecords.sourceRate,
      sourceCurrency: serviceRecords.sourceCurrency,
      sourcePricingMode: serviceRecords.sourcePricingMode,
      sourcePriceUnit: serviceRecords.sourcePriceUnit,
      sourcePackageDescription: serviceRecords.sourcePackageDescription,
      sourcePricingEvidenceUrl: serviceRecords.sourcePricingEvidenceUrl,
      sourcePricingConfirmedAt: serviceRecords.sourcePricingConfirmedAt,
      sourcePricingIdentity: serviceRecords.sourcePricingIdentity,
      priceCurrency: serviceRecords.priceCurrency,
      priceUnit: serviceRecords.priceUnit,
      packageDescription: serviceRecords.packageDescription,
      minOrder: serviceRecords.minOrder,
      maxOrder: serviceRecords.maxOrder,
      refillMode: serviceRecords.refillMode,
      refillDays: serviceRecords.refillDays,
      quality: serviceRecords.quality,
      startMinutesMin: serviceRecords.startMinutesMin,
      startMinutesMax: serviceRecords.startMinutesMax,
      deliveryMinutesMin: serviceRecords.deliveryMinutesMin,
      deliveryMinutesMax: serviceRecords.deliveryMinutesMax,
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
  const requestedIds = new Set(
    normalized.map(row => row.externalId.toLowerCase())
  );
  for (const row of existingRows) {
    if (row.externalId == null) continue;
    if (!requestedIds.has(row.externalId.toLowerCase()))
      throw new Error("Ambiguous provider external IDs require manual review");
    if (existingById.has(row.externalId.toLowerCase()))
      throw new Error(
        "Existing provider catalogue contains duplicate external IDs; manual review is required"
      );
    existingById.set(row.externalId.toLowerCase(), row);
  }
  let reviewCount = 0;
  let priceChangeCount = 0;
  const unchanged: number[] = [];
  const inserts: (typeof serviceRecords.$inferInsert)[] = [];
  const snapshots: (typeof priceSnapshots.$inferInsert)[] = [];
  const changeAudits: (typeof auditEntries.$inferInsert)[] = [];
  for (const item of normalized) {
    const existing = existingById.get(item.externalId.toLowerCase());
    if (existing?.sourceKind === "provider_api")
      assertSameCatalogueSource(existing.sourceUrl, sourceUrl);
    const automatic = automaticSourcePricing(
      item.sourceData,
      sourceUrl,
      pricingSnapshot
    );
    const sourceCurrency = automatic.currency;
    const manual = existing?.sourcePricingMode === "manual";
    const keepSourcePricing =
      manual &&
      existing.sourcePricingIdentity ===
        sourcePricingIdentity(
          item.sourceData,
          sourceCurrency,
          sourceUrl,
          existing.sourcePriceUnit
        );
    const canDetect = !keepSourcePricing;
    const unit = keepSourcePricing
      ? existing.sourcePriceUnit
      : canDetect
        ? automatic.unit
        : null;
    const evidenceUrl = keepSourcePricing
      ? existing.sourcePricingEvidenceUrl
      : unit
        ? automatic.evidenceUrl
        : null;
    const sourceChanged =
      !existing ||
      existing.sourceHash !== item.sourceHash ||
      existing.sourceCurrency !== sourceCurrency ||
      (existing.platform === "Unknown" &&
        existing.category === "Website traffic" &&
        existing.reviewStatus === "pending" &&
        item.platform === "Website") ||
      !existing.available ||
      existing.normalizationVersion < NORMALIZATION_VERSION ||
      existing.sourceUrl !== sourceUrl;
    const pricingChanged =
      existing?.sourcePriceUnit !== unit ||
      existing?.sourcePricingEvidenceUrl !== evidenceUrl;
    if (!sourceChanged && !pricingChanged) {
      unchanged.push(existing!.id);
      continue;
    }
    // Adopting the standard or refreshing its source link is metadata maintenance.
    // Preserve reviewed prices, publication and withdrawals when the source itself
    // has not changed. A real change from a different native rate still needs review.
    if (
      existing &&
      !sourceChanged &&
      (existing.sourcePriceUnit === unit || existing.sourcePriceUnit == null)
    ) {
      const metadata = {
        sourcePriceUnit: unit,
        sourcePricingMode: keepSourcePricing
          ? ("manual" as const)
          : ("auto" as const),
        sourcePackageDescription: keepSourcePricing
          ? existing.sourcePackageDescription
          : unit === "package"
            ? item.name
            : null,
        sourcePricingEvidenceUrl: evidenceUrl,
        sourcePricingConfirmedAt: keepSourcePricing
          ? existing.sourcePricingConfirmedAt
          : now,
        sourcePricingIdentity: sourcePricingIdentity(
          item.sourceData,
          sourceCurrency,
          sourceUrl,
          unit
        ),
        sourceUpdatedAt: now,
        revision: existing.revision + 1,
      };
      await tx
        .update(serviceRecords)
        .set(metadata)
        .where(eq(serviceRecords.id, existing.id));
      changeAudits.push({
        actorUserId,
        action: "service.source.pricing.standardize",
        entityType: "service",
        entityId: String(existing.id),
        summary:
          "Source pricing metadata refreshed; editorial review preserved",
        metadata: {
          before: {
            sourcePriceUnit: existing.sourcePriceUnit,
            sourcePricingEvidenceUrl: existing.sourcePricingEvidenceUrl,
            revision: existing.revision,
          },
          after: metadata,
        },
      });
      unchanged.push(existing.id);
      continue;
    }
    const previousRate = existing?.sourceRate ?? existing?.priceAmount ?? "";
    const decimalRates =
      /^\d+(\.\d+)?$/.test(previousRate) &&
      /^\d+(\.\d+)?$/.test(item.sourceRate);
    const priceChanged = Boolean(
      existing &&
        (decimalRates
          ? compareQuoteAmounts(previousRate, item.sourceRate) !== 0
          : Number(previousRate) !== Number(item.sourceRate))
    );
    const { notes, ...data } = item;
    // A later price sync must not undo an operator's withdrawal from a public API catalogue.
    const preserveWithdrawal =
      provider.apiCataloguePublished &&
      existing?.reviewStatus === "changes_requested";
    const values = {
      ...data,
      refillMode:
        data.refillMode as typeof serviceRecords.$inferSelect.refillMode,
      classificationNotes: notes,
      sourceKind: "provider_api" as const,
      sourceUrl,
      sourceUpdatedAt: now,
      normalizationVersion: NORMALIZATION_VERSION,
      reviewStatus: preserveWithdrawal
        ? ("changes_requested" as const)
        : ("pending" as const),
      incomplete: true,
      pricingConfirmed: false,
      sourceCurrency,
      sourcePricingMode: keepSourcePricing
        ? ("manual" as const)
        : ("auto" as const),
      sourcePriceUnit: unit,
      sourcePackageDescription: keepSourcePricing
        ? existing!.sourcePackageDescription
        : unit === "package"
          ? item.name
          : null,
      sourcePricingEvidenceUrl: evidenceUrl,
      sourcePricingConfirmedAt: keepSourcePricing
        ? existing!.sourcePricingConfirmedAt
        : unit
          ? now
          : null,
      sourcePricingIdentity: unit
        ? sourcePricingIdentity(
            item.sourceData,
            sourceCurrency,
            sourceUrl,
            unit
          )
        : null,
      priceCurrency: sourceCurrency,
      priceUnit: unit,
      packageDescription: unit === "package" ? item.name : null,
      policyReviewed: false,
      priceCheckedAt: null,
      evidenceUrl: null,
      reviewedAt: preserveWithdrawal ? existing.reviewedAt : null,
      reviewedByUserId: preserveWithdrawal ? existing.reviewedByUserId : null,
      reviewReason: preserveWithdrawal ? existing.reviewReason : null,
      available: true,
      missingSourceAt: null,
    };
    if (existing) {
      const legacySource = JSON.stringify({
        service: existing.externalId,
        name: existing.name,
        category: existing.category,
        rate: existing.priceAmount,
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
      if (
        priceChanged ||
        existing.sourceCurrency !== sourceCurrency ||
        existing.sourcePriceUnit !== unit
      ) {
        if (priceChanged) priceChangeCount++;
        snapshots.push({
          serviceId: existing.id,
          comparisonKey: priceHistoryKey({ ...existing, ...values }),
          priceAmount: item.priceAmount,
          sourceRate: item.sourceRate,
          priceCurrency: sourceCurrency,
          priceUnit: values.sourcePriceUnit,
          packageDescription: values.sourcePackageDescription,
          kind: "source",
        });
      }
      const keys = [
        "name",
        "platform",
        "category",
        "countryCode",
        "priceAmount",
        "sourceRate",
        "sourceCurrency",
        "sourcePricingMode",
        "sourcePriceUnit",
        "sourcePackageDescription",
        "sourcePricingEvidenceUrl",
        "sourcePricingConfirmedAt",
        "sourcePricingIdentity",
        "priceCurrency",
        "priceUnit",
        "packageDescription",
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
            reviewStatus: values.reviewStatus,
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
        comparisonKey: priceHistoryKey(batch[index]!),
        priceAmount: batch[index]!.priceAmount,
        sourceRate: batch[index]!.sourceRate,
        priceCurrency: batch[index]!.sourceCurrency,
        priceUnit: batch[index]!.sourcePriceUnit,
        kind: "source",
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
