import { invalidateCatalogueCaches } from "./catalogueCache";
import { assertSameCatalogueSource, CatalogueSourceConflict } from "../shared/providerSourceIdentity";
import { assertCatalogueSource } from "./providerSourceIdentity";
import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { setImmediate as yieldTurn } from "node:timers/promises";
import {
  auditEntries,
  providerIntegrations,
  providerRecords,
  providerSyncJobs,
  providerSyncRows,
  serviceRecords,
} from "../drizzle/schema";
import { getDb } from "./db";
import { assertPublicHttpsUrl, writeAudit } from "./marketplaceDb";
import { decryptValue } from "./security";
import { inspectApiService, normalizeApiService } from "./serviceNormalizer";
import { fetchProviderPricing } from "./providerPricing";
import type { ProviderPricingSnapshot } from "../shared/providerPricing";
import {
  applyCatalogueBatch,
  type NormalizedService,
  type SyncTransaction,
} from "./catalogueImport";

export const SYNC_BATCH_SIZE = 100;
export const MAX_CATALOGUE_SERVICES = 50_000;
export const MAX_CATALOGUE_BYTES = 16 * 1024 * 1024;
const LEASE_MS = 120_000;
const activeStatuses = [
  "queued",
  "preparing",
  "importing",
  "reconciling",
] as const;
type Job = typeof providerSyncJobs.$inferSelect;
type Integration = typeof providerIntegrations.$inferSelect;
type SourceIssue = {
  sourceData: ReturnType<typeof inspectApiService>["sourceData"];
  problems: string[];
};
type SnapshotItem = {
  externalId: string;
  invalid: boolean;
  payload: NormalizedService | SourceIssue;
};
class SyncError extends Error {}
class LostLease extends Error {}
const leaseDate = () => new Date(Date.now() + LEASE_MS);

export function integrationFingerprint(row: Integration) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        row.providerId,
        row.baseUrl,
        row.credentialCiphertext,
        row.credentialIv,
        row.credentialTag,
        row.credentialVersion,
      ])
    )
    .digest("hex");
}

async function database() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}

// All catalogue writes use provider -> integration -> job locks, matching enqueue/configuration writes.
async function withJob<T>(
  claim: Job,
  execute: (
    tx: SyncTransaction,
    job: Job,
    provider: typeof providerRecords.$inferSelect,
    integration: Integration
  ) => Promise<T>
) {
  const db = await database();
  return db.transaction(async tx => {
    const [provider] = await tx
      .select()
      .from(providerRecords)
      .where(eq(providerRecords.id, claim.providerId))
      .for("update");
    const [integration] = await tx
      .select()
      .from(providerIntegrations)
      .where(eq(providerIntegrations.id, claim.integrationId))
      .for("update");
    const [job] = await tx
      .select()
      .from(providerSyncJobs)
      .where(eq(providerSyncJobs.id, claim.id))
      .for("update");
    if (
      !job ||
      !job.activeProviderId ||
      job.leaseToken !== claim.leaseToken ||
      !job.leaseUntil ||
      job.leaseUntil.getTime() <= Date.now()
    )
      throw new LostLease();
    if (!provider || provider.status === "suspended")
      throw new SyncError(
        "Provider is unavailable or suspended; completed draft batches were preserved"
      );
    if (
      !integration ||
      integrationFingerprint(integration) !== job.configFingerprint
    )
      throw new SyncError(
        "Connection configuration changed; run synchronization again"
      );
    await tx
      .update(providerSyncJobs)
      .set({ leaseUntil: leaseDate() })
      .where(eq(providerSyncJobs.id, job.id));
    return execute(tx, job, provider, integration);
  });
}

async function fetchCatalogue(
  integration: Integration
): Promise<{ rows: SnapshotItem[]; pricing: ProviderPricingSnapshot }> {
  if (
    !integration.credentialCiphertext ||
    !integration.credentialIv ||
    !integration.credentialTag
  )
    throw new SyncError("Provider credential is not configured");
  let apiKey: string;
  try {
    apiKey = decryptValue(
      {
        ciphertext: integration.credentialCiphertext,
        iv: integration.credentialIv,
        tag: integration.credentialTag,
        version: integration.credentialVersion,
      },
      `provider-integration:${integration.id}`
    );
  } catch {
    throw new SyncError(
      "Stored provider credential could not be opened; save the credential again"
    );
  }
  let endpoint: URL;
  try {
    endpoint = await assertPublicHttpsUrl(integration.baseUrl);
  } catch {
    throw new SyncError("Provider endpoint failed the public HTTPS validation");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let payload: unknown;
  let pricing: ProviderPricingSnapshot;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: apiKey, action: "services" }),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new SyncError(`Provider API returned HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new SyncError("Provider API returned an empty body");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_CATALOGUE_BYTES) {
          await reader.cancel();
          throw new SyncError(
            "Provider catalogue exceeds the 16 MB response limit; no changes were applied"
          );
        }
        chunks.push(value);
      }
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new SyncError("Provider API did not return valid JSON");
      }
    } finally {
      reader.releaseLock();
    }
    pricing = await fetchProviderPricing(endpoint, apiKey, integration.sourceCurrency);
  } catch (error) {
    if (error instanceof SyncError) throw error;
    throw new SyncError(
      "Provider request failed or exceeded the 30-second timeout; no changes were applied"
    );
  } finally {
    clearTimeout(timeout);
    apiKey = "";
  }
  if (!Array.isArray(payload))
    throw new SyncError("Provider API did not return a service list");
  if (!payload.length)
    throw new SyncError(
      "Provider returned an empty catalogue; existing services were preserved"
    );
  if (payload.length > MAX_CATALOGUE_SERVICES)
    throw new SyncError(
      "Provider catalogue exceeds the 50,000-service safety limit; no changes were applied"
    );
  const rows: SnapshotItem[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < payload.length; index++) {
    const inspected = inspectApiService(payload[index]);
    if (inspected.problems.includes("invalid_id"))
      throw new SyncError(
        `Invalid service identity at row ${index + 1} of ${payload.length}; no changes were applied`
      );
    const key = inspected.externalId.toLowerCase();
    if (seen.has(key))
      throw new SyncError(
        "Provider response contains duplicate service IDs; no changes were applied"
      );
    seen.add(key);
    const invalid = inspected.problems.length > 0;
    rows.push({
      externalId: inspected.externalId,
      invalid,
      payload: invalid
        ? { sourceData: inspected.sourceData, problems: inspected.problems }
        : normalizeApiService(payload[index], index),
    });
    if (index % 50 === 49) await yieldTurn();
  }
  if (rows.every(row => row.invalid))
    throw new SyncError(
      `All ${rows.length} source services have invalid required values; existing services were preserved`
    );
  return { rows, pricing };
}

async function prepareSnapshot(claim: Job) {
  const integration = await withJob(
    claim,
    async (tx, job, _provider, current) => {
      await assertCatalogueSource(tx, current.providerId, current.baseUrl);
      await tx
        .update(providerSyncJobs)
        .set({
          status: "preparing",
          totalCount: 0,
          processedCount: 0,
          startedAt: job.startedAt ?? new Date(),
        })
        .where(eq(providerSyncJobs.id, job.id));
      return current;
    }
  );
  // A crash during preparation restarts staging, before any catalogue record has changed.
  let removed: number;
  do {
    removed = await withJob(claim, async tx => {
      const [result] = await tx
        .delete(providerSyncRows)
        .where(eq(providerSyncRows.jobId, claim.id))
        .limit(1000);
      return result.affectedRows;
    });
  } while (removed === 1000);
  const { rows, pricing } = await fetchCatalogue(integration);
  const snapshotAt = new Date();
  for (let offset = 0; offset < rows.length; offset += SYNC_BATCH_SIZE) {
    await withJob(claim, async tx => {
      await tx.insert(providerSyncRows).values(
        rows.slice(offset, offset + SYNC_BATCH_SIZE).map((row, i) => ({
          jobId: claim.id,
          ordinal: offset + i + 1,
          externalId: row.externalId,
          invalid: row.invalid,
          payload: row.payload,
        }))
      );
    });
    await yieldTurn();
  }
  await withJob(claim, async (tx, job, _provider, current) => {
    if (current.sourceCurrency !== pricing.currency) {
      await tx.update(providerIntegrations).set({ sourceCurrency: pricing.currency })
        .where(eq(providerIntegrations.id, current.id));
      await writeAudit({ actorUserId: job.actorUserId ?? undefined,
        action: "integration.source_currency.detect", entityType: "provider_integration", entityId: String(current.id),
        summary: "Read pricing currency from the connected provider account",
        metadata: { before: current.sourceCurrency, after: pricing.currency, jobId: job.id },
      }, tx);
    }
    await tx
      .update(providerSyncJobs)
      .set({
        status: "importing",
        totalCount: rows.length,
        invalidCount: rows.filter(row => row.invalid).length,
        snapshotAt,
        pricingSnapshot: pricing,
        leaseToken: null,
        leaseUntil: null,
      })
      .where(eq(providerSyncJobs.id, claim.id));
  });
}

async function importSnapshotBatch(claim: Job) {
  await withJob(claim, async (tx, job, provider, integration) => {
    const staged = await tx
      .select({
        payload: providerSyncRows.payload,
        invalid: providerSyncRows.invalid,
        externalId: providerSyncRows.externalId,
        ordinal: providerSyncRows.ordinal,
      })
      .from(providerSyncRows)
      .where(
        and(
          eq(providerSyncRows.jobId, job.id),
          gt(providerSyncRows.ordinal, job.processedCount)
        )
      )
      .orderBy(asc(providerSyncRows.ordinal))
      .limit(SYNC_BATCH_SIZE);
    if (
      !staged.length ||
      !job.snapshotAt ||
      staged[0].ordinal !== job.processedCount + 1
    )
      throw new SyncError(
        "Validated snapshot is incomplete; run synchronization again"
      );
    const valid = staged.filter(row => !row.invalid);
    const invalid = staged.filter(row => row.invalid);
    const result = valid.length
      ? await applyCatalogueBatch(tx, {
          provider,
          rows: valid.map(row => row.payload as NormalizedService),
          sourceUrl: job.sourceUrl,
          sourceCurrency: integration.sourceCurrency,
          pricingSnapshot: job.pricingSnapshot,
          now: job.snapshotAt,
          actorUserId: job.actorUserId ?? undefined,
          jobId: job.id,
        })
      : { importedCount: 0, reviewCount: 0, priceChangeCount: 0 };
    if (invalid.length) {
      const existing = await tx
        .select({
          id: serviceRecords.id,
          externalId: serviceRecords.externalId,
          sourceKind: serviceRecords.sourceKind,
          sourceUrl: serviceRecords.sourceUrl,
          revision: serviceRecords.revision,
          status: serviceRecords.status,
          reviewStatus: serviceRecords.reviewStatus,
          incomplete: serviceRecords.incomplete,
          pricingConfirmed: serviceRecords.pricingConfirmed,
          policyReviewed: serviceRecords.policyReviewed,
          reviewReason: serviceRecords.reviewReason,
          reviewedAt: serviceRecords.reviewedAt,
          reviewedByUserId: serviceRecords.reviewedByUserId,
        })
        .from(serviceRecords)
        .where(
          and(
            eq(serviceRecords.providerId, provider.id),
            inArray(
              serviceRecords.externalId,
              invalid.map(row => row.externalId)
            )
          )
        )
        .limit(201)
        .for("update");
      for (const row of existing) {
        if (row.sourceKind === "provider_api") assertSameCatalogueSource(row.sourceUrl, job.sourceUrl);
        await tx
          .update(serviceRecords)
          .set({
            status: row.status === "active" ? "draft" : row.status,
            reviewStatus: "changes_requested",
            incomplete: true,
            pricingConfirmed: false,
            policyReviewed: false,
            reviewedAt: null,
            reviewedByUserId: null,
            revision: row.revision + 1,
            reviewReason:
              "Invalid provider source values; inspect the quarantined source record in the connection's sync report",
          })
          .where(eq(serviceRecords.id, row.id));
      }
      if (existing.length)
        await tx.insert(auditEntries).values(
          existing.map(row => ({
            actorUserId: job.actorUserId,
            action: "service.source.invalid",
            entityType: "service",
            entityId: String(row.id),
            summary:
              "Invalid source values; retained previous values and held publication",
            metadata: {
              jobId: job.id,
              before: {
                revision: row.revision,
                status: row.status,
                reviewStatus: row.reviewStatus,
                incomplete: row.incomplete,
                pricingConfirmed: row.pricingConfirmed,
                policyReviewed: row.policyReviewed,
                reviewReason: row.reviewReason,
                reviewedAt: row.reviewedAt,
                reviewedByUserId: row.reviewedByUserId,
              },
              after: {
                revision: row.revision + 1,
                status: row.status === "active" ? "draft" : row.status,
                reviewStatus: "changes_requested",
                incomplete: true,
                pricingConfirmed: false,
                policyReviewed: false,
                reviewedAt: null,
                reviewedByUserId: null,
                reviewReason:
                  "Invalid provider source values; inspect the quarantined source record in the connection's sync report",
              },
            },
          }))
        );
      await writeAudit(
        {
          actorUserId: job.actorUserId ?? undefined,
          action: "integration.services.quarantine",
          entityType: "provider",
          entityId: String(provider.id),
          summary: `Quarantined ${invalid.length} invalid source records`,
          metadata: {
            jobId: job.id,
            invalidCount: invalid.length,
            heldServices: existing.length,
          },
        },
        tx
      );
    }
    const processedCount = job.processedCount + staged.length;
    await tx
      .update(providerSyncJobs)
      .set({
        processedCount,
        reviewCount: job.reviewCount + result.reviewCount + invalid.length,
        priceChangeCount: job.priceChangeCount + result.priceChangeCount,
        status: processedCount === job.totalCount ? "reconciling" : "importing",
        leaseToken: null,
        leaseUntil: null,
      })
      .where(eq(providerSyncJobs.id, job.id));
  });
}

async function reconcileSnapshotBatch(claim: Job) {
  await withJob(claim, async (tx, job, provider, integration) => {
    if (job.processedCount !== job.totalCount || !job.totalCount)
      throw new SyncError(
        "Snapshot import is incomplete; removal checks were stopped"
      );
    // This indexed anti-join is only reached after EVERY staged service was committed.
    const missing = await tx
      .select({
        id: serviceRecords.id,
        status: serviceRecords.status,
        revision: serviceRecords.revision,
      })
      .from(serviceRecords)
      .where(
        and(
          eq(serviceRecords.providerId, provider.id),
          eq(serviceRecords.sourceKind, "provider_api"),
          eq(serviceRecords.sourceUrl, job.sourceUrl),
          eq(serviceRecords.available, true),
          isNotNull(serviceRecords.externalId),
          sql`not exists (select 1 from provider_sync_rows staged where staged.jobId = ${job.id} and staged.externalId = ${serviceRecords.externalId})`
        )
      )
      .orderBy(asc(serviceRecords.id))
      .limit(SYNC_BATCH_SIZE)
      .for("update");
    const now = new Date();
    for (const row of missing) {
      await tx
        .update(serviceRecords)
        .set({
          available: false,
          missingSourceAt: now,
          reviewStatus: "pending",
          incomplete: true,
          status: row.status === "active" ? "draft" : row.status,
          revision: row.revision + 1,
          reviewedAt: null,
          reviewedByUserId: null,
        })
        .where(eq(serviceRecords.id, row.id));
    }
    if (missing.length) {
      await tx.insert(auditEntries).values(
        missing.map(row => ({
          actorUserId: job.actorUserId,
          action: "service.source.missing",
          entityType: "service",
          entityId: String(row.id),
          summary: "Service no longer returned by its provider API",
          metadata: {
            jobId: job.id,
            reason: "Absent from complete validated API response",
            before: {
              available: true,
              status: row.status,
              revision: row.revision,
            },
            after: {
              available: false,
              status: row.status === "active" ? "draft" : row.status,
              revision: row.revision + 1,
            },
          },
        }))
      );
      await tx
        .update(providerSyncJobs)
        .set({
          missingCount: job.missingCount + missing.length,
          leaseToken: null,
          leaseUntil: null,
        })
        .where(eq(providerSyncJobs.id, job.id));
      return;
    }
    await tx
      .update(providerSyncJobs)
      .set({
        status: job.invalidCount ? "completed_with_issues" : "completed",
        activeProviderId: null,
        finishedAt: now,
        leaseToken: null,
        leaseUntil: null,
      })
      .where(eq(providerSyncJobs.id, job.id));
    await tx
      .update(providerIntegrations)
      .set({
        lastSyncedAt: now,
        consecutiveFailures: 0,
        lastError: null,
        syncLockUntil: null,
        nextSyncAt:
          integration.status === "active"
            ? new Date(Date.now() + integration.syncIntervalMinutes * 60_000)
            : null,
      })
      .where(eq(providerIntegrations.id, integration.id));
    await writeAudit(
      {
        actorUserId: job.actorUserId ?? undefined,
        action: "integration.services.sync",
        entityType: "provider",
        entityId: String(provider.id),
        summary: `Completed background synchronization: ${job.totalCount - job.invalidCount} imported, ${job.invalidCount} quarantined`,
        metadata: {
          jobId: job.id,
          importedCount: job.processedCount - job.invalidCount,
          invalidCount: job.invalidCount,
          reviewCount: job.reviewCount,
          priceChangeCount: job.priceChangeCount,
          missingCount: job.missingCount,
          scheduled: job.scheduled,
        },
      },
      tx
    );
  });
}

async function failJob(claim: Job, error: unknown) {
  if (error instanceof LostLease) return;
  // Never store SQL error parameters, upstream bodies or credential exceptions in the UI/audit log.
  const message =
    error instanceof SyncError || error instanceof CatalogueSourceConflict
      ? error.message
      : "Synchronization stopped because of a storage error; completed draft batches were preserved. Retry synchronization.";
  const db = await database();
  await db.transaction(async tx => {
    await tx
      .select({ id: providerRecords.id })
      .from(providerRecords)
      .where(eq(providerRecords.id, claim.providerId))
      .for("update");
    const [integration] = await tx
      .select()
      .from(providerIntegrations)
      .where(eq(providerIntegrations.id, claim.integrationId))
      .for("update");
    const [job] = await tx
      .select()
      .from(providerSyncJobs)
      .where(eq(providerSyncJobs.id, claim.id))
      .for("update");
    if (
      !integration ||
      !job ||
      !job.activeProviderId ||
      job.leaseToken !== claim.leaseToken
    )
      return;
    const failures = integration.consecutiveFailures + 1;
    await tx
      .update(providerSyncJobs)
      .set({
        status: "failed",
        activeProviderId: null,
        lastError: message,
        finishedAt: new Date(),
        leaseToken: null,
        leaseUntil: null,
      })
      .where(eq(providerSyncJobs.id, job.id));
    await tx
      .update(providerIntegrations)
      .set({
        consecutiveFailures: failures,
        lastError: message,
        syncLockUntil: null,
        nextSyncAt:
          integration.status === "active"
            ? new Date(
                Date.now() +
                  Math.min(integration.syncIntervalMinutes * failures, 1440) *
                    60_000
              )
            : null,
      })
      .where(eq(providerIntegrations.id, integration.id));
    await writeAudit(
      {
        actorUserId: job.actorUserId ?? undefined,
        action: "integration.schedule.failure",
        entityType: "provider_integration",
        entityId: String(integration.id),
        summary: "Provider synchronization failed",
        metadata: {
          jobId: job.id,
          error: message,
          processedCount: job.processedCount,
          consecutiveFailures: failures,
          scheduled: job.scheduled,
        },
      },
      tx
    );
  });
}

// Runs one bounded import/reconciliation step, or fetches and stages a bounded source snapshot.
// Leases and checkpoints survive browser closure, server restart and overlapping application instances.
export async function runProviderSyncStep() {
  const db = await database();
  const ready = and(
    inArray(providerSyncJobs.status, [...activeStatuses]),
    or(
      isNull(providerSyncJobs.leaseUntil),
      lte(providerSyncJobs.leaseUntil, new Date())
    )
  );
  const [candidate] = await db
    .select()
    .from(providerSyncJobs)
    .where(ready)
    .orderBy(asc(providerSyncJobs.id))
    .limit(1);
  if (!candidate) return false;
  const token = randomUUID();
  const [claimed] = await db
    .update(providerSyncJobs)
    .set({ leaseToken: token, leaseUntil: leaseDate() })
    .where(and(eq(providerSyncJobs.id, candidate.id), ready));
  if (claimed.affectedRows !== 1) return false;
  const [claim] = await db
    .select()
    .from(providerSyncJobs)
    .where(
      and(
        eq(providerSyncJobs.id, candidate.id),
        eq(providerSyncJobs.leaseToken, token)
      )
    )
    .limit(1);
  if (!claim) return false;
  try {
    if (claim.status === "queued" || claim.status === "preparing")
      await prepareSnapshot(claim);
    else if (claim.status === "importing") await importSnapshotBatch(claim);
    else await reconcileSnapshotBatch(claim);
  } catch (error) {
    await failJob(claim, error);
  }
  invalidateCatalogueCaches();
  return true;
}

export async function cleanupProviderSyncSnapshots() {
  const db = await database();
  const [job] = await db
    .select({ id: providerSyncJobs.id })
    .from(providerSyncJobs)
    .where(
      and(
        isNull(providerSyncJobs.activeProviderId),
        eq(providerSyncJobs.stagingCleared, false)
      )
    )
    .orderBy(asc(providerSyncJobs.id))
    .limit(1);
  if (!job) return;
  const [removed] = await db
    .delete(providerSyncRows)
    .where(
      and(
        eq(providerSyncRows.jobId, job.id),
        eq(providerSyncRows.invalid, false)
      )
    )
    .limit(1000);
  if (removed.affectedRows < 1000)
    await db
      .update(providerSyncJobs)
      .set({ stagingCleared: true })
      .where(eq(providerSyncJobs.id, job.id));
}

export async function listProviderSyncIssues(input: {
  jobId: number;
  cursor?: number;
}) {
  const db = await database();
  const [job] = await db
    .select({ invalidCount: providerSyncJobs.invalidCount })
    .from(providerSyncJobs)
    .where(eq(providerSyncJobs.id, input.jobId))
    .limit(1);
  if (!job) throw new Error("Synchronization job not found");
  const rows = await db
    .select({
      ordinal: providerSyncRows.ordinal,
      externalId: providerSyncRows.externalId,
      payload: providerSyncRows.payload,
    })
    .from(providerSyncRows)
    .where(
      and(
        eq(providerSyncRows.jobId, input.jobId),
        eq(providerSyncRows.invalid, true),
        gt(providerSyncRows.ordinal, input.cursor ?? 0)
      )
    )
    .orderBy(asc(providerSyncRows.ordinal))
    .limit(26);
  const items = rows.slice(0, 25).map(row => {
    const issue = row.payload as SourceIssue;
    const value = (key: string, limit = 80) =>
      issue.sourceData[key] == null
        ? null
        : String(issue.sourceData[key]).slice(0, limit);
    return {
      ordinal: row.ordinal,
      externalId: row.externalId,
      name: value("name", 300),
      rate: value("rate") ?? value("price"),
      min: value("min"),
      max: value("max"),
      problems: issue.problems,
    };
  });
  return {
    items,
    total: job.invalidCount,
    nextCursor: rows.length > 25 ? items.at(-1)!.ordinal : null,
  };
}

export function startProviderSyncWorker() {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const tick = async () => {
    if (stopped) return;
    let worked = false;
    try {
      worked = await runProviderSyncStep();
      await cleanupProviderSyncSnapshots();
    } catch {
      console.warn(
        "[Provider sync] Worker unavailable; pending checkpoints will be retried"
      );
    }
    if (!stopped) {
      timer = setTimeout(tick, worked ? 100 : 2000);
      timer.unref();
    }
  };
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
