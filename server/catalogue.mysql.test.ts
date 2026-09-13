import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { eq } from "drizzle-orm";
import { auditEntries, providerIntegrations, providerRecords, serviceRecords, users } from "../drizzle/schema";

const state = vi.hoisted(() => ({ db: null as any }));
vi.mock("./db", () => ({ getDb: async () => state.db }));
vi.mock("node:dns/promises", () => ({ lookup: async () => [{ address: "93.184.216.34", family: 4 }] }));
import { getMarketplaceSnapshot, syncProviderServicesNow, updateProviderStatus, updateServiceRecord } from "./marketplaceDb";
import { runDueProviderSyncs, setProviderIntegrationEnabled, syncStoredIntegration } from "./vaultDb";
import { encryptValue } from "./security";

const testUrl = process.env.TEST_DATABASE_URL;
let pool: Pool; let actorId: number; let providerId: number;
const payload = [{ service: 100, name: "TikTok Views", category: "Views", rate: "1.00", min: "100", max: "1000" }];
const response = () => new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });

// Destructive fixture cleanup is allowed ONLY in this explicit, local test database.
describe.skipIf(!testUrl)("catalogue acceptance against MySQL", () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/providerbeacon_test") throw new Error("Refusing to use a non-local/non-test database");
    pool = createPool({ uri: testUrl, connectionLimit: 8, timezone: "Z" });
    state.db = drizzle(pool);
    await migrate(state.db, { migrationsFolder: "drizzle" });
    const inserted = await state.db.insert(users).values({ openId: "catalogue-test-owner", name: "Test owner" }).onDuplicateKeyUpdate({ set: { name: "Test owner" } }).$returningId();
    const [owner] = await state.db.select().from(users).where(eq(users.openId, "catalogue-test-owner"));
    actorId = owner.id;
  }, 30_000);
  beforeEach(async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("MARKETPLACE_DEMO_MODE", "false");
    vi.stubEnv("VAULT_MASTER_KEY", Buffer.alloc(32, 17).toString("base64url"));
    await state.db.delete(auditEntries);
    await state.db.delete(providerRecords);
    const inserted = await state.db.insert(providerRecords).values({ slug: "test-provider", name: "Test provider", initials: "TP", status: "active", verified: false }).$returningId();
    providerId = inserted[0].id;
    vi.stubGlobal("fetch", vi.fn(async () => response()));
  });
  afterEach(async () => {
    vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  });
  afterAll(async () => { if (pool) await pool.end(); });

  async function addService(status: "draft" | "active" | "paused" | "archived" = "active", owner = providerId) {
    const inserted = await state.db.insert(serviceRecords).values({ providerId: owner, externalId: "100", slug: `legacy-service-${owner}`, name: "TikTok Views", platform: "TikTok", category: "Views", pricePerThousandUsd: "1.0000", minOrder: 100, maxOrder: 1000, status }).$returningId();
    return inserted[0].id as number;
  }
  async function addIntegration(status: "active" | "disabled" = "disabled") {
    const inserted = await state.db.insert(providerIntegrations).values({ providerId, name: "Test connection", baseUrl: "https://provider.example/api/v2", status, nextSyncAt: status === "active" ? new Date(Date.now() - 60_000) : null }).$returningId();
    const id = inserted[0].id as number;
    const key = encryptValue("local-test-key-no-network", `provider-integration:${id}`);
    await state.db.update(providerIntegrations).set({ credentialCiphertext: key.ciphertext, credentialIv: key.iv, credentialTag: key.tag, credentialVersion: key.version }).where(eq(providerIntegrations.id, id));
    return id;
  }
  const sync = (actor = actorId) => syncProviderServicesNow({ providerId, baseUrl: "https://provider.example/api/v2", apiKey: "local-test-key-no-network", actorUserId: actor });

  it("suspending a provider removes its offers while leaving other providers visible", async () => {
    const [other] = await state.db.insert(providerRecords).values({ slug: "other-provider", name: "Other provider", initials: "OP", status: "active" }).$returningId();
    await addService(); await addService("active", other.id);
    await updateProviderStatus({ id: providerId, status: "suspended", actorUserId: actorId });
    const snapshot = await getMarketplaceSnapshot();
    expect(snapshot.providers.map(p => p.id)).toEqual([`provider-${other.id}`]);
    expect(snapshot.services.map(s => s.providerId)).toEqual([`provider-${other.id}`]);
  });
  it("keeps an empty catalogue empty after all providers are suspended", async () => {
    await updateProviderStatus({ id: providerId, status: "suspended", actorUserId: actorId });
    expect(await getMarketplaceSnapshot()).toEqual({ providers: [], services: [], source: "database" });
  });
  it("provides unique comparison IDs across identical provider-local IDs and no invented evidence", async () => {
    const [other] = await state.db.insert(providerRecords).values({ slug: "other-provider", name: "Other provider", initials: "OP", status: "active" }).$returningId();
    await addService(); await addService("active", other.id);
    const snapshot = await getMarketplaceSnapshot();
    expect(new Set(snapshot.services.map(service => service.id)).size).toBe(2);
    expect(snapshot.providers[0]).toMatchObject({ score: null, updatedMinutes: null, apiStatus: "unknown", rating: null });
  });
  it("publication never grants identity verification and records before/after values", async () => {
    await state.db.update(providerRecords).set({ status: "draft" }).where(eq(providerRecords.id, providerId));
    await updateProviderStatus({ id: providerId, status: "active", actorUserId: actorId });
    const [provider] = await state.db.select().from(providerRecords).where(eq(providerRecords.id, providerId));
    expect(provider.verified).toBe(false);
    const [entry] = await state.db.select().from(auditEntries);
    expect(entry.metadata).toMatchObject({ before: { status: "draft", verified: false }, after: { status: "active", verified: false } });
  });
  it("rolls back provider and service changes when their audit write fails", async () => {
    const id = await addService();
    // The audit actor foreign key forces a real SQL failure inside the transaction.
    const missingActorId = 2147483647;
    await expect(updateProviderStatus({ id: providerId, status: "suspended", actorUserId: missingActorId })).rejects.toThrow();
    await expect(updateServiceRecord({ id, pricePerThousandUsd: 2, actorUserId: missingActorId })).rejects.toThrow();
    const [provider] = await state.db.select().from(providerRecords).where(eq(providerRecords.id, providerId));
    const [service] = await state.db.select().from(serviceRecords).where(eq(serviceRecords.id, id));
    expect(provider.status).toBe("active"); expect(service.pricePerThousandUsd).toBe("1.0000");
  });
  it("a disabled manual test stays disabled and imports only drafts", async () => {
    const id = await addIntegration(); await syncStoredIntegration({ id, actorUserId: actorId });
    const [integration] = await state.db.select().from(providerIntegrations).where(eq(providerIntegrations.id, id));
    expect(integration.status).toBe("disabled"); expect(integration.nextSyncAt).toBeNull();
    const rows = await state.db.select().from(serviceRecords);
    expect(rows).toHaveLength(1); expect(rows[0].status).toBe("draft");
    expect((await getMarketplaceSnapshot()).services).toEqual([]);
    await updateServiceRecord({ id: rows[0].id, status: "active", actorUserId: actorId });
    expect((await getMarketplaceSnapshot()).services).toHaveLength(1);
  });
  it("keeps unchanged published offers active and sends changed prices back to review", async () => {
    const id = await addService(); await sync();
    let [row] = await state.db.select().from(serviceRecords).where(eq(serviceRecords.id, id));
    expect(row.status).toBe("active");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ ...payload[0], rate: "2.00" }]))));
    await sync();
    [row] = await state.db.select().from(serviceRecords).where(eq(serviceRecords.id, id));
    expect(row.status).toBe("draft"); expect(row.pricePerThousandUsd).toBe("2.0000");
    expect((await getMarketplaceSnapshot()).services).toEqual([]);
  });
  it.each(["paused", "archived"] as const)("respects an existing %s status during imports", async status => {
    const id = await addService(status); await sync();
    const [row] = await state.db.select().from(serviceRecords).where(eq(serviceRecords.id, id));
    expect(row.status).toBe(status);
  });
  it("rolls back an entire import when its audit cannot be written", async () => {
    await expect(sync(2147483647)).rejects.toThrow();
    expect(await state.db.select().from(serviceRecords)).toEqual([]);
  });
  it("does not re-enable a connection disabled while its fetch is in progress", async () => {
    const id = await addIntegration("active");
    let release!: () => void; let notifyStarted!: () => void;
    const started = new Promise<void>(resolve => { notifyStarted = resolve; });
    const pending = new Promise<void>(resolve => { release = resolve; });
    vi.stubGlobal("fetch", vi.fn(async () => { notifyStarted(); await pending; return response(); }));
    const job = syncStoredIntegration({ id, actorUserId: actorId });
    await started;
    try { await setProviderIntegrationEnabled({ id, enabled: false, actorUserId: actorId }); } finally { release(); }
    await job;
    const [integration] = await state.db.select().from(providerIntegrations).where(eq(providerIntegrations.id, id));
    expect(integration.status).toBe("disabled"); expect(integration.nextSyncAt).toBeNull();
  });
  it("claims a due connection once across concurrent scheduler workers", async () => {
    await addIntegration("active");
    await Promise.all([runDueProviderSyncs(), runDueProviderSyncs()]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects duplicate API IDs without partially importing the catalogue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([payload[0], payload[0]]))));
    await expect(sync()).rejects.toThrow("duplicate service IDs");
    expect(await state.db.select().from(serviceRecords)).toEqual([]);
  });
});
