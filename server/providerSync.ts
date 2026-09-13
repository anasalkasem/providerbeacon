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
import { normalizeApiService } from "./serviceNormalizer";
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
): Promise<NormalizedService[]> {
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
  const rows: NormalizedService[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < payload.length; index++) {
    let row: NormalizedService;
    try {
      row = normalizeApiService(payload[index], index);
    } catch {
      throw new SyncError(
        `Invalid ID, name, price or quantities at row ${index + 1} of ${payload.length}; no changes were applied`
      );
    }
    // MySQL uses case-insensitive external-ID comparisons; reject ambiguous identifiers before applying anything.
    const key = row.externalId.toLowerCase();
    if (seen.has(key))
      throw new SyncError(
        "Provider response contains duplicate service IDs; no changes were applied"
      );
    seen.add(key);
    rows.push(row);
    if (index % 50 === 49) await yieldTurn();
  }
  return rows;
}

async function prepareSnapshot(claim: Job) {
  const integration = await withJob(
    claim,
    async (tx, job, _provider, current) => {
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
  const rows = await fetchCatalogue(integration);
  const snapshotAt = new Date();
  for (let offset = 0; offset < rows.length; offset += SYNC_BATCH_SIZE) {
    await withJob(claim, async tx => {
      await tx
        .insert(providerSyncRows)
        .values(
          rows
            .slice(offset, offset + SYNC_BATCH_SIZE)
            .map((row, i) => ({
              jobId: claim.id,
              ordinal: offset + i + 1,
              externalId: row.externalId,
              payload: row,
            }))
        );
    });
    await yieldTurn();
  }
  await withJob(claim, async tx => {
    await tx
      .update(providerSyncJobs)
      .set({
        status: "importing",
        totalCount: rows.length,
        snapshotAt,
        leaseToken: null,
        leaseUntil: null,
      })
      .where(eq(providerSyncJobs.id, claim.id));
  });
}

async function importSnapshotBatch(claim: Job) {
  await withJob(claim, async (tx, job, provider) => {
    const staged = await tx
      .select({
        payload: providerSyncRows.payload,
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
    const result = await applyCatalogueBatch(tx, {
      provider,
      rows: staged.map(row => row.payload as NormalizedService),
      sourceUrl: job.sourceUrl,
      now: job.snapshotAt,
      actorUserId: job.actorUserId ?? undefined,
      jobId: job.id,
    });
    const processedCount = job.processedCount + result.importedCount;
    await tx
      .update(providerSyncJobs)
      .set({
        processedCount,
        reviewCount: job.reviewCount + result.reviewCount,
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
      await tx
        .insert(auditEntries)
        .values(
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
        status: "completed",
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
        summary: `Completed background synchronization of ${job.totalCount} services`,
        metadata: {
          jobId: job.id,
          importedCount: job.processedCount,
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
    error instanceof SyncError
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
    .where(eq(providerSyncRows.jobId, job.id))
    .limit(1000);
  if (removed.affectedRows < 1000)
    await db
      .update(providerSyncJobs)
      .set({ stagingCleared: true })
      .where(eq(providerSyncJobs.id, job.id));
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
