import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { eq, sql } from "drizzle-orm";
import { auditEntries, priceSnapshots, providerIntegrations, providerRecords, providerSyncJobs, providerSyncRows, serviceRecords, users } from "../drizzle/schema";

const state = vi.hoisted(() => ({ db: null as any }));
vi.mock("./db", () => ({ getDb: async () => state.db }));
vi.mock("node:dns/promises", () => ({ lookup: async () => [{ address: "93.184.216.34", family: 4 }] }));
import { getMarketplaceSnapshot, updateProviderStatus, updateServiceRecord } from "./marketplaceDb";
import { deleteProviderIntegration, listProviderIntegrations, runDueProviderSyncs, saveProviderIntegration, setProviderIntegrationEnabled, syncStoredIntegration } from "./vaultDb";
import { cleanupProviderSyncSnapshots, listProviderSyncIssues, runProviderSyncStep } from "./providerSync";
import { getAdminOverview, getServiceReviewSummary, listAdminServices, listSyncAlerts } from "./adminCatalogueDb";
import { reviewNeeds, type ReviewNeed } from "../shared/serviceReview";
import { rolePermissions } from "./authorization";
import { encryptValue } from "./security";
import { applyServiceReview, editServiceReview, getServiceReview, normalizeLegacyBatch } from "./serviceReviewDb";

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
    const inserted = await state.db.insert(serviceRecords).values({ providerId: owner, externalId: "100", slug: `legacy-service-${owner}`, name: "TikTok Views", platform: "TikTok", category: "Views", pricePerThousandUsd: "1.0000", minOrder: 100, maxOrder: 1000, status, reviewStatus: "approved", incomplete: false, normalizationVersion: 1, pricingConfirmed: true, policyReviewed: true, evidenceUrl: "https://provider.example/services", sourceUpdatedAt: new Date() }).$returningId();
    return inserted[0].id as number;
  }
  async function addIntegration(status: "active" | "disabled" = "disabled") {
    const inserted = await state.db.insert(providerIntegrations).values({ providerId, name: "Test connection", baseUrl: "https://provider.example/api/v2", status, nextSyncAt: status === "active" ? new Date(Date.now() - 60_000) : null }).$returningId();
    const id = inserted[0].id as number;
    const key = encryptValue("local-test-key-no-network", `provider-integration:${id}`);
    await state.db.update(providerIntegrations).set({ credentialCiphertext: key.ciphertext, credentialIv: key.iv, credentialTag: key.tag, credentialVersion: key.version }).where(eq(providerIntegrations.id, id));
    return id;
  }
  async function finishJob(jobId: number) {
    for (let step = 0; step < 1200; step++) {
      const [job] = await state.db.select().from(providerSyncJobs).where(eq(providerSyncJobs.id, jobId));
      if (job.status === "failed") throw new Error(job.lastError);
      if (job.status === "completed" || job.status === "completed_with_issues") return { ...job, importedCount: job.processedCount - job.invalidCount };
      await runProviderSyncStep();
    }
    throw new Error("Test job did not complete");
  }
  async function sync(actor = actorId) {
    const [connection] = await state.db.select({ id: providerIntegrations.id }).from(providerIntegrations).where(eq(providerIntegrations.providerId, providerId)).limit(1);
    const id = connection?.id ?? await addIntegration();
    const queued = await syncStoredIntegration({ id, actorUserId: actor });
    if (!("jobId" in queued)) throw new Error("Expected a queued job");
    return finishJob(queued.jobId);
  }

  async function prepareAndPublish(id: number) {
    const detail = await getServiceReview(id);
    const edited = await editServiceReview({ id, revision: detail.service.revision, platform: "TikTok", category: "Views", countryCode: null,
      price: Number(detail.service.pricePerThousandUsd), minOrder: 100, maxOrder: 1000, refillMode: "unknown", refillDays: null,
      evidenceUrl: "https://provider.example/services", pricingConfirmed: true, policyReviewed: true, reason: "Test fixture source and eligibility checked", actorUserId: actorId });
    await applyServiceReview({ items: [{ id, revision: edited.revision }], action: "approve", reason: "Test fixture review complete", actorUserId: actorId });
    await applyServiceReview({ items: [{ id, revision: edited.revision + 1 }], action: "publish", reason: "Test fixture publication", actorUserId: actorId });
  }

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
    expect(await getMarketplaceSnapshot()).toEqual({ providers: [], services: [], source: "database", pagination: { total: 0, nextCursor: null } });
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
    const id = await addIntegration(); await sync();
    const [integration] = await state.db.select().from(providerIntegrations).where(eq(providerIntegrations.id, id));
    expect(integration.status).toBe("disabled"); expect(integration.nextSyncAt).toBeNull();
    const rows = await state.db.select().from(serviceRecords);
    expect(rows).toHaveLength(1); expect(rows[0].status).toBe("draft");
    expect((await getMarketplaceSnapshot()).services).toEqual([]);
    await expect(updateServiceRecord({ id: rows[0].id, status: "active", actorUserId: actorId })).rejects.toThrow("review and publication");
    await prepareAndPublish(rows[0].id);
    expect((await getMarketplaceSnapshot()).services).toHaveLength(1);
  });
  it("keeps unchanged published offers active and sends changed prices back to review", async () => {
    await sync();
    const [created] = await state.db.select().from(serviceRecords);
    const id = created.id; await prepareAndPublish(id); await sync();
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
  it("does not enqueue import work when its audit actor is invalid", async () => {
    await expect(sync(2147483647)).rejects.toThrow();
    expect(await state.db.select().from(serviceRecords)).toEqual([]);
  });
  it("does not re-enable a connection disabled while its fetch is in progress", async () => {
    const id = await addIntegration("active");
    let release!: () => void; let notifyStarted!: () => void;
    const started = new Promise<void>(resolve => { notifyStarted = resolve; });
    const pending = new Promise<void>(resolve => { release = resolve; });
    vi.stubGlobal("fetch", vi.fn(async () => { notifyStarted(); await pending; return response(); }));
    const queued = await syncStoredIntegration({ id, actorUserId: actorId });
    const preparation = runProviderSyncStep();
    await started;
    try { await setProviderIntegrationEnabled({ id, enabled: false, actorUserId: actorId }); } finally { release(); }
    await preparation;
    await finishJob(queued.jobId!);
    const [integration] = await state.db.select().from(providerIntegrations).where(eq(providerIntegrations.id, id));
    expect(integration.status).toBe("disabled"); expect(integration.nextSyncAt).toBeNull();
  });
  it("claims a due connection once across concurrent scheduler workers", async () => {
    await addIntegration("active");
    await Promise.all([runDueProviderSyncs(), runDueProviderSyncs()]);
    expect(fetch).not.toHaveBeenCalled();
    const jobs = await state.db.select().from(providerSyncJobs); expect(jobs).toHaveLength(1);
    await finishJob(jobs[0].id);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("matches existing provider IDs consistently with case-insensitive database comparisons", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ ...payload[0], service: "API-SERVICE" }]))));
    await sync();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ ...payload[0], service: "api-service" }]))));
    await sync();
    expect(await state.db.select().from(serviceRecords)).toHaveLength(1);
    expect(await state.db.select().from(priceSnapshots)).toHaveLength(1);
  });
  it("rejects duplicate API IDs without partially importing the catalogue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([payload[0], payload[0]]))));
    await expect(sync()).rejects.toThrow("duplicate service IDs");
    expect(await state.db.select().from(serviceRecords)).toEqual([]);
  });
  it("preserves original legacy data and freshness while normalizing in bounded idempotent batches", async () => {
    const id = await addService();
    const oldDate = new Date("2020-01-01T00:00:00Z");
    await state.db.update(serviceRecords).set({ name: "🇻🇳 VIETNAM Website Traffic [FB, IG, YT, Tiktok]", platform: "🇻🇳", category: "Traffic", normalizationVersion: 0, sourceUpdatedAt: oldDate }).where(eq(serviceRecords.id, id));
    expect(await normalizeLegacyBatch(1)).toBe(1); expect(await normalizeLegacyBatch(1)).toBe(0);
    const detail = await getServiceReview(id);
    expect(detail.service).toMatchObject({ platform: "Website", category: "Website traffic", countryCode: "VN", reviewStatus: "pending", status: "draft", normalizationVersion: 1, sourceKind: "legacy", sourceUpdatedAt: oldDate });
    expect(detail.service.originalSourceData?.legacyPlatform).toBe("🇻🇳");
  });
  it("blocks incomplete approval and prevents stale review decisions from overwriting newer edits", async () => {
    await sync(); const [row] = await state.db.select().from(serviceRecords);
    await expect(applyServiceReview({ items: [{ id: row.id, revision: row.revision }], action: "approve", reason: "Attempt without evidence", actorUserId: actorId })).rejects.toMatchObject({ message: "review_not_ready" });
    await applyServiceReview({ items: [{ id: row.id, revision: row.revision }], action: "request_changes", reason: "Missing currency and eligibility evidence", actorUserId: actorId, ipAddress: "127.0.0.1" });
    await expect(applyServiceReview({ items: [{ id: row.id, revision: row.revision }], action: "approve", reason: "Obsolete review decision", actorUserId: actorId })).rejects.toMatchObject({ message: "review_conflict" });
    const after = await getServiceReview(row.id); expect(after.service.reviewStatus).toBe("changes_requested");
    const logs = await state.db.select().from(auditEntries).where(eq(auditEntries.action, "service.review.request_changes"));
    expect(logs[0].metadata).toMatchObject({ reason: "Missing currency and eligibility evidence", before: { revision: 1 }, after: { revision: 2 } });
    expect(logs[0].ipAddress).toBe("127.0.0.1");
  });
  it("rolls back the whole review batch if any revision conflicts or its audit fails", async () => {
    const id = await addService();
    await expect(applyServiceReview({ items: [{ id, revision: 1 }, { id: 2147483647, revision: 1 }], action: "request_changes", reason: "Atomic batch review", actorUserId: actorId })).rejects.toMatchObject({ message: "review_conflict" });
    await expect(applyServiceReview({ items: [{ id, revision: 1 }], action: "request_changes", reason: "Missing audit actor", actorUserId: 2147483647 })).rejects.toThrow();
    expect((await getServiceReview(id)).service).toMatchObject({ revision: 1, reviewStatus: "approved" });
  });
  it("stores prices only on initial import or price changes and holds disappeared services", async () => {
    await sync(); await sync();
    expect(await state.db.select().from(priceSnapshots)).toHaveLength(1);
    const [first] = await state.db.select().from(serviceRecords); await prepareAndPublish(first.id);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ ...payload[0], service: 200 }]))));
    const result = await sync(); expect(result.missingCount).toBe(1);
    expect((await getServiceReview(first.id)).service).toMatchObject({ available: false, reviewStatus: "pending", status: "draft" });
    expect((await getMarketplaceSnapshot()).services).toHaveLength(0);
    vi.stubGlobal("fetch", vi.fn(async () => response())); await sync();
    expect((await getServiceReview(first.id)).service).toMatchObject({ available: true, reviewStatus: "pending", pricingConfirmed: false });
    expect(await state.db.select().from(priceSnapshots)).toHaveLength(2);
  });
  it("preserves the catalogue for empty responses or invalid service identities", async () => {
    await sync(); const [row] = await state.db.select().from(serviceRecords);
    for (const data of [[], [payload[0], { ...payload[0], service: null }]]) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(data)))); await expect(sync()).rejects.toThrow();
      expect((await getServiceReview(row.id)).service).toMatchObject({ available: true, revision: 1 });
      expect(await state.db.select().from(serviceRecords)).toHaveLength(1);
    }
  });
  it("requires current approval and a published provider before publication", async () => {
    await sync(); const [row] = await state.db.select().from(serviceRecords);
    await expect(applyServiceReview({ items: [{ id: row.id, revision: 1 }], action: "publish", reason: "Attempt premature publication", actorUserId: actorId })).rejects.toMatchObject({ message: "review_not_ready" });
    await prepareAndPublish(row.id);
    await state.db.update(providerRecords).set({ status: "draft" }).where(eq(providerRecords.id, providerId));
    const detail = await getServiceReview(row.id);
    await expect(applyServiceReview({ items: [{ id: row.id, revision: detail.service.revision }], action: "publish", reason: "Attempt provider draft publication", actorUserId: actorId })).rejects.toMatchObject({ message: "review_not_ready" });
    expect((await listAdminServices({ view: "published" })).total).toBe(0);
    expect((await listAdminServices({ view: "approved" })).total).toBe(1);
  });
  it("surfaces credential failures as connection alerts without disclosing a key", async () => {
    const [connection] = await state.db.insert(providerIntegrations).values({ providerId, name: "Unconfigured connection", baseUrl: "https://provider.example/api/v2", status: "disabled" }).$returningId();
    const queued = await syncStoredIntegration({ id: connection.id, actorUserId: actorId });
    await expect(finishJob(queued.jobId!)).rejects.toThrow("credential is not configured");
    const alerts = await listSyncAlerts(); expect(alerts.total).toBe(1);
    expect(alerts.items[0]).toMatchObject({ id: connection.id, failures: 1, status: "disabled" });
    expect(JSON.stringify(alerts)).not.toContain("credentialCiphertext");
  });
  it("keeps quarantine alerts through queued and importing retries until a clean snapshot completes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([payload[0], { ...payload[0], service: 200, rate: "375000.00" }]))));
    const original = await sync();
    const [connection] = await state.db.select().from(providerIntegrations);
    const first = await listSyncAlerts();
    expect(first.total).toBe(1);
    expect(first.items[0]).toMatchObject({ id: connection.id, status: "disabled", hasFailure: false, isOverdue: false,
      sourceIssues: { jobId: original.id, count: 1 } });
    await cleanupProviderSyncSnapshots();
    const report = await listProviderSyncIssues({ jobId: first.items[0].sourceIssues!.jobId });
    expect(report.items[0]).toMatchObject({ externalId: "200", rate: "375000.00", problems: ["invalid_price"] });
    expect(JSON.stringify(first)).not.toMatch(/credential|configFingerprint|sourceData|payload|local-test-key/);

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([payload[0], { ...payload[0], service: 200 }]))));
    const retry = await syncStoredIntegration({ id: connection.id, actorUserId: actorId });
    expect((await listSyncAlerts()).items[0].sourceIssues?.jobId).toBe(original.id);
    await runProviderSyncStep(); // The clean snapshot is staged but not yet applied.
    expect((await listSyncAlerts()).items[0].sourceIssues?.jobId).toBe(original.id);
    await finishJob(retry.jobId!);
    expect(await listSyncAlerts()).toEqual({ total: 0, items: [] });
    // Clearing a current alert does not delete its historical evidence.
    expect((await listProviderSyncIssues({ jobId: original.id })).items).toHaveLength(1);
  });
  it("shows source issues and a later connection failure together without duplicating the connection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([payload[0], { ...payload[0], service: 200, min: "invalid" }]))));
    const original = await sync();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream-private-details", { status: 503 })));
    await expect(sync()).rejects.toThrow();
    const alerts = await listSyncAlerts();
    expect(alerts.total).toBe(1); expect(alerts.items).toHaveLength(1);
    expect(alerts.items[0]).toMatchObject({ hasFailure: true, failures: 1, isOverdue: false, sourceIssues: { jobId: original.id, count: 1 } });
    expect(JSON.stringify(alerts)).not.toContain("upstream-private-details");
  });
  it("does not attach an old provider or endpoint's source issues to an edited connection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([payload[0], { ...payload[0], service: 200, rate: "0" }]))));
    await sync();
    const [connection] = await state.db.select().from(providerIntegrations);
    const [other] = await state.db.insert(providerRecords).values({ slug: "new-source-owner", name: "New source owner", initials: "NS", status: "draft" }).$returningId();
    const edit = { id: connection.id, name: "Edited connection", apiKey: "another-test-key", syncIntervalMinutes: 360, enabled: false, actorUserId: actorId };
    await saveProviderIntegration({ ...edit, providerId: other.id, baseUrl: connection.baseUrl });
    expect((await listSyncAlerts()).total).toBe(0);
    await saveProviderIntegration({ ...edit, providerId, baseUrl: "https://provider.example/another-api" });
    expect((await listSyncAlerts()).total).toBe(0);
    await saveProviderIntegration({ ...edit, providerId, baseUrl: connection.baseUrl });
    expect((await listSyncAlerts()).items[0].sourceIssues?.count).toBe(1);
  });
  it("bounds connection alerts to 50 and distinguishes an error status from overdue scheduling", async () => {
    await state.db.insert(providerIntegrations).values(Array.from({ length: 51 }, (_, i) => ({
      providerId, name: `Failed connection ${i}`, baseUrl: "https://provider.example/api/v2", status: "error", consecutiveFailures: 0,
    })));
    const overdue = await addIntegration("active");
    await state.db.update(providerIntegrations).set({ nextSyncAt: new Date(Date.now() - 7200000), updatedAt: new Date(Date.now() + 1000) }).where(eq(providerIntegrations.id, overdue));
    const alerts = await listSyncAlerts();
    expect(alerts.total).toBe(52); expect(alerts.items).toHaveLength(50);
    expect(alerts.items[0]).toMatchObject({ id: overdue, hasFailure: false, isOverdue: true, sourceIssues: null });
    expect(alerts.items[1]).toMatchObject({ status: "error", failures: 0, hasFailure: true, isOverdue: false, sourceIssues: null });
    expect(new Set(alerts.items.map(item => item.id)).size).toBe(50);
  });
  it("enqueues immediately, deduplicates manual requests and blocks connection edits during a job", async () => {
    const id = await addIntegration();
    const jobs = await Promise.all([syncStoredIntegration({ id, actorUserId: actorId }), syncStoredIntegration({ id, actorUserId: actorId })]);
    expect(jobs[0].jobId).toBe(jobs[1].jobId); expect(fetch).not.toHaveBeenCalled();
    expect(await state.db.select().from(serviceRecords)).toHaveLength(0);
    await expect(saveProviderIntegration({ id, providerId, name: "Changed", baseUrl: "https://provider.example/api/v2", apiKey: "another-test-key", syncIntervalMinutes: 360, enabled: false, actorUserId: actorId })).rejects.toThrow("current synchronization");
    await expect(deleteProviderIntegration({ id, actorUserId: actorId })).rejects.toThrow("current synchronization");
    const listed = await listProviderIntegrations();
    expect(listed[0].latestJob).toMatchObject({ id: jobs[0].jobId, status: "queued", processedCount: 0 });
    expect(JSON.stringify(listed)).not.toMatch(/credentialCiphertext|configFingerprint|local-test-key/);
  });
  it("imports more than 5,000 rows in bounded resumable batches and defers removals until the complete snapshot", async () => {
    await sync();
    const [old] = await state.db.select().from(serviceRecords); await prepareAndPublish(old.id);
    const [connection] = await state.db.select().from(providerIntegrations);
    const source = Array.from({ length: 5001 }, (_, i) => ({ ...payload[0], service: 1000 + i }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(source))));
    const queued = await syncStoredIntegration({ id: connection.id, actorUserId: actorId });
    await runProviderSyncStep();
    let [job] = await state.db.select().from(providerSyncJobs).where(eq(providerSyncJobs.id, queued.jobId!));
    expect(job).toMatchObject({ status: "importing", totalCount: 5001, processedCount: 0 });
    expect((await listAdminServices()).total).toBe(1);
    await runProviderSyncStep();
    [job] = await state.db.select().from(providerSyncJobs).where(eq(providerSyncJobs.id, queued.jobId!));
    expect(job.processedCount).toBe(100); expect((await listAdminServices()).total).toBe(101);
    expect((await getServiceReview(old.id)).service.available).toBe(true);
    // Simulate a process disappearing while it held a lease. The checkpoint must not be replayed.
    await state.db.update(providerSyncJobs).set({ leaseToken: "old-process", leaseUntil: new Date(Date.now() - 5000) }).where(eq(providerSyncJobs.id, job.id));
    const finished = await finishJob(job.id);
    expect(finished).toMatchObject({ processedCount: 5001, reviewCount: 5001, missingCount: 1 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await listAdminServices()).total).toBe(5002);
    expect((await getServiceReview(old.id)).service).toMatchObject({ available: false, status: "draft" });
    const [snapshots] = await state.db.select({ n: sql<number>`count(*)` }).from(priceSnapshots); expect(Number(snapshots.n)).toBe(5002);
    expect((await getMarketplaceSnapshot()).services).toHaveLength(0);
    for (let i = 0; i < 8; i++) await cleanupProviderSyncSnapshots();
    expect(await state.db.select().from(providerSyncRows)).toHaveLength(0);
  }, 120_000);
  it("does not allow a second worker to fetch a leased job", async () => {
    const id = await addIntegration(); await syncStoredIntegration({ id, actorUserId: actorId });
    let release!: () => void; let started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const blocked = new Promise<void>(resolve => { release = resolve; });
    vi.stubGlobal("fetch", vi.fn(async () => { started(); await blocked; return response(); }));
    const first = runProviderSyncStep(); await ready;
    try { expect(await runProviderSyncStep()).toBe(false); } finally { release(); }
    await first; expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects an out-of-band credential or endpoint change before sending any request", async () => {
    const id = await addIntegration(); const queued = await syncStoredIntegration({ id, actorUserId: actorId });
    await state.db.update(providerIntegrations).set({ baseUrl: "https://different.example/api/v2" }).where(eq(providerIntegrations.id, id));
    await expect(finishJob(queued.jobId!)).rejects.toThrow("configuration changed");
    expect(fetch).not.toHaveBeenCalled(); expect(await state.db.select().from(serviceRecords)).toHaveLength(0);
  });
  it("rolls back both a catalogue batch and its checkpoint when the audit insert fails", async () => {
    const id = await addIntegration(); const queued = await syncStoredIntegration({ id, actorUserId: actorId });
    await runProviderSyncStep();
    await state.db.execute(sql.raw("ALTER TABLE audit_entries ADD CONSTRAINT test_sync_audit_check CHECK (action <> 'integration.services.batch')"));
    try {
      await expect(finishJob(queued.jobId!)).rejects.toThrow("storage error");
      expect(await state.db.select().from(serviceRecords)).toHaveLength(0);
      expect(await state.db.select().from(priceSnapshots)).toHaveLength(0);
      const [job] = await state.db.select().from(providerSyncJobs).where(eq(providerSyncJobs.id, queued.jobId!));
      expect(job).toMatchObject({ status: "failed", processedCount: 0 });
      expect(job.lastError).not.toMatch(/local-test-key|insert into|params:/i);
    } finally { await state.db.execute(sql.raw("ALTER TABLE audit_entries DROP CHECK test_sync_audit_check")); }
  });
  it("does not expose provider response bodies as failure messages", async () => {
    const id = await addIntegration();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "sensitive-upstream-value" }))));
    const queued = await syncStoredIntegration({ id, actorUserId: actorId });
    await expect(finishJob(queued.jobId!)).rejects.toThrow("service list");
    expect(JSON.stringify(await listProviderIntegrations())).not.toContain("sensitive-upstream-value");
    expect(await state.db.select().from(serviceRecords)).toHaveLength(0);
  });
  it("quarantines invalid source values, imports valid records and retains inspectable rejection evidence", async () => {
    await sync(); const [old] = await state.db.select().from(serviceRecords); await prepareAndPublish(old.id);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([
      { ...payload[0], min: "0", secret: "never-retain-this-key" },
      { ...payload[0], service: 200, rate: "0" },
      { ...payload[0], service: 300 },
    ]))));
    const result = await sync();
    expect(result).toMatchObject({ status: "completed_with_issues", totalCount: 3, processedCount: 3, invalidCount: 2, importedCount: 1, missingCount: 0 });
    const previous = (await getServiceReview(old.id)).service;
    expect(previous).toMatchObject({ minOrder: 100, pricePerThousandUsd: "1.0000", status: "draft", reviewStatus: "changes_requested", pricingConfirmed: false, incomplete: true, available: true });
    expect((await listAdminServices()).total).toBe(2);
    expect((await getMarketplaceSnapshot()).services).toHaveLength(0);
    await cleanupProviderSyncSnapshots(); await cleanupProviderSyncSnapshots();
    const issues = await listProviderSyncIssues({ jobId: result.id });
    expect(issues.items).toHaveLength(2);
    expect(issues.items[0]).toMatchObject({ externalId: "100", min: "0", problems: ["invalid_minimum"] });
    expect(issues.items[1]).toMatchObject({ externalId: "200", rate: "0", problems: ["invalid_price"] });
    const retained = await state.db.select().from(providerSyncRows).where(eq(providerSyncRows.jobId, result.id));
    expect(retained).toHaveLength(2); expect(JSON.stringify(retained)).not.toContain("never-retain-this-key");
    expect(await state.db.select().from(priceSnapshots)).toHaveLength(2);
  });
  it("rejects an entirely invalid catalogue without replacing stored values", async () => {
    await sync(); const [old] = await state.db.select().from(serviceRecords);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ ...payload[0], rate: "0" }]))));
    await expect(sync()).rejects.toThrow("All 1 source services");
    expect((await getServiceReview(old.id)).service).toMatchObject({ pricePerThousandUsd: "1.0000", revision: 1, available: true });
  });
  it("paginates source issues and handles a batch containing only invalid rows", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([
      ...Array.from({ length: 101 }, (_, i) => ({ ...payload[0], service: i + 1, max: "0" })),
      { ...payload[0], service: 500 },
    ]))));
    const result = await sync(); expect(result).toMatchObject({ importedCount: 1, invalidCount: 101, processedCount: 102 });
    const first = await listProviderSyncIssues({ jobId: result.id });
    const next = await listProviderSyncIssues({ jobId: result.id, cursor: first.nextCursor! });
    expect(first.items).toHaveLength(25); expect(next.items).toHaveLength(25);
    expect(next.items[0].ordinal).toBeGreaterThan(first.items.at(-1)!.ordinal);
    expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThan(32_000);
  });
  it("matches review-need counts and lists to the actual missing evidence and classification", async () => {
    const oldDate = new Date(Date.now() - 45 * 86400000);
    const fixtures: { key: string; patch: Partial<typeof serviceRecords.$inferInsert>; needs: ReviewNeed[] }[] = [
      { key: "ready", patch: {}, needs: ["ready"] },
      { key: "pricing", patch: { pricingConfirmed: false }, needs: ["pricing_unconfirmed"] },
      { key: "policy", patch: { policyReviewed: false }, needs: ["policy_check"] },
      { key: "no-evidence", patch: { evidenceUrl: null }, needs: ["evidence_missing"] },
      { key: "empty-evidence", patch: { evidenceUrl: "" }, needs: ["evidence_missing"] },
      { key: "platform", patch: { platform: "Unknown" }, needs: ["classification"] },
      { key: "platform-case", patch: { platform: "tiktok" }, needs: ["classification"] },
      { key: "category", patch: { category: "Other" }, needs: ["classification"] },
      { key: "category-case", patch: { category: "views" }, needs: ["classification"] },
      { key: "legacy", patch: { normalizationVersion: 0 }, needs: ["classification"] },
      { key: "price", patch: { pricePerThousandUsd: "0.0000" }, needs: ["invalid_values"] },
      { key: "minimum", patch: { minOrder: 0 }, needs: ["invalid_values"] },
      { key: "maximum", patch: { maxOrder: 50 }, needs: ["invalid_values"] },
      { key: "unavailable", patch: { available: false }, needs: ["source_missing"] },
      { key: "old", patch: { sourceUpdatedAt: oldDate }, needs: ["stale"] },
      { key: "no-date", patch: { sourceUpdatedAt: null, priceCheckedAt: null }, needs: ["stale"] },
      { key: "fresh-price", patch: { sourceUpdatedAt: oldDate, priceCheckedAt: new Date() }, needs: ["ready"] },
      { key: "approved", patch: { reviewStatus: "approved" }, needs: [] },
      { key: "combined", patch: { pricingConfirmed: false, policyReviewed: false, evidenceUrl: null }, needs: ["pricing_unconfirmed", "policy_check", "evidence_missing"] },
    ];
    await state.db.insert(serviceRecords).values(fixtures.map(fixture => ({
      providerId, slug: `needs-${fixture.key}`, externalId: fixture.key, name: `Review fixture ${fixture.key}`,
      platform: "TikTok", category: "Views", pricePerThousandUsd: "1.0000", minOrder: 100, maxOrder: 1000,
      status: "draft", reviewStatus: "pending", normalizationVersion: 1, incomplete: false,
      pricingConfirmed: true, policyReviewed: true, evidenceUrl: "https://provider.example/services", sourceUpdatedAt: new Date(),
      ...fixture.patch,
    })));
    const summary = await getServiceReviewSummary();
    expect(summary.total).toBe(fixtures.length);
    for (const need of reviewNeeds) {
      const expected = fixtures.filter(fixture => fixture.needs.includes(need)).map(fixture => fixture.key).sort();
      const list = await listAdminServices({ need, limit: 100 });
      expect(list.items.map(item => item.externalId).sort(), need).toEqual(expected);
      expect(list.total, need).toBe(expected.length);
      expect(summary[need], need).toBe(expected.length);
    }
    const list = await listAdminServices({ limit: 100 });
    for (const row of list.items) {
      const detail = await getServiceReview(row.id);
      expect(row.blockers).toEqual(detail.blockers);
      expect(row.stale).toBe(detail.stale);
      expect(row.canApprove).toBe(detail.blockers.length === 0 && !detail.stale);
    }
    expect(JSON.stringify(list)).not.toMatch(/sourceData|originalSourceData|reviewFields|evidenceUrl|provider.example\/services/);
  });
  it("keeps review counts scoped to search and status while need filters and pages change", async () => {
    await state.db.insert(serviceRecords).values(Array.from({ length: 32 }, (_, i) => ({
      providerId, slug: `needs-page-${i}`, externalId: String(1000 + i), name: i < 30 ? "Website review set" : "Other set",
      platform: "Website", category: "Website traffic", pricePerThousandUsd: "1.0000", minOrder: 1, maxOrder: 1000,
      countryCode: "US", status: "draft", reviewStatus: i < 30 ? "changes_requested" : "pending",
      normalizationVersion: 1, pricingConfirmed: false, policyReviewed: false, evidenceUrl: null,
    })));
    const filters = { q: "Website review set", providerId, countryCode: "US", platform: "Website", status: "draft" as const, view: "changes_requested" as const, need: "pricing_unconfirmed" as const };
    const first = await listAdminServices(filters);
    const next = await listAdminServices({ ...filters, cursor: first.nextCursor! });
    expect(first.total).toBe(30); expect(first.items).toHaveLength(25); expect(next.items).toHaveLength(5);
    expect(new Set([...first.items, ...next.items].map(item => item.id)).size).toBe(30);
    const summary = await getServiceReviewSummary({ ...filters, cursor: first.nextCursor!, need: "ready", limit: 1 });
    expect(summary).toMatchObject({ total: 30, pricing_unconfirmed: 30, policy_check: 30, evidence_missing: 30, ready: 0 });
    expect((await getServiceReviewSummary({ ...filters, q: "%" })).total).toBe(0);
    expect((await getServiceReviewSummary({ ...filters, countryCode: "KE" })).total).toBe(0);
  });
  it("keeps readiness buttons consistent with approval and provider publication gates", async () => {
    const id = await addService("draft");
    await state.db.update(serviceRecords).set({ reviewStatus: "pending" }).where(eq(serviceRecords.id, id));
    let [row] = (await listAdminServices({ need: "ready" })).items;
    expect(row).toMatchObject({ id, canApprove: true, canPublish: false, stale: false, blockers: [] });
    await applyServiceReview({ items: [{ id, revision: row.revision }], action: "approve", reason: "Confirmed fixture evidence", actorUserId: actorId });
    expect((await listAdminServices({ need: "ready" })).total).toBe(0);
    [row] = (await listAdminServices()).items;
    expect(row.canPublish).toBe(true);
    await state.db.update(providerRecords).set({ status: "draft" }).where(eq(providerRecords.id, providerId));
    expect((await listAdminServices()).items[0].canPublish).toBe(false);
    await state.db.update(serviceRecords).set({ sourceUpdatedAt: new Date("2020-01-01"), priceCheckedAt: null }).where(eq(serviceRecords.id, id));
    [row] = (await listAdminServices()).items;
    expect(row).toMatchObject({ canApprove: false, canPublish: false, stale: true });
    await expect(applyServiceReview({ items: [{ id, revision: row.revision }], action: "approve", reason: "Attempt with outdated evidence", actorUserId: actorId })).rejects.toMatchObject({ message: "review_not_ready" });
  });
  it("keeps payloads bounded across a 50,000-service catalogue and excludes unpublished providers", async () => {
    const size = 50_000;
    for (let start = 0; start < size; start += 500) {
      await state.db.insert(serviceRecords).values(Array.from({ length: 500 }, (_, offset) => {
        const n = start + offset;
        return { providerId, slug: `bulk-${n}`, name: `Campaign service ${n}`, platform: n % 2 ? "TikTok" : "Instagram", category: "Campaigns",
          pricePerThousandUsd: "1.0000", minOrder: 10, maxOrder: 1000, status: "active", reviewStatus: "approved", incomplete: false, normalizationVersion: 1, pricingConfirmed: true, policyReviewed: true, evidenceUrl: "https://provider.example/services", sourceUpdatedAt: new Date(), retentionBasisPoints: n % 2 ? null : 9500 };
      }));
    }
    const first = await listAdminServices();
    expect(first.items).toHaveLength(25); expect(first.total).toBe(size);
    expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThan(32_000);
    const next = await listAdminServices({ cursor: first.nextCursor!, limit: 100 });
    expect(next.items).toHaveLength(100);
    expect(next.items.every(item => item.id < first.items.at(-1)!.id)).toBe(true);
    const filtered = await listAdminServices({ platform: "TikTok", providerId });
    expect(filtered.total).toBe(size / 2); expect(filtered.items.every(item => item.platform === "TikTok")).toBe(true);
    const reviewSummary = await getServiceReviewSummary({ platform: "TikTok", providerId });
    expect(reviewSummary).toMatchObject({ total: size / 2, classification: size / 2, pricing_unconfirmed: 0, evidence_missing: 0, ready: 0 });
    expect(Buffer.byteLength(JSON.stringify(reviewSummary))).toBeLessThan(1000);
    expect((await listAdminServices({ q: "' OR 1=1 --" })).total).toBe(0);
    expect((await listAdminServices({ q: "%" })).total).toBe(0);
    const publicPage = await getMarketplaceSnapshot({ scope: "services" });
    expect(publicPage.source).toBe("database"); expect(publicPage.services).toHaveLength(25);
    expect(publicPage.pagination.total).toBe(size); expect(publicPage.providers[0]?.activeServicesCount).toBe(size);
    const comparison = await getMarketplaceSnapshot({ scope: "compare", ids: [first.items.at(-1)!.id] });
    expect(comparison.services.map(item => item.id)).toEqual([`service-${first.items.at(-1)!.id}`]);
    const profile = await getMarketplaceSnapshot({ scope: "provider", slug: "test-provider" });
    expect(profile.services).toHaveLength(25); expect(profile.pagination.nextCursor).not.toBeNull();
    for (const sort of ["recommended", "price", "retention"] as const) {
      const page = await getMarketplaceSnapshot({ scope: "services", sort });
      const after = await getMarketplaceSnapshot({ scope: "services", sort, cursor: page.pagination.nextCursor! });
      const ids = new Set(page.services.map(item => item.id));
      expect(after.services).toHaveLength(25); expect(after.services.some(item => ids.has(item.id))).toBe(false);
    }
    await state.db.update(providerRecords).set({ status: "draft" }).where(eq(providerRecords.id, providerId));
    const stats = await getAdminOverview(rolePermissions.catalogue_editor);
    expect(stats).toMatchObject({ totalServices: size, publishedServices: 0, teamMembers: null, recordedActions: null });
    expect((await getMarketplaceSnapshot({ scope: "services" })).services).toEqual([]);
    expect((await getMarketplaceSnapshot({ scope: "compare", ids: [first.items[0]!.id] })).services).toEqual([]);
    expect((await listAdminServices()).total).toBe(size);
  }, 60_000);

});
