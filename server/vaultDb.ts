import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { providerIntegrations, providerRecords, providerSyncJobs } from "../drizzle/schema";
import { getDb } from "./db";
import { assertPublicHttpsUrl, writeAudit } from "./marketplaceDb";
import { encryptValue } from "./security";

const MIN_INTERVAL_MINUTES = 60;
const MAX_INTERVAL_MINUTES = 7 * 24 * 60;
import { integrationFingerprint } from "./providerSync";

function credentialPurpose(integrationId: number) {
  return `provider-integration:${integrationId}`;
}

function safeInterval(value: number) {
  if (!Number.isInteger(value) || value < MIN_INTERVAL_MINUTES || value > MAX_INTERVAL_MINUTES) {
    throw new Error(`Sync interval must be between ${MIN_INTERVAL_MINUTES} and ${MAX_INTERVAL_MINUTES} minutes`);
  }
  return value;
}

export async function listProviderIntegrations() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ integration: providerIntegrations, providerName: providerRecords.name, job: { id: providerSyncJobs.id, status: providerSyncJobs.status, totalCount: providerSyncJobs.totalCount, processedCount: providerSyncJobs.processedCount, invalidCount: providerSyncJobs.invalidCount, reviewCount: providerSyncJobs.reviewCount, priceChangeCount: providerSyncJobs.priceChangeCount, missingCount: providerSyncJobs.missingCount, startedAt: providerSyncJobs.startedAt, finishedAt: providerSyncJobs.finishedAt, lastError: providerSyncJobs.lastError } })
    .from(providerIntegrations)
    .innerJoin(providerRecords, eq(providerIntegrations.providerId, providerRecords.id))
    .leftJoin(providerSyncJobs, and(eq(providerSyncJobs.integrationId, providerIntegrations.id), eq(providerSyncJobs.id, sql`(select max(recent.id) from provider_sync_jobs recent where recent.integrationId = ${providerIntegrations.id})`)))
    .orderBy(asc(providerRecords.name));
  return rows.map(({ integration, providerName, job }) => ({
    id: integration.id,
    providerId: integration.providerId,
    providerName,
    name: integration.name,
    baseUrl: integration.baseUrl,
    sourceCurrency: integration.sourceCurrency,
    status: integration.status,
    credentialConfigured: Boolean(integration.credentialCiphertext),
    credentialHint: integration.credentialReference?.startsWith("vault:v1:") ? `•••• ${integration.credentialReference.slice(-4)}` : null,
    syncIntervalMinutes: integration.syncIntervalMinutes,
    nextSyncAt: integration.nextSyncAt,
    lastSyncedAt: integration.lastSyncedAt,
    consecutiveFailures: integration.consecutiveFailures,
    lastError: integration.lastError,
    updatedAt: integration.updatedAt,
    latestJob: job?.id ? job : null,
  }));
}

export async function saveProviderIntegration(input: {
  id?: number;
  providerId: number;
  name: string;
  baseUrl: string;
  apiKey?: string;
  syncIntervalMinutes: number;
  enabled: boolean;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const endpoint = await assertPublicHttpsUrl(input.baseUrl);
  const interval = safeInterval(input.syncIntervalMinutes);
  const [before] = input.id ? await db.select().from(providerIntegrations).where(eq(providerIntegrations.id, input.id)).limit(1) : [];
  return db.transaction(async tx => {
    const providerIds = Array.from(new Set([input.providerId, ...(before ? [before.providerId] : [])])).sort((a, b) => a - b);
    const providers = await tx.select({ id: providerRecords.id, isReviewWorkspace: providerRecords.isReviewWorkspace }).from(providerRecords).where(inArray(providerRecords.id, providerIds)).orderBy(asc(providerRecords.id)).for("update");
    if (!providers.some(row => row.id === input.providerId)) throw new Error("Provider not found");
    if (providers.some(row => row.isReviewWorkspace)) throw new Error("Review workspaces cannot connect live provider APIs");
    let integrationId = input.id;
    if (integrationId) {
      const [existing] = await tx.select().from(providerIntegrations).where(eq(providerIntegrations.id, integrationId)).for("update");
      if (!existing) throw new Error("Integration not found");
      if (existing.providerId !== before?.providerId) throw new Error("Connection changed; reload before editing");
      const [running] = await tx.select({ id: providerSyncJobs.id }).from(providerSyncJobs).where(eq(providerSyncJobs.activeProviderId, existing.providerId)).limit(1);
      if (running) throw new Error("Wait for the current synchronization to finish before changing the connection");
      await tx.update(providerIntegrations).set({
        providerId: input.providerId, name: input.name.trim().slice(0, 160), baseUrl: endpoint.toString(),
        ...(input.apiKey || existing.baseUrl !== endpoint.toString() || existing.providerId !== input.providerId
          ? { sourceCurrency: null } : {}),
        status: input.enabled ? "active" : "disabled", syncIntervalMinutes: interval,
        nextSyncAt: input.enabled ? existing.nextSyncAt ?? new Date() : null, lastError: null,
      }).where(eq(providerIntegrations.id, integrationId));
    } else {
      if (!input.apiKey) throw new Error("API key is required for a new integration");
      const [inserted] = await tx.insert(providerIntegrations).values({
        providerId: input.providerId, name: input.name.trim().slice(0, 160), baseUrl: endpoint.toString(),
        status: input.enabled ? "active" : "disabled", syncIntervalMinutes: interval,
        nextSyncAt: input.enabled ? new Date() : null, credentialReference: "vault:pending",
      }).$returningId();
      integrationId = inserted!.id;
    }
    if (input.apiKey) {
      const encrypted = encryptValue(input.apiKey, credentialPurpose(integrationId));
      await tx.update(providerIntegrations).set({ credentialCiphertext: encrypted.ciphertext, credentialIv: encrypted.iv, credentialTag: encrypted.tag,
        credentialVersion: encrypted.version, credentialReference: `vault:v1:${input.apiKey.slice(-4)}`,
      }).where(eq(providerIntegrations.id, integrationId));
    }
    await writeAudit({ actorUserId: input.actorUserId, action: input.id ? "integration.vault.update" : "integration.vault.create", entityType: "provider_integration", entityId: String(integrationId),
      summary: `${input.id ? "Updated" : "Created"} encrypted provider integration`, metadata: { providerId: input.providerId, host: endpoint.host, enabled: input.enabled, intervalMinutes: interval, credentialRotated: Boolean(input.apiKey) },
    }, tx);
    return { success: true, id: integrationId };
  });
}

export async function setProviderIntegrationEnabled(input: { id: number; enabled: boolean; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(providerIntegrations).set({
    status: input.enabled ? "active" : "disabled",
    nextSyncAt: input.enabled ? new Date() : null,
    syncLockUntil: null,
    lastError: null,
  }).where(eq(providerIntegrations.id, input.id));
  await writeAudit({ actorUserId: input.actorUserId, action: "integration.schedule.toggle", entityType: "provider_integration", entityId: String(input.id), summary: `${input.enabled ? "Enabled" : "Disabled"} scheduled synchronization` });
  return { success: true };
}

export async function deleteProviderIntegration(input: { id: number; actorUserId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const [before] = await db.select().from(providerIntegrations).where(eq(providerIntegrations.id, input.id)).limit(1);
  if (!before) throw new Error("Integration not found");
  return db.transaction(async tx => {
    await tx.select({ id: providerRecords.id }).from(providerRecords).where(eq(providerRecords.id, before.providerId)).for("update");
    const [integration] = await tx.select().from(providerIntegrations).where(eq(providerIntegrations.id, input.id)).for("update");
    if (!integration) throw new Error("Integration not found");
    if (integration.providerId !== before.providerId) throw new Error("Connection changed; reload before deleting");
    if (integration.status === "active") throw new Error("Disable scheduled synchronization before deleting this integration");
    const [running] = await tx.select({ id: providerSyncJobs.id }).from(providerSyncJobs).where(eq(providerSyncJobs.activeProviderId, integration.providerId)).limit(1);
    if (running) throw new Error("Wait for the current synchronization to finish before deleting the connection");
    await tx.delete(providerIntegrations).where(eq(providerIntegrations.id, input.id));
    await writeAudit({ actorUserId: input.actorUserId, action: "integration.vault.delete", entityType: "provider_integration", entityId: String(input.id), summary: `Deleted disabled provider integration ${integration.name}`, metadata: { providerId: integration.providerId, host: new URL(integration.baseUrl).host } }, tx);
    return { success: true };
  });
}

// The HTTP request only enqueues work. The durable worker reads the vault server-side.
export async function syncStoredIntegration(input: { id: number; actorUserId?: number; scheduled?: boolean }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const [before] = await db.select().from(providerIntegrations).where(eq(providerIntegrations.id, input.id)).limit(1);
  if (!before) throw new Error("Integration not found");
  return db.transaction(async tx => {
    const [provider] = await tx.select().from(providerRecords).where(eq(providerRecords.id, before.providerId)).for("update");
    const [integration] = await tx.select().from(providerIntegrations).where(eq(providerIntegrations.id, input.id)).for("update");
    if (!integration || integration.providerId !== before.providerId) throw new Error("Connection changed; reload before synchronizing");
    if (!provider || provider.status === "suspended") throw new Error("Provider is unavailable or suspended");
    if (input.scheduled && (integration.status !== "active" || !integration.nextSyncAt || integration.nextSyncAt.getTime() > Date.now())) return { skipped: true as const };
    const [running] = await tx.select({ id: providerSyncJobs.id, integrationId: providerSyncJobs.integrationId }).from(providerSyncJobs).where(eq(providerSyncJobs.activeProviderId, provider.id)).limit(1);
    if (running) {
      if (running.integrationId !== integration.id) throw new Error("This provider is already synchronizing through another connection");
      return { queued: true as const, jobId: running.id, alreadyQueued: true };
    }
    const endpoint = new URL(integration.baseUrl);
    const [job] = await tx.insert(providerSyncJobs).values({ integrationId: integration.id, providerId: provider.id, activeProviderId: provider.id, actorUserId: input.actorUserId,
      scheduled: Boolean(input.scheduled), configFingerprint: integrationFingerprint(integration), sourceUrl: `${endpoint.origin}${endpoint.pathname}`,
    }).$returningId();
    await tx.update(providerIntegrations).set({ nextSyncAt: integration.status === "active" ? new Date(Date.now() + integration.syncIntervalMinutes * 60_000) : null, syncLockUntil: null }).where(eq(providerIntegrations.id, integration.id));
    await writeAudit({ actorUserId: input.actorUserId, action: "integration.schedule.queued", entityType: "provider_integration", entityId: String(integration.id), summary: "Queued background catalogue synchronization", metadata: { jobId: job!.id, scheduled: Boolean(input.scheduled) } }, tx);
    return { queued: true as const, jobId: job!.id, alreadyQueued: false };
  });
}

export async function runDueProviderSyncs(limit = 10) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const due = await db.select({ id: providerIntegrations.id }).from(providerIntegrations).where(and(eq(providerIntegrations.status, "active"), lte(providerIntegrations.nextSyncAt, new Date())))
    .orderBy(asc(providerIntegrations.nextSyncAt)).limit(Math.max(1, Math.min(limit, 25)));
  const results: Array<{ id: number; ok: boolean; jobId?: number; skipped?: boolean }> = [];
  for (const integration of due) {
    try {
      const result = await syncStoredIntegration({ id: integration.id, scheduled: true });
      results.push({ id: integration.id, ok: true, jobId: "jobId" in result ? result.jobId : undefined, skipped: "skipped" in result });
    } catch { results.push({ id: integration.id, ok: false }); }
  }
  return { checkedAt: new Date().toISOString(), due: due.length, results };
}
