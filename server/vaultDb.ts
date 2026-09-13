import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { providerIntegrations, providerRecords } from "../drizzle/schema";
import { getDb } from "./db";
import { assertPublicHttpsUrl, syncProviderServicesNow, writeAudit } from "./marketplaceDb";
import { decryptValue, encryptValue } from "./security";

const MIN_INTERVAL_MINUTES = 60;
const MAX_INTERVAL_MINUTES = 7 * 24 * 60;
const LOCK_MINUTES = 20;

function credentialPurpose(integrationId: number) {
  return `provider-integration:${integrationId}`;
}

function safeInterval(value: number) {
  if (!Number.isInteger(value) || value < MIN_INTERVAL_MINUTES || value > MAX_INTERVAL_MINUTES) {
    throw new Error(`Sync interval must be between ${MIN_INTERVAL_MINUTES} and ${MAX_INTERVAL_MINUTES} minutes`);
  }
  return value;
}

function encryptedCredential(row: typeof providerIntegrations.$inferSelect) {
  if (!row.credentialCiphertext || !row.credentialIv || !row.credentialTag) throw new Error("Provider credential is not configured");
  return decryptValue({
    ciphertext: row.credentialCiphertext,
    iv: row.credentialIv,
    tag: row.credentialTag,
    version: row.credentialVersion,
  }, credentialPurpose(row.id));
}

export async function listProviderIntegrations() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ integration: providerIntegrations, providerName: providerRecords.name })
    .from(providerIntegrations)
    .innerJoin(providerRecords, eq(providerIntegrations.providerId, providerRecords.id))
    .orderBy(asc(providerRecords.name));
  return rows.map(({ integration, providerName }) => ({
    id: integration.id,
    providerId: integration.providerId,
    providerName,
    name: integration.name,
    baseUrl: integration.baseUrl,
    status: integration.status,
    credentialConfigured: Boolean(integration.credentialCiphertext),
    credentialHint: integration.credentialReference?.startsWith("vault:v1:") ? `•••• ${integration.credentialReference.slice(-4)}` : null,
    syncIntervalMinutes: integration.syncIntervalMinutes,
    nextSyncAt: integration.nextSyncAt,
    lastSyncedAt: integration.lastSyncedAt,
    consecutiveFailures: integration.consecutiveFailures,
    lastError: integration.lastError,
    updatedAt: integration.updatedAt,
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
  const [provider] = await db.select({ id: providerRecords.id }).from(providerRecords).where(eq(providerRecords.id, input.providerId)).limit(1);
  if (!provider) throw new Error("Provider not found");

  let integrationId = input.id;
  if (integrationId) {
    const [existing] = await db.select().from(providerIntegrations).where(eq(providerIntegrations.id, integrationId)).limit(1);
    if (!existing) throw new Error("Integration not found");
    await db.update(providerIntegrations).set({
      providerId: input.providerId,
      name: input.name.trim().slice(0, 160),
      baseUrl: endpoint.toString(),
      status: input.enabled ? "active" : "disabled",
      syncIntervalMinutes: interval,
      nextSyncAt: input.enabled ? existing.nextSyncAt ?? new Date() : null,
      lastError: null,
    }).where(eq(providerIntegrations.id, integrationId));
  } else {
    if (!input.apiKey) throw new Error("API key is required for a new integration");
    const inserted = await db.insert(providerIntegrations).values({
      providerId: input.providerId,
      name: input.name.trim().slice(0, 160),
      baseUrl: endpoint.toString(),
      status: input.enabled ? "active" : "disabled",
      syncIntervalMinutes: interval,
      nextSyncAt: input.enabled ? new Date() : null,
      credentialReference: "vault:pending",
    }).$returningId();
    integrationId = inserted[0]!.id;
  }

  if (input.apiKey) {
    const encrypted = encryptValue(input.apiKey, credentialPurpose(integrationId));
    await db.update(providerIntegrations).set({
      credentialCiphertext: encrypted.ciphertext,
      credentialIv: encrypted.iv,
      credentialTag: encrypted.tag,
      credentialVersion: encrypted.version,
      credentialReference: `vault:v1:${input.apiKey.slice(-4)}`,
    }).where(eq(providerIntegrations.id, integrationId));
  }

  await writeAudit({
    actorUserId: input.actorUserId,
    action: input.id ? "integration.vault.update" : "integration.vault.create",
    entityType: "provider_integration",
    entityId: String(integrationId),
    summary: `${input.id ? "Updated" : "Created"} encrypted provider integration`,
    metadata: { providerId: input.providerId, host: endpoint.host, enabled: input.enabled, intervalMinutes: interval, credentialRotated: Boolean(input.apiKey) },
  });
  return { success: true, id: integrationId };
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
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [integration] = await db.select().from(providerIntegrations).where(eq(providerIntegrations.id, input.id)).limit(1);
  if (!integration) throw new Error("Integration not found");
  if (integration.status === "active") throw new Error("Disable scheduled synchronization before deleting this integration");
  await db.delete(providerIntegrations).where(eq(providerIntegrations.id, input.id));
  await writeAudit({
    actorUserId: input.actorUserId,
    action: "integration.vault.delete",
    entityType: "provider_integration",
    entityId: String(input.id),
    summary: `Deleted disabled provider integration ${integration.name}`,
    metadata: { providerId: integration.providerId, host: new URL(integration.baseUrl).host },
  });
  return { success: true };
}

export async function syncStoredIntegration(input: { id: number; actorUserId?: number; scheduled?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [integration] = await db.select().from(providerIntegrations).where(eq(providerIntegrations.id, input.id)).limit(1);
  if (!integration) throw new Error("Integration not found");
  if (input.scheduled && integration.status !== "active") return { skipped: true, reason: "disabled" as const };
  const apiKey = encryptedCredential(integration);
  const nextSyncAt = new Date(Date.now() + integration.syncIntervalMinutes * 60_000);
  try {
    const result = await syncProviderServicesNow({ providerId: integration.providerId, baseUrl: integration.baseUrl, apiKey, actorUserId: input.actorUserId });
    await db.update(providerIntegrations).set({
      lastSyncedAt: new Date(),
      nextSyncAt: sql`CASE WHEN ${providerIntegrations.status} = 'active' THEN ${nextSyncAt.toISOString().slice(0, 19).replace("T", " ")} ELSE NULL END`,
      syncLockUntil: null,
      consecutiveFailures: 0,
      lastError: null,
    }).where(eq(providerIntegrations.id, integration.id));
    await writeAudit({ actorUserId: input.actorUserId, action: input.scheduled ? "integration.schedule.success" : "integration.vault.sync", entityType: "provider_integration", entityId: String(integration.id), summary: `Imported ${result.importedCount} services using an encrypted credential`, metadata: { scheduled: Boolean(input.scheduled), importedCount: result.importedCount } });
    return { ...result, integrationId: integration.id };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1500) : "Provider synchronization failed";
    const failures = integration.consecutiveFailures + 1;
    await db.update(providerIntegrations).set({
      nextSyncAt: sql`CASE WHEN ${providerIntegrations.status} = 'active' THEN ${new Date(Date.now() + Math.min(integration.syncIntervalMinutes * Math.max(1, failures), 24 * 60) * 60_000).toISOString().slice(0, 19).replace("T", " ")} ELSE NULL END`,
      syncLockUntil: null,
      consecutiveFailures: failures,
      lastError: message,
    }).where(eq(providerIntegrations.id, integration.id));
    await writeAudit({ actorUserId: input.actorUserId, action: "integration.schedule.failure", entityType: "provider_integration", entityId: String(integration.id), summary: "Provider synchronization failed", metadata: { scheduled: Boolean(input.scheduled), error: message, consecutiveFailures: failures } });
    throw error;
  }
}

export async function runDueProviderSyncs(limit = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = new Date();
  const due = await db.select().from(providerIntegrations).where(and(
    eq(providerIntegrations.status, "active"),
    lte(providerIntegrations.nextSyncAt, now),
    or(isNull(providerIntegrations.syncLockUntil), lte(providerIntegrations.syncLockUntil, now)),
  )).orderBy(asc(providerIntegrations.nextSyncAt)).limit(Math.max(1, Math.min(limit, 25)));
  const results: Array<{ id: number; ok: boolean; importedCount?: number; error?: string }> = [];
  for (const integration of due) {
    const [claim] = await db.update(providerIntegrations).set({ syncLockUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }).where(and(
      eq(providerIntegrations.id, integration.id),
      eq(providerIntegrations.status, "active"),
      lte(providerIntegrations.nextSyncAt, now),
      or(isNull(providerIntegrations.syncLockUntil), lte(providerIntegrations.syncLockUntil, now)),
    ));
    if (claim.affectedRows !== 1) continue;
    try {
      const result = await syncStoredIntegration({ id: integration.id, scheduled: true });
      results.push({ id: integration.id, ok: true, importedCount: "importedCount" in result ? result.importedCount : 0 });
    } catch (error) {
      results.push({ id: integration.id, ok: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return { checkedAt: new Date().toISOString(), due: due.length, results };
}
