import { pushAcceptanceCases } from "./pushMysqlAcceptance";
import { reviewWorkspaceAcceptanceCases } from "./reviewWorkspaceMysqlAcceptance";
import { trustAcceptanceCases } from "./trustMysqlAcceptance";
import { messagingAcceptanceCases } from "./messagingMysqlAcceptance";
import { appearanceAcceptanceCases } from "./appearanceMysqlAcceptance";
import { linkMetadataAcceptanceCases } from "./linkMetadataMysqlAcceptance";
import { providerVipAcceptanceCases } from "./providerVipMysqlAcceptance";
import { providerBusinessAcceptanceCases } from "./providerBusinessMysqlAcceptance";
import { providerPaymentsAcceptanceCases } from "./providerPaymentsMysqlAcceptance";
import { providerAnalyticsAcceptanceCases } from "./providerAnalyticsMysqlAcceptance";
import { teamAcceptanceCases } from "./teamMysqlAcceptance";
import { providerProfileAcceptanceCases } from "./providerProfileMysqlAcceptance";
import { workspaceAcceptanceCases } from "./workspaceMysqlAcceptance";
import { priceAlertAcceptanceCases } from "./priceAlertsMysqlAcceptance";
import { communityAcceptanceCases } from "./communityMysqlAcceptance";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { invalidateCatalogueCaches } from "./catalogueCache";
import { appRouter } from "./routers";
import { confirmSourcePricing } from "./sourcePricing";
import { quantityQuoteExact } from "../shared/pricing";
import { serviceNameFingerprint } from "./publicRateTable";
import { createSourcedDrafts } from "./sourcedOffersDb";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { and, eq, sql } from "drizzle-orm";
import { assistantUsageBuckets, auditEntries, priceSnapshots, providerIntegrations, providerRecords, providerSyncJobs, providerSyncRows, serviceRecords, users, teamMembers } from "../drizzle/schema";
import { reserveAssistantTurn } from "./assistantUsage";
import { assistantOffersByIds } from "./assistantCatalogue";
import { memberAcceptanceCases } from "./memberMysqlAcceptance";
import { emailAcceptanceCases } from "./emailMysqlAcceptance";
import type { ProviderPricingSnapshot } from "../shared/providerPricing";

const state = vi.hoisted(() => ({ db: null as any, pricing: null as ProviderPricingSnapshot | null }));
vi.mock("./providerPricing", async original => ({
  ...await original<typeof import("./providerPricing")>(),
  fetchProviderPricing: async (_url: URL, _key: string, currency: string | null) => state.pricing ?? { currency, perThousandEvidenceUrl: null },
}));
vi.mock("./db", () => ({ getDb: async () => state.db }));
vi.mock("node:dns/promises", () => ({ lookup: async () => [{ address: "93.184.216.34", family: 4 }] }));
import { getCachedMarketplaceSnapshot, listAdminProviderPage, listAdminProviders, getMarketplaceSnapshot, setProviderCataloguePublication, updateProviderStatus, updateServiceRecord } from "./marketplaceDb";
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
    state.pricing = null;
    invalidateCatalogueCaches();
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("MARKETPLACE_DEMO_MODE", "false");
    vi.stubEnv("VAULT_MASTER_KEY", Buffer.alloc(32, 17).toString("base64url"));
    await state.db.delete(auditEntries);
    await state.db.delete(teamMembers);
    await state.db.insert(teamMembers).values({ userId: actorId, email: "catalogue-owner@example.com", role: "administrator", status: "active" });
    await state.db.delete(providerRecords);
    const inserted = await state.db.insert(providerRecords).values({ slug: "test-provider", name: "Test provider", initials: "TP", status: "active", verified: false }).$returningId();
    providerId = inserted[0].id;
    vi.stubGlobal("fetch", vi.fn(async () => response()));
  });
  afterEach(async () => {
    vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  });
  afterAll(async () => { if (pool) await pool.end(); });
  trustAcceptanceCases(() => state.db, () => actorId, () => providerId, addIntegration);
  appearanceAcceptanceCases(() => state.db, () => actorId);
  messagingAcceptanceCases(() => state.db, () => actorId);
  pushAcceptanceCases(() => state.db, () => actorId);
  memberAcceptanceCases(() => state.db, () => actorId);
  workspaceAcceptanceCases(() => state.db, () => providerId);
  priceAlertAcceptanceCases(() => state.db, () => providerId);
  emailAcceptanceCases(() => state.db, () => actorId);
  communityAcceptanceCases(() => state.db, () => actorId, () => providerId);
  teamAcceptanceCases(() => state.db, () => actorId);
  providerProfileAcceptanceCases(() => state.db, () => actorId, () => providerId, addIntegration);
  providerAnalyticsAcceptanceCases(() => state.db, () => actorId, () => providerId);
  linkMetadataAcceptanceCases(() => state.db, () => actorId, () => providerId);
  providerBusinessAcceptanceCases(() => state.db, () => actorId, () => providerId);
  providerPaymentsAcceptanceCases(() => state.db, () => actorId, () => providerId);
  providerVipAcceptanceCases(() => state.db, () => actorId, () => providerId);
  reviewWorkspaceAcceptanceCases(() => state.db, () => actorId);

  async function addService(status: "draft" | "active" | "paused" | "archived" = "active", owner = providerId) {
    const inserted = await state.db.insert(serviceRecords).values({ providerId: owner, externalId: "100", slug: `legacy-service-${owner}`, name: "TikTok Views", platform: "TikTok", category: "Views", priceAmount: "1.0000", minOrder: 100, maxOrder: 1000, status, reviewStatus: "approved", incomplete: false, normalizationVersion: 1, pricingConfirmed: true, priceCurrency: "USD", priceUnit: "per_1000", policyReviewed: true, evidenceUrl: "https://provider.example/services", sourceUpdatedAt: new Date() }).$returningId();
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

  it("records comparable source price changes through the real sync worker for a saved watch", async () => {
    vi.stubEnv("AUTH_PEPPER", "watch-sync-test-pepper");
    vi.stubEnv("MAIL_ENABLED", "false");
    const { registerMember, authenticateMemberSession } = await import(
      "./memberDb"
    );
    const { saveWatch, readWorkspace, watchHistory, setWatchTarget } = await import(
      "./buyerWorkspace"
    );
    const { memberAccounts } = await import("../drizzle/memberSchema");
    await state.db.delete(memberAccounts);
    const registration = await registerMember({
      name: "Sync watch",
      email: "sync-watch@example.com",
      password: "a long local sync watch password",
    });
    const auth = (await authenticateMemberSession(registration.token))!;
    const row = {
      ...payload[0],
      rate: "2.60",
      currency: "USD",
      unit: "per_1000",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([row]), { status: 200 }))
    );
    await addIntegration("active");
    await sync();
    await setProviderCataloguePublication({
      id: providerId,
      enabled: true,
      confirmed: true,
      reason: "Publish local sync test catalogue",
      actorUserId: actorId,
    });
    const first = (
      await getMarketplaceSnapshot({ scope: "provider", slug: "test-provider" })
    ).services[0]!;
    expect(first.priceUnit).toBe("per_1000");
    const watch = await saveWatch(auth, {
      serviceId: first.id,
      quantity: 1000,
    });
    await state.db.update(memberAccounts).set({ emailVerifiedAt: new Date() }).where(eq(memberAccounts.id, auth.member.id));
    vi.stubEnv("MAIL_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "local-test-no-network");
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "local-test");
    await setWatchTarget(auth, { id: watch.id, target: "2.40", emailAlert: true });
    row.rate = "2.40";
    await sync();
    invalidateCatalogueCaches();
    const saved = (await readWorkspace(auth)).watches[0]!;
    expect(saved.change).toMatchObject({
      status: "lower",
      original: "2.60",
      now: "2.40",
      targetReached: true,
    });
    const points = (await watchHistory(auth, watch.id)).points;
    expect(points.map(p => Number(p.rate))).toContain(2.6);
    expect(points.map(p => Number(p.rate))).toContain(2.4);
    expect(points.length).toBeGreaterThanOrEqual(2);
    const { evaluateOnePriceAlert } = await import("./priceAlerts");
    const { emailOutbox } = await import("../drizzle/emailSchema");
    const { memberWatches } = await import("../drizzle/workspaceSchema");
    // Simulate the next worker tick. MySQL TIMESTAMP has second precision;
    // checking in the same sub-second as subscription is not a due-time test.
    await state.db.update(memberWatches).set({ emailAlertNextCheckAt: new Date(Date.now() - 5000) })
      .where(eq(memberWatches.id, watch.id));
    expect(await evaluateOnePriceAlert()).toBe(true);
    expect(await evaluateOnePriceAlert()).toBe(false);
    const emails = await state.db.select().from(emailOutbox).where(eq(emailOutbox.kind, "price_target"));
    expect(emails).toHaveLength(1);
    expect(emails[0].priceAlert).toMatchObject({ total: "2.40", currency: "USD", quantity: 1000 });
  });

  async function prepareAndPublish(id: number) {
    const detail = await getServiceReview(id);
    const edited = await editServiceReview({ id, revision: detail.service.revision, platform: "TikTok", category: "Views", countryCode: null,
      price: Number(detail.service.priceAmount), minOrder: 100, maxOrder: 1000, refillMode: "unknown", refillDays: null,
      evidenceUrl: "https://provider.example/services", pricingConfirmed: true, priceCurrency: "USD", priceUnit: "per_1000", policyReviewed: true, reason: "Test fixture source and eligibility checked", actorUserId: actorId });
    await applyServiceReview({ items: [{ id, revision: edited.revision }], action: "approve", reason: "Test fixture review complete", actorUserId: actorId });
    await applyServiceReview({ items: [{ id, revision: edited.revision + 1 }], action: "publish", reason: "Test fixture publication", actorUserId: actorId });
  }

  const webOffer = { slug: "social-monthly", name: "Monthly content", nameAr: "محتوى شهري", platform: "Instagram" as const, category: "Content creation" as const, price: 99, currency: "USD" as const, scope: "10 posts each month", scopeAr: "عشرة منشورات في الشهر", terms: "One channel; extras cost more.", termsAr: "قناة واحدة؛ الإضافات برسوم.", sourceUrl: "https://provider.example/pricing", priceType: "listed" as const };
  async function createWebDraft() {
    await state.db.update(providerRecords).set({ websiteUrl: "https://provider.example" }).where(eq(providerRecords.id, providerId));
    return createSourcedDrafts({ providerId, offers: [webOffer], reason: "Test public-source extraction", actorUserId: actorId });
  }


  it("enforces shared AI budgets atomically and resets at the UTC day boundary", async () => {
    await state.db.delete(assistantUsageBuckets);
    vi.stubEnv("BEACON_AI_DAILY_LIMIT", "2");
    const now = Date.now();
    const reservations = await Promise.allSettled(Array.from({length:8}, (_,i)=>reserveAssistantTurn(`client-${i}`, now)));
    expect(reservations.filter(result=>result.status==="fulfilled")).toHaveLength(2);
    const rows = await state.db.select().from(assistantUsageBuckets);
    expect(rows.filter((row:any)=>row.key.startsWith("global:"))[0].used).toBe(2);
    expect(rows).toHaveLength(5); // rejected client reservations roll back
    await expect(reserveAssistantTurn("tomorrow", now+86400000)).resolves.toBeUndefined();
  });

  it("does not spend the global AI budget for requests rejected by the client limit", async () => {
    await state.db.delete(assistantUsageBuckets);
    vi.stubEnv("BEACON_AI_DAILY_LIMIT", "100");
    const now=Date.now();
    const reservations = await Promise.allSettled(Array.from({length:12}, ()=>reserveAssistantTurn("same-client",now)));
    expect(reservations.filter(result=>result.status==="fulfilled")).toHaveLength(8);
    const rows = await state.db.select().from(assistantUsageBuckets);
    expect(rows.every((row:any)=>row.used===8)).toBe(true);
  });

  it("applies assistant target-market and keyword filters inside provider catalogues and hides retired offers", async () => {
    const serviceId=await addService();
    await state.db.update(serviceRecords).set({name:"French TikTok Views",countryCode:"US"}).where(eq(serviceRecords.id,serviceId));
    expect((await getMarketplaceSnapshot({scope:"provider",slug:"test-provider",q:"French",countryCode:"US"})).services).toHaveLength(1);
    expect((await getMarketplaceSnapshot({scope:"provider",slug:"test-provider",q:"Japanese",countryCode:"US"})).services).toHaveLength(0);
    expect((await getMarketplaceSnapshot({scope:"provider",slug:"test-provider",q:"French",countryCode:"PA"})).services).toHaveLength(0);
    expect((await getMarketplaceSnapshot({scope:"providers",platform:"TikTok",category:"Views",serviceQuery:"French",countryCode:"US"})).providers).toHaveLength(1);
    expect((await getMarketplaceSnapshot({scope:"providers",platform:"Instagram",category:"Views",serviceQuery:"French",countryCode:"US"})).providers).toHaveLength(0);
    expect(await assistantOffersByIds([`service-${serviceId}`])).toHaveLength(1);
    await state.db.update(serviceRecords).set({status:"paused"}).where(eq(serviceRecords.id,serviceId));
    invalidateCatalogueCaches();
    expect(await assistantOffersByIds([`service-${serviceId}`])).toHaveLength(0);
  });

  it("removes manually researched listings but preserves connections and activates only the existing JAP API", async () => {
    const [manual] = await state.db.insert(providerRecords).values({slug:"smm-africa",name:"SMM Africa",initials:"SA"}).$returningId();
    const serviceId = await addService("active", manual.id);
    await state.db.update(serviceRecords).set({sourceKind:"public_web"}).where(eq(serviceRecords.id, serviceId));
    const [jap] = await state.db.insert(providerRecords).values({slug:"justanotherpanel",name:"JustAnotherPanel",initials:"JAP"}).$returningId();
    await state.db.insert(providerIntegrations).values({providerId:jap.id,name:"Existing JAP connection",baseUrl:"https://justanotherpanel.com/api/v2",status:"active",lastSyncedAt:new Date(),credentialCiphertext:"test-encrypted-placeholder"});
    const [connected] = await state.db.insert(providerRecords).values({slug:"follow-sale",name:"Follow.sale",initials:"FS"}).$returningId();
    await state.db.insert(providerIntegrations).values({providerId:connected.id,name:"Retain owner connection",baseUrl:"https://follow.example/api"});
    const statements=readFileSync("drizzle/0011_connected_api_catalogue.sql","utf8").split("--> statement-breakpoint").slice(1).map(v=>v.trim()).filter(Boolean);
    for(let attempt=0;attempt<2;attempt++) await state.db.transaction(async(tx:any)=>{for(const statement of statements) await tx.execute(sql.raw(statement));});
    expect(await state.db.select().from(providerRecords).where(eq(providerRecords.id,manual.id))).toHaveLength(0);
    expect(await state.db.select().from(serviceRecords).where(eq(serviceRecords.id,serviceId))).toHaveLength(0);
    const [published]=await state.db.select().from(providerRecords).where(eq(providerRecords.id,jap.id));
    expect(published).toMatchObject({status:"active",apiCataloguePublished:true,verified:false});
    expect(await state.db.select().from(providerIntegrations)).toHaveLength(2);
    expect(await state.db.select().from(auditEntries).where(eq(auditEntries.action,"marketplace.manual.remove"))).toHaveLength(1);
    expect(await state.db.select().from(auditEntries).where(eq(auditEntries.action,"provider.api_catalogue.publish"))).toHaveLength(1);
  });
  it("lists an opted-in API catalogue without inventing approval, currency, units or quality", async () => {
    await state.db.update(providerRecords).set({apiCataloguePublished: true}).where(eq(providerRecords.id, providerId));
    const integration = await addIntegration("active");
    await sync();
    const [stored] = await state.db.select().from(serviceRecords).where(eq(serviceRecords.providerId, providerId));
    expect(stored).toMatchObject({status: "draft", reviewStatus: "pending", policyReviewed: false, pricingConfirmed: false});
    await state.db.update(serviceRecords).set({sourceRate: "1.0123456"}).where(eq(serviceRecords.id, stored.id));
    const result = await getMarketplaceSnapshot({scope: "services", market: "smm"});
    expect(result.pagination.total).toBe(1);
    expect((await listAdminServices({view:"published"})).total).toBe(1);
    expect((await getAdminOverview(["services.read"])).publishedServices).toBe(1);
    expect(result.providers[0]).toMatchObject({apiConnected: true, score: null, verified: false, activeServicesCount: 1});
    expect(result.services[0]).toMatchObject({sourceServiceId: "100", catalogueListing: "api_source", sourceRate: "1.0123456", priceAmount: 1.0123456, priceCurrency: null, priceUnit: null});
    expect(result.services[0]).not.toHaveProperty("sourceData");
    expect((await getMarketplaceSnapshot({scope: "providers", market: "smm"})).providers).toHaveLength(1);
    expect((await getMarketplaceSnapshot({scope: "provider", slug: "test-provider"})).services).toHaveLength(1);
    expect((await getMarketplaceSnapshot({scope: "services", sort: "price", priceCurrency: "USD", priceUnit: "per_1000"})).services).toHaveLength(0);
    await setProviderIntegrationEnabled({id: integration, enabled: false, actorUserId: actorId});
    expect((await getMarketplaceSnapshot({scope: "providers", market: "smm"})).providers).toHaveLength(0);
  });
  it("applies the owner's USD confirmation only to the matching JAP connection and source records", async () => {
    await state.db.update(providerRecords).set({slug: "justanotherpanel", apiCataloguePublished: true}).where(eq(providerRecords.id, providerId));
    const integrationId = await addIntegration("active");
    await state.db.update(providerIntegrations).set({baseUrl: "https://justanotherpanel.com/api/v2"}).where(eq(providerIntegrations.id, integrationId));
    await sync();
    const [source] = await state.db.select().from(serviceRecords);
    // A separately edited display currency must not relabel the original API rate.
    await state.db.update(serviceRecords).set({priceCurrency: "EUR"}).where(eq(serviceRecords.id, source.id));
    const manualId = await addService("draft");
    const [other] = await state.db.insert(providerRecords).values({slug: "other-provider", name: "Other", initials: "O"}).$returningId();
    const [otherIntegration] = await state.db.insert(providerIntegrations).values({providerId: other.id, name: "Other connection", baseUrl: "https://justanotherpanel.com/api/v2", lastSyncedAt: new Date(), credentialCiphertext: "test-placeholder"}).$returningId();
    const otherId = await addService("draft", other.id);
    await state.db.update(serviceRecords).set({sourceKind: "provider_api", sourceUrl: "https://justanotherpanel.com/api/v2"}).where(eq(serviceRecords.id, otherId));
    const statements = readFileSync("drizzle/0012_jap_confirmed_usd.sql", "utf8").split("--> statement-breakpoint").slice(2).map(v => v.trim()).filter(Boolean);
    for (let attempt = 0; attempt < 2; attempt++) await state.db.transaction(async (tx: any) => { for (const statement of statements) await tx.execute(sql.raw(statement)); });
    const detail = await getServiceReview(source.id);
    expect(detail.service).toMatchObject({sourceCurrency: "USD", priceCurrency: "EUR", sourceRate: "1.00", priceUnit: null, pricingConfirmed: false, reviewStatus: "pending", revision: source.revision + 1});
    expect(detail.prices[0]).toMatchObject({kind: "source", priceCurrency: null});
    expect((await getServiceReview(manualId)).service.sourceCurrency).toBeNull();
    expect((await getServiceReview(otherId)).service.sourceCurrency).toBeNull();
    const [unrelated] = await state.db.select().from(providerIntegrations).where(eq(providerIntegrations.id, otherIntegration.id));
    expect(unrelated.sourceCurrency).toBeNull();
    const audits = await state.db.select().from(auditEntries).where(eq(auditEntries.action, "integration.source_currency.confirm"));
    expect(audits).toHaveLength(1);
    expect(audits[0].metadata).toMatchObject({after: "USD", basis: "owner_confirmation", saleUnitConfirmed: false});
    const result = await getMarketplaceSnapshot({scope: "services", market: "smm", priceCurrency: "USD"});
    expect(result.services).toHaveLength(1);
    expect(result.services[0]).toMatchObject({priceCurrency: "USD", priceUnit: null, sourceRate: "1.00"});
  });
  it("retains account currency through imports and source price changes without enabling unit-price ranking", async () => {
    await state.db.update(providerRecords).set({apiCataloguePublished: true}).where(eq(providerRecords.id, providerId));
    const integrationId = await addIntegration("active");
    await state.db.update(providerIntegrations).set({sourceCurrency: "USD"}).where(eq(providerIntegrations.id, integrationId));
    await sync();
    const [source] = await state.db.select().from(serviceRecords);
    expect(source).toMatchObject({sourceCurrency: "USD", priceCurrency: "USD", priceUnit: null, pricingConfirmed: false});
    await state.db.update(serviceRecords).set({priceCurrency: "EUR"}).where(eq(serviceRecords.id, source.id));
    await sync();
    expect((await getServiceReview(source.id)).service).toMatchObject({sourceCurrency: "USD", priceCurrency: "EUR", revision: source.revision});
    expect((await getMarketplaceSnapshot({scope: "services", priceCurrency: "USD"})).pagination.total).toBe(1);
    expect((await getMarketplaceSnapshot({scope: "services", priceCurrency: "EUR"})).services).toHaveLength(0);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{...payload[0], rate: "2.0123456"}]), {status: 200})));
    await sync();
    const changed = await getServiceReview(source.id);
    expect(changed.service).toMatchObject({sourceCurrency: "USD", priceCurrency: "USD", sourceRate: "2.0123456", priceUnit: null, pricingConfirmed: false, reviewStatus: "pending"});
    expect(changed.prices[0]).toMatchObject({kind: "source", priceCurrency: "USD", sourceRate: "2.0123456", priceUnit: null});
    expect((await getMarketplaceSnapshot({scope: "services", sort: "price", priceCurrency: "USD", priceUnit: "per_1000"})).services).toHaveLength(0);
  });
  async function importUsdSource(rows = payload) {
    await state.db.update(providerRecords).set({apiCataloguePublished:true}).where(eq(providerRecords.id,providerId));
    const integrationId = await addIntegration("active");
    await state.db.update(providerIntegrations).set({sourceCurrency:"USD"}).where(eq(providerIntegrations.id,integrationId));
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify(rows),{status:200})));
    await sync();
    return state.db.select().from(serviceRecords);
  }
  const publication = { enabled: true, reason: "Owner requested visibility of the connected provider" };
  const ownerCaller = () => appRouter.createCaller({ user: { id: actorId, openId: "catalogue-test-owner", role: "admin", email: null }, req: { headers: {}, ip: "127.0.0.1" }, res: {} } as any);

  it("returns at most 16 public homepage profiles with service counts and no offers", async () => {
    for (let index = 0; index < 18; index++) {
      const [provider] = await state.db.insert(providerRecords).values({ slug: `home-provider-${index}`, name: `Home provider ${index}`, initials: "HP", status: "active" }).$returningId();
      await addService("active", provider.id);
    }
    await state.db.insert(providerRecords).values({ slug: "hidden-home-provider", name: "Hidden home provider", initials: "HH", status: "suspended" });
    const result = await getMarketplaceSnapshot({ scope: "home", limit: 100 });
    expect(result.source).toBe("database");
    expect(result.providers).toHaveLength(16);
    expect(result.providers.every(provider => provider.activeServicesCount === 1)).toBe(true);
    expect(result.providers.some(provider => provider.slug === "hidden-home-provider")).toBe(false);
    expect(result.services).toEqual([]);
    expect(result.pagination).toEqual({ total: 19, nextCursor: null });
  });
  it("enforces exact provider scope in directory, service pages and cache keys", async () => {
    const [other] = await state.db.insert(providerRecords).values({ slug: "scope-other", name: "Scope other", initials: "SO", status: "active" }).$returningId();
    const first = await addService(); const second = await addService("active", other.id);
    const selected = await getCachedMarketplaceSnapshot({ scope: "services", providerIds: [providerId] });
    expect(selected.services.map(service => service.id)).toEqual([`service-${first}`]);
    expect(selected.pagination.total).toBe(1);
    const changed = await getCachedMarketplaceSnapshot({ scope: "services", providerIds: [other.id] });
    expect(changed.services.map(service => service.id)).toEqual([`service-${second}`]);
    expect((await getMarketplaceSnapshot({ scope: "providers", providerIds: [providerId] })).providers.map(provider => provider.id)).toEqual([`provider-${providerId}`]);
    expect((await getMarketplaceSnapshot({ scope: "services", providerIds: [2147483647] })).services).toEqual([]);
    expect((await getMarketplaceSnapshot({ scope: "provider", slug: "scope-other", providerIds: [providerId] })).providers).toEqual([]);
    await ownerCaller().admin.providers.setStatus({ id: providerId, status: "suspended" });
    expect((await getCachedMarketplaceSnapshot({ scope: "services", providerIds: [providerId] })).services).toEqual([]);
  });

  it("publishes a newly synced provider and refreshes the directory, profile and offers together", async () => {
    await state.db.update(providerRecords).set({ status: "draft" }).where(eq(providerRecords.id, providerId));
    await addIntegration("active");
    await sync();
    const [source] = await state.db.select().from(serviceRecords);
    const filter = { scope: "providers" as const, market: "smm" as const };
    expect((await listAdminProviderPage()).items[0]).toMatchObject({ status: "draft", apiCataloguePublished: false, apiConnectionReady: true, apiServicesReady: true });
    expect((await getCachedMarketplaceSnapshot(filter)).providers).toHaveLength(0);
    expect((await getCachedMarketplaceSnapshot({ scope: "services" })).services).toHaveLength(0);
    const caller = ownerCaller();
    expect(await caller.admin.providers.setCataloguePublication({ ...publication, id: providerId })).toMatchObject({ changed: true });
    const directory = await getCachedMarketplaceSnapshot(filter);
    expect(directory.providers).toHaveLength(1);
    expect(directory.providers[0]).toMatchObject({ slug: "test-provider", apiConnected: true, activeServicesCount: 1, verified: false });
    expect((await getCachedMarketplaceSnapshot({ scope: "services" })).services).toHaveLength(1);
    expect((await getMarketplaceSnapshot({ scope: "provider", slug: "test-provider" })).services[0]).toMatchObject({ catalogueListing: "api_source", sourceRate: "1.00", priceCurrency: null, priceUnit: null });
    expect((await getMarketplaceSnapshot({ scope: "home" })).providers).toHaveLength(1);
    expect((await state.db.select().from(serviceRecords))[0]).toEqual(source);
    expect(await caller.admin.providers.setCataloguePublication({ ...publication, id: providerId })).toMatchObject({ changed: false });
    const audits = await state.db.select().from(auditEntries).where(eq(auditEntries.action, "provider.api_catalogue.publish"));
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actorUserId: actorId, ipAddress: "127.0.0.1", entityId: String(providerId) });
    expect(audits[0].metadata).toMatchObject({ before: { status: "draft", apiCataloguePublished: false }, after: { status: "active", apiCataloguePublished: true }, serviceReviewsUnchanged: true });
    await caller.admin.providers.setCataloguePublication({ ...publication, id: providerId, enabled: false });
    expect((await getCachedMarketplaceSnapshot(filter)).providers).toHaveLength(0);
    expect((await getCachedMarketplaceSnapshot({ scope: "services" })).services).toHaveLength(0);
    expect((await state.db.select().from(serviceRecords))[0]).toEqual(source);
  });

  it("blocks publication until the connection and its imported services are ready", async () => {
    const integrationId = await addIntegration("active");
    const publish = () => ownerCaller().admin.providers.setCataloguePublication({ ...publication, id: providerId });
    await expect(publish()).rejects.toMatchObject({ message: "api_catalogue_not_ready" });
    await sync();
    const [connection] = await state.db.select().from(providerIntegrations);
    for (const blocked of [{ status: "disabled" }, { lastSyncedAt: null }, { credentialCiphertext: null }]) {
      await state.db.update(providerIntegrations).set({ status: "active", lastSyncedAt: connection.lastSyncedAt, credentialCiphertext: connection.credentialCiphertext, ...blocked }).where(eq(providerIntegrations.id, integrationId));
      expect((await listAdminProviderPage()).items[0].apiConnectionReady).toBe(false);
      await expect(publish()).rejects.toMatchObject({ message: "api_catalogue_not_ready" });
    }
    await state.db.update(providerIntegrations).set({ credentialCiphertext: connection.credentialCiphertext }).where(eq(providerIntegrations.id, integrationId));
    for (const blocked of [{ status: "paused" }, { reviewStatus: "changes_requested" }, { available: false }, { sourceRate: "invalid" }]) {
      await state.db.update(serviceRecords).set({ status: "draft", reviewStatus: "pending", available: true, sourceRate: "1.00", ...blocked }).where(eq(serviceRecords.providerId, providerId));
      expect((await listAdminProviderPage()).items[0].apiServicesReady).toBe(false);
      await expect(publish()).rejects.toMatchObject({ message: "api_catalogue_not_ready" });
    }
    await state.db.update(providerRecords).set({ status: "suspended" }).where(eq(providerRecords.id, providerId));
    await expect(publish()).rejects.toMatchObject({ message: "provider_suspended" });
    expect((await state.db.select().from(providerRecords))[0]).toMatchObject({ status: "suspended", apiCataloguePublished: false });
    expect(await state.db.select().from(auditEntries).where(eq(auditEntries.action, "provider.api_catalogue.publish"))).toHaveLength(0);
  });

  it("rolls back provider publication when its audit entry cannot be recorded", async () => {
    await state.db.update(providerRecords).set({ status: "draft" }).where(eq(providerRecords.id, providerId));
    await addIntegration("active"); await sync();
    await expect(setProviderCataloguePublication({ ...publication, id: providerId, actorUserId: 2147483000 })).rejects.toThrow();
    expect((await state.db.select().from(providerRecords))[0]).toMatchObject({ status: "draft", apiCataloguePublished: false });
    expect((await getMarketplaceSnapshot({ scope: "providers", market: "smm" })).providers).toHaveLength(0);
  });

  it("repairs only the matching ready paksmmportal catalogue once, without altering service evidence", async () => {
    await state.db.update(providerRecords).set({ slug: "paksmmportal", status: "draft" }).where(eq(providerRecords.id, providerId));
    const integrationId = await addIntegration("active"); await sync();
    const [source] = await state.db.select().from(serviceRecords);
    const statements = readFileSync("drizzle/0014_publish_paksmmportal.sql", "utf8").split("--> statement-breakpoint").map(v => v.trim()).filter(Boolean);
    const repair = () => state.db.transaction(async (tx: any) => { for (const statement of statements) await tx.execute(sql.raw(statement)); });
    // A matching name is not enough when the endpoint belongs to another provider.
    await repair();
    expect((await state.db.select().from(providerRecords))[0].apiCataloguePublished).toBe(false);
    await state.db.update(providerIntegrations).set({ baseUrl: "https://paksmmportal.com/api/v2", status: "disabled" }).where(eq(providerIntegrations.id, integrationId));
    await repair();
    expect((await state.db.select().from(providerRecords))[0].apiCataloguePublished).toBe(false);
    await state.db.update(providerIntegrations).set({ status: "active" }).where(eq(providerIntegrations.id, integrationId));
    await state.db.update(providerRecords).set({ status: "suspended" }).where(eq(providerRecords.id, providerId));
    await repair();
    expect((await state.db.select().from(providerRecords))[0]).toMatchObject({ status: "suspended", apiCataloguePublished: false });
    await state.db.update(providerRecords).set({ status: "draft" }).where(eq(providerRecords.id, providerId));
    await repair(); await repair();
    expect((await state.db.select().from(providerRecords))[0]).toMatchObject({ status: "active", apiCataloguePublished: true, verified: false });
    expect((await state.db.select().from(serviceRecords))[0]).toEqual(source);
    expect((await getMarketplaceSnapshot({ scope: "providers", market: "smm" })).providers[0]?.slug).toBe("paksmmportal");
    expect(await state.db.select().from(auditEntries).where(eq(auditEntries.action, "provider.api_catalogue.publish"))).toHaveLength(1);
  });

  const unitEvidence = {unit:"per_1000" as const, evidenceUrl:"https://provider.example/services", confirmed:true as const, reason:"Each selected API rate is per 1000, checked in the source"};
  it("persists detected pricing through resumable sync and exposes exact comparable source quotes", async () => {
    const integrationId = await addIntegration("active");
    await state.db.update(providerIntegrations).set({ baseUrl: "https://smmpanelone.com/api/v2" }).where(eq(providerIntegrations.id, integrationId));
    state.pricing = { currency: "INR", perThousandEvidenceUrl: "https://smmpanelone.com/services" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ ...payload[0], type: "Default", rate: "2.60" }]))));
    await sync();
    await state.db.update(providerRecords).set({ apiCataloguePublished: true }).where(eq(providerRecords.id, providerId));
    const [row] = await state.db.select().from(serviceRecords);
    expect(row).toMatchObject({ sourceCurrency: "INR", sourcePriceUnit: "per_1000", sourcePricingMode: "auto", pricingConfirmed: false, reviewStatus: "pending" });
    expect(row.sourcePricingIdentity).toHaveLength(64);
    expect((await state.db.select().from(providerSyncJobs))[0].pricingSnapshot).toEqual(state.pricing);
    expect((await listProviderIntegrations())[0].sourceCurrency).toBe("INR");
    const publicRow = (await getMarketplaceSnapshot({ scope: "services" })).services[0]!;
    expect(publicRow).toMatchObject({ priceCurrency: "INR", priceUnit: "per_1000", sourceRate: "2.60" });
    expect(quantityQuoteExact(publicRow, 500)).toBe("1.30");
    expect(await state.db.select().from(auditEntries).where(eq(auditEntries.action, "integration.source_currency.detect"))).toHaveLength(1);
    await confirmSourcePricing({ ...unitEvidence, unit: null, evidenceUrl: null, items: [{ id: row.id, revision: row.revision }], actorUserId: actorId });
    await sync();
    expect((await getServiceReview(row.id)).service).toMatchObject({ sourcePricingMode: "blocked", sourcePriceUnit: null });
    expect((await getMarketplaceSnapshot({ scope: "services" })).services[0]!.priceUnit).toBeNull();
  });

  it("refreshes existing unknown pricing without rate changes and honors a manual unit on subsequent syncs", async () => {
    const integrationId = await addIntegration("active");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ ...payload[0], unit: "per_1000" }]))));
    await sync();
    const [row] = await state.db.select().from(serviceRecords);
    expect(row.sourcePriceUnit).toBeNull();
    state.pricing = { currency: "USD", perThousandEvidenceUrl: null };
    await sync();
    let current = (await getServiceReview(row.id)).service;
    expect(current).toMatchObject({ sourceCurrency: "USD", sourcePriceUnit: "per_1000", sourcePricingMode: "auto" });
    await confirmSourcePricing({ ...unitEvidence, unit: "per_item", items: [{ id: current.id, revision: current.revision }], actorUserId: actorId });
    await sync();
    expect((await getServiceReview(row.id)).service).toMatchObject({ sourcePriceUnit: "per_item", sourcePricingMode: "manual" });
    await saveProviderIntegration({ id: integrationId, providerId, name: "Changed account", baseUrl: "https://provider.example/api/v2", apiKey: "replacement-synthetic-key", syncIntervalMinutes: 360, enabled: true, actorUserId: actorId });
    expect((await listProviderIntegrations())[0].sourceCurrency).toBeNull();
  });

  it("refreshes matching public-table units without guessing one-off packages and preserves the result in public quotes", async () => {
    const integrationId = await addIntegration("active");
    await state.db.update(providerIntegrations).set({ baseUrl: "https://foollo.com/api/v2" }).where(eq(providerIntegrations.id, integrationId));
    const rows = [
      { ...payload[0], service: 1450, name: "مشاركات انستجرام", type: "Default", rate: "32.0562", min: "10", max: "1000000" },
      { ...payload[0], service: 1588, name: "إنشاء موقع إلكتروني", type: "Default", rate: "3000.00", min: "1", max: "1" },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(rows))));
    state.pricing = { currency: "EGP", perThousandEvidenceUrl: null };
    await sync();
    expect((await state.db.select().from(serviceRecords)).every((row: any) => row.sourcePriceUnit === null)).toBe(true);
    state.pricing = { ...state.pricing, perThousandRows: { url: "https://foollo.com/en/services", names: Object.fromEntries(rows.map(row => [String(row.service), serviceNameFingerprint(row.name)])) } };
    await sync();
    await state.db.update(providerRecords).set({ apiCataloguePublished: true }).where(eq(providerRecords.id, providerId));
    const listed = (await getMarketplaceSnapshot({ scope: "services" })).services;
    const quantityService = listed.find(row => row.sourceRate === "32.0562")!;
    const oneOff = listed.find(row => row.sourceRate === "3000.00")!;
    expect(quantityService).toMatchObject({ priceCurrency: "EGP", priceUnit: "per_1000" });
    expect(quantityQuoteExact(quantityService, 500)).toBe("16.0281");
    expect(oneOff).toMatchObject({ priceCurrency: "EGP", priceUnit: null });
    expect(quantityQuoteExact(oneOff, 1)).toBeNull();
    const original = (await state.db.select().from(serviceRecords)).find((row: any) => row.externalId === "1450");
    expect(original).toMatchObject({ sourcePricingMode: "auto", sourcePricingEvidenceUrl: "https://foollo.com/en/services", pricingConfirmed: false, reviewStatus: "pending" });
    // A replaced service with the same ID cannot inherit the old row's evidence.
    rows[0]!.name = "خدمة مختلفة";
    await sync();
    expect((await getServiceReview(original.id)).service.sourcePriceUnit).toBeNull();
  });

  it("confirms source units with permission and audit, invalidates cache and leaves quality approval untouched", async () => {
    const [source] = await importUsdSource();
    expect(source.sourcePriceUnit).toBeNull();
    const filter = {scope:"services" as const,priceCurrency:"USD" as const,priceUnit:"per_1000" as const,sort:"price" as const};
    expect((await getCachedMarketplaceSnapshot(filter)).services).toHaveLength(0);
    const caller = appRouter.createCaller({user:{id:actorId,openId:"catalogue-test-owner",role:"admin",email:null},req:{headers:{},ip:"127.0.0.1"},res:{}} as any);
    await caller.admin.services.confirmSourcePricing({...unitEvidence,items:[{id:source.id,revision:source.revision}]});
    const detail = await getServiceReview(source.id);
    expect(detail.service).toMatchObject({sourcePriceUnit:"per_1000",sourceCurrency:"USD",sourceRate:"1.00",priceUnit:null,pricingConfirmed:false,policyReviewed:false,reviewStatus:"pending",status:"draft",revision:source.revision+1});
    const page = await getCachedMarketplaceSnapshot(filter);
    expect(page.services).toHaveLength(1);
    expect(quantityQuoteExact(page.services[0]!,500)).toBe("0.50");
    const audit = await state.db.select().from(auditEntries).where(eq(auditEntries.action,"service.source_pricing.confirm"));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({actorUserId:actorId,entityId:String(source.id)});
    expect(audit[0].metadata).toMatchObject({reason:unitEvidence.reason,before:{sourcePriceUnit:null},after:{sourcePriceUnit:"per_1000"}});
    await caller.admin.services.confirmSourcePricing({...unitEvidence,unit:null,evidenceUrl:null,items:[{id:source.id,revision:detail.service.revision}]});
    expect((await getCachedMarketplaceSnapshot(filter)).services).toHaveLength(0);
    expect((await getMarketplaceSnapshot({scope:"services"})).services[0]).toMatchObject({sourceRate:"1.00",priceCurrency:"USD",priceUnit:null});
  });
  it("rejects unauthorized confirmations, unknown currencies, and stale mixed batches atomically", async () => {
    const rows = await importUsdSource([payload[0],{...payload[0],service:101}]);
    const items = rows.map((row:any)=>({id:row.id,revision:row.revision}));
    const caller = appRouter.createCaller({user:{id:0,openId:"ordinary-test-user",role:"user",email:null},req:{headers:{}},res:{}} as any);
    await expect(caller.admin.services.confirmSourcePricing({...unitEvidence,items})).rejects.toMatchObject({code:"FORBIDDEN"});
    await expect(confirmSourcePricing({...unitEvidence,items:[items[0],{...items[1],revision:999}],actorUserId:actorId})).rejects.toMatchObject({code:"CONFLICT"});
    expect((await getServiceReview(rows[0].id)).service.sourcePriceUnit).toBeNull();
    await state.db.update(serviceRecords).set({sourceCurrency:null}).where(eq(serviceRecords.id,rows[1].id));
    await expect(confirmSourcePricing({...unitEvidence,items,actorUserId:actorId})).rejects.toMatchObject({message:"review_not_ready"});
    expect((await getServiceReview(rows[0].id)).service.sourcePriceUnit).toBeNull();
    expect(await state.db.select().from(auditEntries).where(eq(auditEntries.action,"service.source_pricing.confirm"))).toHaveLength(0);
  });
  it("retains checked source units and exact snapshots on price changes, but revokes them on service redefinition", async () => {
    const [source] = await importUsdSource();
    await confirmSourcePricing({...unitEvidence,items:[{id:source.id,revision:source.revision}],actorUserId:actorId});
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify([{...payload[0],rate:"2.0123456",max:"10000"}]),{status:200})));
    await sync();
    let detail = await getServiceReview(source.id);
    expect(detail.service).toMatchObject({sourcePriceUnit:"per_1000",sourceCurrency:"USD",sourceRate:"2.0123456",pricingConfirmed:false});
    expect(detail.prices[0]).toMatchObject({kind:"source",sourceRate:"2.0123456",priceCurrency:"USD",priceUnit:"per_1000"});
    expect(quantityQuoteExact((await getMarketplaceSnapshot({scope:"services"})).services[0]!,5000)).toBe("10.061728");
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify([{...payload[0],rate:"2.012345600000000001",max:"10000"}]),{status:200})));
    await sync();
    expect((await getServiceReview(source.id)).prices[0]).toMatchObject({sourceRate:"2.012345600000000001",priceUnit:"per_1000"});
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify([{...payload[0],name:"TikTok custom package",rate:"2.0123456"}]),{status:200})));
    await sync();
    detail = await getServiceReview(source.id);
    expect(detail.service).toMatchObject({sourcePriceUnit:null,sourcePricingIdentity:null,sourcePricingConfirmedAt:null});
    expect(quantityQuoteExact((await getMarketplaceSnapshot({scope:"services"})).services[0]!,500)).toBeNull();
  });
  it("sorts and paginates original rates beyond floating-point precision and filters actual order limits", async () => {
    const rows = await importUsdSource([
      {...payload[0],service:100,rate:"1.000000000000000002",min:"100",max:"1000"},
      {...payload[0],service:101,rate:"1.000000000000000001",min:"10",max:"10000"},
      {...payload[0],service:102,rate:"1.000000000000000003",min:"500",max:"1000"},
    ]);
    await confirmSourcePricing({...unitEvidence,items:rows.map((row:any)=>({id:row.id,revision:row.revision})),actorUserId:actorId});
    const filter={scope:"services" as const,sort:"price" as const,priceCurrency:"USD" as const,priceUnit:"per_1000" as const,limit:1};
    const first = await getMarketplaceSnapshot(filter);
    expect(first.services[0]?.sourceServiceId).toBe("101");
    expect(typeof first.pagination.nextCursor?.rank).toBe("string");
    const second=await getMarketplaceSnapshot({...filter,cursor:first.pagination.nextCursor!});
    expect(second.services[0]?.sourceServiceId).toBe("100");
    const third=await getMarketplaceSnapshot({...filter,cursor:second.pagination.nextCursor!});
    expect(third.services[0]?.sourceServiceId).toBe("102");
    expect(third.pagination.nextCursor).toBeNull();
    const matching=await getMarketplaceSnapshot({...filter,limit:25,quantity:5000});
    expect(matching.pagination.total).toBe(1);
    expect(matching.services[0]?.sourceServiceId).toBe("101");
    expect((await getMarketplaceSnapshot({...filter,quantity:5})).pagination.total).toBe(0);
    expect((await getMarketplaceSnapshot({...filter,priceCurrency:"EUR"})).pagination.total).toBe(0);
    expect((await getMarketplaceSnapshot({...filter,priceUnit:"per_item"})).pagination.total).toBe(0);
  });
  it("keeps rejected, quarantined, paused and missing API rows out of the source catalogue", async () => {
    await state.db.update(providerRecords).set({apiCataloguePublished: true}).where(eq(providerRecords.id, providerId));
    await addIntegration("active"); await sync();
    const [stored] = await state.db.select().from(serviceRecords);
    for (const blocked of [{reviewStatus:"changes_requested"}, {available:false}, {status:"paused"}, {status:"archived"}, {sourceRate:"invalid"}, {sourceRate:"0"}, {sourceKind:"legacy"}, {sourceUpdatedAt:null}, {minOrder:0}]) {
      await state.db.update(serviceRecords).set({reviewStatus:"pending",available:true,status:"draft",sourceRate:"1.00",sourceKind:"provider_api",sourceUpdatedAt:new Date(),minOrder:100,...blocked}).where(eq(serviceRecords.id, stored.id));
      expect((await getMarketplaceSnapshot({scope:"services",market:"smm"})).services).toHaveLength(0);
    }
    await state.db.update(serviceRecords).set({reviewStatus:"changes_requested",reviewReason:"Owner withdrew this listing",available:true,status:"draft",sourceRate:"1.00",sourceKind:"provider_api",sourceUpdatedAt:new Date(),minOrder:100}).where(eq(serviceRecords.id,stored.id));
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify([{...payload[0],rate:"2.50"}]),{status:200})));
    await sync();
    const reviewed=await getServiceReview(stored.id);
    expect(reviewed.service).toMatchObject({reviewStatus:"changes_requested",reviewReason:"Owner withdrew this listing",sourceRate:"2.50"});
    expect((await getMarketplaceSnapshot({scope:"services",market:"smm"})).services).toHaveLength(0);
  });
  it("removes only original demo records, cascades their offers and retains an audit", async () => {
    const [demo] = await state.db.insert(providerRecords).values({slug: "northstar-social", name: "Northstar Social", initials: "NS"}).$returningId();
    await addService("draft", demo.id);
    const [official] = await state.db.insert(providerRecords).values({slug: "pulse-media-lab", name: "Official source fixture", initials: "OS", websiteUrl: "https://official.example"}).$returningId();
    const [connected] = await state.db.insert(providerRecords).values({slug: "sociaflow", name: "Connected source fixture", initials: "CS"}).$returningId();
    await state.db.insert(providerIntegrations).values({providerId: connected.id, name: "Existing connection", baseUrl: "https://connected.example/api"});
    const [sourced] = await state.db.insert(providerRecords).values({slug: "apex-smm", name: "Reviewed source fixture", initials: "RS"}).$returningId();
    const sourceId = await addService("draft", sourced.id);
    await state.db.update(serviceRecords).set({sourceKind: "public_web"}).where(eq(serviceRecords.id, sourceId));
    const original = await addService();
    const statements = readFileSync("drizzle/0009_remove_demo_catalogue.sql", "utf8").split("--> statement-breakpoint").map(v => v.trim()).filter(Boolean);
    for (let attempt = 0; attempt < 2; attempt++) await state.db.transaction(async (tx: any) => { for (const statement of statements) await tx.execute(sql.raw(statement)); });
    const rows = await state.db.select().from(providerRecords);
    expect(rows.map((row: any) => row.id).sort()).toEqual([providerId, official.id, connected.id, sourced.id].sort());
    expect(await state.db.select().from(serviceRecords).where(eq(serviceRecords.providerId, demo.id))).toHaveLength(0);
    expect((await getServiceReview(original)).service.providerId).toBe(providerId);
    const entries = await state.db.select().from(auditEntries).where(eq(auditEntries.action, "marketplace.demo.remove"));
    expect(entries).toHaveLength(1); expect(entries[0].metadata).toMatchObject({slug: "northstar-social", servicesRemoved: 1});
  });
  it("invalidates a warm public catalogue after an authorized publication change", async () => {
    await addService();
    expect((await getCachedMarketplaceSnapshot({ scope: "services" })).services).toHaveLength(1);
    const caller = appRouter.createCaller({user: {id: actorId, openId: "catalogue-test-owner", role: "admin", email: null}, req: {headers: {}}, res: {}} as any);
    await caller.admin.providers.setStatus({id: providerId, status: "suspended"});
    expect((await getCachedMarketplaceSnapshot({ scope: "services" })).services).toHaveLength(0);
  });
  it("does not load retained API payloads or turn unknown metadata into strings", async () => {
    const id = await addService();
    await state.db.update(serviceRecords).set({sourceKind: "public_web", sourceData: {nameAr: null, terms: null, sourceServiceId: 123, scopeAr: "وصف حقيقي", payload: "x".repeat(200000)}, originalSourceData: {payload: "x".repeat(200000)}}).where(eq(serviceRecords.id, id));
    const result = await getMarketplaceSnapshot({scope: "services"});
    expect(result.services[0]).toMatchObject({nameAr: null, terms: null, sourceServiceId: null, packageDescriptionAr: "وصف حقيقي"});
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(5000);
  });
  it("public-source offers require the existing review gates and expose evidence after publication", async () => {
    const { created: [id] } = await createWebDraft();
    const detail = await getServiceReview(id!);
    expect(detail.service).toMatchObject({ sourceKind: "public_web", status: "draft", pricingConfirmed: false, policyReviewed: false });
    expect((await getMarketplaceSnapshot({ scope: "services" })).services).toHaveLength(0);
    await expect(applyServiceReview({ items: [{ id: id!, revision: 1 }], action: "approve", reason: "Must still pass review", actorUserId: actorId })).rejects.toThrow("review_not_ready");
    const edited = await editServiceReview({ id: id!, revision: 1, platform: "Instagram", category: "Content creation", countryCode: null, price: 99, priceCurrency: "USD", priceUnit: "package", packageDescription: webOffer.scope, minOrder: 1, maxOrder: 1, refillMode: "unknown", refillDays: null, evidenceUrl: webOffer.sourceUrl, pricingConfirmed: true, policyReviewed: true, reason: "Fixture pricing and content scope reviewed", actorUserId: actorId });
    await applyServiceReview({ items: [{ id: id!, revision: edited.revision }], action: "approve", reason: "Fixture approval", actorUserId: actorId });
    await applyServiceReview({ items: [{ id: id!, revision: edited.revision + 1 }], action: "publish", reason: "Fixture publication", actorUserId: actorId });
    const [offer] = (await getMarketplaceSnapshot({ scope: "services" })).services;
    expect(offer).toMatchObject({ billingCycle: "monthly", priceAmount: 99, sourceUrl: webOffer.sourceUrl, nameAr: webOffer.nameAr, termsAr: webOffer.termsAr });
    expect(offer).not.toHaveProperty("sourceData");
    const again = await createWebDraft(); expect(again).toEqual({ created: [], skipped: [id] });
    expect((await getServiceReview(id!)).service.revision).toBe(4);
    await sync();
    expect((await getServiceReview(id!)).service).toMatchObject({ available: true, status: "active", reviewStatus: "approved" });
  });
  it("rejects an unrelated public-source host without creating offers", async () => {
    await state.db.update(providerRecords).set({ websiteUrl: "https://unrelated.example" }).where(eq(providerRecords.id, providerId));
    await expect(createSourcedDrafts({ providerId, offers: [webOffer], reason: "Invalid fixture evidence host", actorUserId: actorId })).rejects.toThrow("official website");
    expect(await state.db.select().from(serviceRecords)).toHaveLength(0);
  });
  it("keeps SMM source units and terms, requires review, and separates published markets in service and provider queries", async () => {
    await state.db.update(providerRecords).set({ websiteUrl: "https://provider.example" }).where(eq(providerRecords.id, providerId));
    const offer = { ...webOffer, slug: "smm-followers", name: "Instagram Followers", category: "Followers" as const, unit: "per_1000" as const, price: .044, minOrder: 50, maxOrder: 200000, refillMode: "manual" as const, refillDays: 30, sourceServiceId: "18", countryCode: "WW", startMinutesMin: 0, startMinutesMax: 5 };
    const { created: [id] } = await createSourcedDrafts({ providerId, offers: [offer], reason: "Wholesale fixture extraction", actorUserId: actorId });
    expect((await getServiceReview(id!)).service).toMatchObject({ priceUnit: "per_1000", priceAmount: "0.0440", minOrder: 50, maxOrder: 200000, refillMode: "manual", refillDays: 30, startMinutesMax: 5, pricingConfirmed: false });
    expect((await getMarketplaceSnapshot({ scope: "services", market: "smm" })).services).toHaveLength(0);
    const edited = await editServiceReview({ id: id!, revision: 1, platform: "Instagram", category: "Followers", countryCode: "WW", price: .044, priceCurrency: "USD", priceUnit: "per_1000", minOrder: 50, maxOrder: 200000, refillMode: "manual", refillDays: 30, evidenceUrl: offer.sourceUrl, pricingConfirmed: true, policyReviewed: true, reason: "Fixture source details reviewed", actorUserId: actorId });
    await applyServiceReview({ items: [{ id: id!, revision: edited.revision }], action: "approve", reason: "Fixture wholesale approval", actorUserId: actorId });
    await applyServiceReview({ items: [{ id: id!, revision: edited.revision + 1 }], action: "publish", reason: "Fixture wholesale publication", actorUserId: actorId });
    const published = await getMarketplaceSnapshot({ scope: "services", market: "smm", category: "Followers" });
    expect(published.pagination.total).toBe(1); expect(published.services[0]).toMatchObject({ sourceServiceId: "18", billingCycle: null, startTime: "0–5 min", min: 50 });
    expect((await getMarketplaceSnapshot({ scope: "services", market: "packages" })).services).toHaveLength(0);
    expect((await getMarketplaceSnapshot({ scope: "services", market: "smm", category: "Likes" })).services).toHaveLength(0);
    expect((await getMarketplaceSnapshot({ scope: "providers", market: "smm" })).pagination.total).toBe(1);
    expect((await getMarketplaceSnapshot({ scope: "providers", market: "packages" })).providers).toHaveLength(0);
  });
  it("rolls back public-source drafts if audit logging fails", async () => {
    await state.db.update(providerRecords).set({ websiteUrl: "https://provider.example" }).where(eq(providerRecords.id, providerId));
    await expect(createSourcedDrafts({ providerId, offers: [webOffer], reason: "Audit rollback fixture", actorUserId: 2147483647 })).rejects.toThrow();
    expect(await state.db.select().from(serviceRecords)).toHaveLength(0);
  });
  it("suspending a provider removes its offers while leaving other providers visible", async () => {
    const [other] = await state.db.insert(providerRecords).values({ slug: "other-provider", name: "Other provider", initials: "OP", status: "active" }).$returningId();
    await addService(); await addService("active", other.id);
    await updateProviderStatus({ id: providerId, status: "suspended", actorUserId: actorId });
    const snapshot = await getMarketplaceSnapshot({ scope: "services" });
    expect(snapshot.providers.map(p => p.id)).toEqual([`provider-${other.id}`]);
    expect(snapshot.services.map(s => s.providerId)).toEqual([`provider-${other.id}`]);
  });
  it("keeps an empty catalogue empty after all providers are suspended", async () => {
    await updateProviderStatus({ id: providerId, status: "suspended", actorUserId: actorId });
    expect(await getMarketplaceSnapshot({ scope: "services" })).toEqual({ providers: [], services: [], source: "database", pagination: { total: 0, nextCursor: null } });
  });
  it("provides unique comparison IDs across identical provider-local IDs and no invented evidence", async () => {
    const [other] = await state.db.insert(providerRecords).values({ slug: "other-provider", name: "Other provider", initials: "OP", status: "active" }).$returningId();
    await addService(); await addService("active", other.id);
    const snapshot = await getMarketplaceSnapshot({ scope: "services" });
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
    await expect(updateServiceRecord({ id, priceAmount: 2, actorUserId: missingActorId })).rejects.toThrow();
    const [provider] = await state.db.select().from(providerRecords).where(eq(providerRecords.id, providerId));
    const [service] = await state.db.select().from(serviceRecords).where(eq(serviceRecords.id, id));
    expect(provider.status).toBe("active"); expect(service.priceAmount).toBe("1.0000");
  });
  it("a disabled manual test stays disabled and imports only drafts", async () => {
    const id = await addIntegration(); await sync();
    const [integration] = await state.db.select().from(providerIntegrations).where(eq(providerIntegrations.id, id));
    expect(integration.status).toBe("disabled"); expect(integration.nextSyncAt).toBeNull();
    const rows = await state.db.select().from(serviceRecords);
    expect(rows).toHaveLength(1); expect(rows[0].status).toBe("draft");
    expect((await getMarketplaceSnapshot({ scope: "services" })).services).toEqual([]);
    await expect(updateServiceRecord({ id: rows[0].id, status: "active", actorUserId: actorId })).rejects.toThrow("review and publication");
    await prepareAndPublish(rows[0].id);
    expect((await getMarketplaceSnapshot({ scope: "services" })).services).toHaveLength(1);
  });
  it("preserves reviewed per-item pricing on unchanged source and records a source change separately", async () => {
    await sync(); const [original] = await state.db.select().from(serviceRecords);
    const result = await editServiceReview({ id: original.id, revision: original.revision, platform: "Website", category: "SEO", countryCode: "US",
      price: 0.001, priceCurrency: "EUR", priceUnit: "per_item", packageDescription: null,
      minOrder: 1, maxOrder: 1000, refillMode: "none", refillDays: null,
      evidenceUrl: "https://provider.example/seo", pricingConfirmed: true, policyReviewed: true,
      reason: "Fixture service-specific rate conversion evidence", actorUserId: actorId });
    await applyServiceReview({items: [{id: original.id, revision: result.revision}], action: "approve", reason: "Fixture evidence verified", actorUserId: actorId});
    const detail = await getServiceReview(original.id);
    await applyServiceReview({items: [{id: original.id, revision: detail.service.revision}], action: "publish", reason: "Fixture reviewed publication", actorUserId: actorId});
    const published = await getServiceReview(original.id);
    await sync();
    const unchanged = await getServiceReview(original.id);
    expect(unchanged.service).toMatchObject({priceAmount: "0.0010", sourceRate: String(payload[0].rate), priceCurrency: "EUR", priceUnit: "per_item", status: "active", platform: "Website", category: "SEO", revision: published.service.revision});
    expect(unchanged.prices).toHaveLength(2);
    expect(unchanged.prices[0]).toMatchObject({kind: "review", priceCurrency: "EUR", priceUnit: "per_item", priceAmount: "0.0010"});
    expect(unchanged.prices[1]).toMatchObject({kind: "source", priceCurrency: null, priceUnit: null, sourceRate: String(payload[0].rate)});
    const eur = await getMarketplaceSnapshot({scope: "services", sort: "price", priceCurrency: "EUR", priceUnit: "per_item"});
    expect(eur.services[0]).toMatchObject({priceAmount: 0.001, priceCurrency: "EUR", priceUnit: "per_item"});
    expect((await getMarketplaceSnapshot({scope: "services", sort: "price", priceCurrency: "USD", priceUnit: "per_1000"})).services).toHaveLength(0);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{...payload[0], rate: "2.00"}])))); await sync();
    const changed = await getServiceReview(original.id);
    expect(changed.service).toMatchObject({priceAmount: "2.0000", sourceRate: "2.00", priceCurrency: null, priceUnit: null, status: "draft", pricingConfirmed: false});
    expect(changed.prices[0]).toMatchObject({kind: "source", sourceRate: "2.00", priceCurrency: null});
    expect(changed.prices[1]).toMatchObject({kind: "review", priceCurrency: "EUR", priceUnit: "per_item"});
  });
  it("resumes staged rows from the previous price schema", async () => {
    await sync();
    const [connection] = await state.db.select().from(providerIntegrations);
    const queued = await syncStoredIntegration({id: connection.id, actorUserId: actorId});
    await runProviderSyncStep();
    const staged = await state.db.select().from(providerSyncRows).where(eq(providerSyncRows.jobId, queued.jobId!));
    for (const row of staged) {
      const old = {...row.payload} as Record<string, unknown>;
      old.pricePerThousandUsd = old.priceAmount; delete old.priceAmount; delete old.sourceRate;
      await state.db.update(providerSyncRows).set({payload: old}).where(and(eq(providerSyncRows.jobId, row.jobId), eq(providerSyncRows.ordinal, row.ordinal)));
    }
    expect((await finishJob(queued.jobId!)).status).toBe("completed");
    expect((await state.db.select().from(serviceRecords))[0].sourceRate).toBe(String(payload[0].rate));
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
    expect(row.status).toBe("draft"); expect(row.priceAmount).toBe("2.0000");
    expect((await getMarketplaceSnapshot({ scope: "services" })).services).toEqual([]);
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
    expect((await getMarketplaceSnapshot({ scope: "services" })).services).toHaveLength(0);
    vi.stubGlobal("fetch", vi.fn(async () => response())); await sync();
    expect((await getServiceReview(first.id)).service).toMatchObject({ available: true, reviewStatus: "pending", pricingConfirmed: false });
    expect(await state.db.select().from(priceSnapshots)).toHaveLength(3);
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
    const [snapshots] = await state.db.select({ n: sql<number>`count(*)` }).from(priceSnapshots); expect(Number(snapshots.n)).toBe(5003);
    expect((await getMarketplaceSnapshot({ scope: "services" })).services).toHaveLength(0);
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
    expect(previous).toMatchObject({ minOrder: 100, priceAmount: "1.0000", status: "draft", reviewStatus: "changes_requested", pricingConfirmed: false, incomplete: true, available: true });
    expect((await listAdminServices()).total).toBe(2);
    expect((await getMarketplaceSnapshot({ scope: "services" })).services).toHaveLength(0);
    await cleanupProviderSyncSnapshots(); await cleanupProviderSyncSnapshots();
    const issues = await listProviderSyncIssues({ jobId: result.id });
    expect(issues.items).toHaveLength(2);
    expect(issues.items[0]).toMatchObject({ externalId: "100", min: "0", problems: ["invalid_minimum"] });
    expect(issues.items[1]).toMatchObject({ externalId: "200", rate: "0", problems: ["invalid_price"] });
    const retained = await state.db.select().from(providerSyncRows).where(eq(providerSyncRows.jobId, result.id));
    expect(retained).toHaveLength(2); expect(JSON.stringify(retained)).not.toContain("never-retain-this-key");
    expect(await state.db.select().from(priceSnapshots)).toHaveLength(3);
  });
  it("rejects an entirely invalid catalogue without replacing stored values", async () => {
    await sync(); const [old] = await state.db.select().from(serviceRecords);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ ...payload[0], rate: "0" }]))));
    await expect(sync()).rejects.toThrow("All 1 source services");
    expect((await getServiceReview(old.id)).service).toMatchObject({ priceAmount: "1.0000", revision: 1, available: true });
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
      { key: "currency", patch: { priceCurrency: null }, needs: ["pricing_unconfirmed"] },
      { key: "invalid-currency", patch: { priceCurrency: "ZZZ" }, needs: ["pricing_unconfirmed"] },
      { key: "unit", patch: { priceUnit: null }, needs: ["pricing_unconfirmed"] },
      { key: "package", patch: { priceUnit: "package", packageDescription: "  " }, needs: ["pricing_unconfirmed"] },
      { key: "pricing", patch: { pricingConfirmed: false }, needs: ["pricing_unconfirmed"] },
      { key: "policy", patch: { policyReviewed: false }, needs: ["policy_check"] },
      { key: "no-evidence", patch: { evidenceUrl: null }, needs: ["evidence_missing"] },
      { key: "empty-evidence", patch: { evidenceUrl: "" }, needs: ["evidence_missing"] },
      { key: "platform", patch: { platform: "Unknown" }, needs: ["classification"] },
      { key: "platform-case", patch: { platform: "tiktok" }, needs: ["classification"] },
      { key: "category", patch: { category: "Other" }, needs: ["classification"] },
      { key: "category-case", patch: { category: "views" }, needs: ["classification"] },
      { key: "legacy", patch: { normalizationVersion: 0 }, needs: ["classification"] },
      { key: "price", patch: { priceAmount: "0.0000" }, needs: ["invalid_values"] },
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
      platform: "TikTok", category: "Views", priceAmount: "1.0000", minOrder: 100, maxOrder: 1000,
      status: "draft", reviewStatus: "pending", normalizationVersion: 1, incomplete: false,
      pricingConfirmed: true, priceCurrency: "USD", priceUnit: "per_1000", policyReviewed: true, evidenceUrl: "https://provider.example/services", sourceUpdatedAt: new Date(),
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
      platform: "Website", category: "Website traffic", priceAmount: "1.0000", minOrder: 1, maxOrder: 1000,
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
  it("keeps payloads bounded across a 100,000-service catalogue and excludes unpublished providers", async () => {
    const size = 100_000;
    for (let start = 0; start < size; start += 500) {
      await state.db.insert(serviceRecords).values(Array.from({ length: 500 }, (_, offset) => {
        const n = start + offset;
        return { providerId, slug: `bulk-${n}`, name: `Campaign service ${n}`, platform: n % 2 ? "TikTok" : "Instagram", category: "Campaigns",
          priceAmount: "1.0000", minOrder: 10, maxOrder: 1000, status: "active", reviewStatus: "approved", incomplete: false, normalizationVersion: 1, pricingConfirmed: true, priceCurrency: "USD", priceUnit: "per_1000", policyReviewed: true, evidenceUrl: "https://provider.example/services", sourceUpdatedAt: new Date(), retentionBasisPoints: n % 2 ? null : 9500 };
      }));
    }
    const timings: Record<string, number> = {};
    async function measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
      const start = performance.now(); const result = await operation(); timings[name] = Math.round(performance.now() - start); return result;
    }
    const first = await measure("admin_page_ms", () => listAdminServices());
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
    const publicPage = await measure("public_page_ms", () => getMarketplaceSnapshot({ scope: "services" }));
    expect(publicPage.source).toBe("database"); expect(publicPage.services).toHaveLength(25);
    expect(publicPage.pagination.total).toBe(size); expect(publicPage.providers[0]?.activeServicesCount).toBe(size);
    const comparison = await getMarketplaceSnapshot({ scope: "compare", ids: [first.items.at(-1)!.id] });
    expect(comparison.services.map(item => item.id)).toEqual([`service-${first.items.at(-1)!.id}`]);
    const profile = await getMarketplaceSnapshot({ scope: "provider", slug: "test-provider" });
    expect(profile.services).toHaveLength(25); expect(profile.pagination.nextCursor).not.toBeNull();
    for (const sort of ["recommended", "price", "retention"] as const) {
      const page = await getMarketplaceSnapshot({ scope: "services", sort, priceCurrency: "USD", priceUnit: "per_1000" });
      const after = await getMarketplaceSnapshot({ scope: "services", sort, priceCurrency: "USD", priceUnit: "per_1000", cursor: page.pagination.nextCursor! });
      const ids = new Set(page.services.map(item => item.id));
      expect(after.services).toHaveLength(25); expect(after.services.some(item => ids.has(item.id))).toBe(false);
    }
    const concurrent = await measure("cold_100_readers_ms", () => Promise.all(Array.from({length: 100}, () => getCachedMarketplaceSnapshot({scope: "services"}))));
    expect(concurrent.every(result => result.pagination.total === size && result.services.length === 25)).toBe(true);
    await measure("warm_100_readers_ms", () => Promise.all(Array.from({length: 100}, () => getCachedMarketplaceSnapshot({scope: "services"}))));
    expect(Buffer.byteLength(JSON.stringify(publicPage))).toBeLessThan(40_000);
    for (const name of ["admin_page_ms", "public_page_ms", "cold_100_readers_ms"]) expect(timings[name]).toBeLessThan(2500);
    expect(timings.warm_100_readers_ms).toBeLessThan(500);
    console.log("CATALOGUE_SCALE_RESULT", JSON.stringify({services: size, simultaneousReaders: 100, publicBytes: Buffer.byteLength(JSON.stringify(publicPage)), ...timings}));
    await state.db.insert(providerRecords).values(Array.from({length: 1000}, (_, n) => ({slug: `scale-provider-${n}`, name: `Scale provider ${n}`, initials: "SP", websiteUrl: "https://scale.example"})));
    const providersPage = await listAdminProviderPage(); expect(providersPage.total).toBe(1001); expect(providersPage.items).toHaveLength(25);
    const providerNext = await listAdminProviderPage({cursor: providersPage.nextCursor!});
    expect(providerNext.items.every(provider => provider.id < providersPage.items.at(-1)!.id)).toBe(true);
    expect((await listAdminProviders({q: "Scale provider 999"})).map(provider => provider.name)).toEqual(["Scale provider 999"]);
    expect(await listAdminProviders({limit: 50, includeId: providerId})).toHaveLength(50);
    expect((await listAdminProviders({limit: 50, includeId: providerId}))[0]?.id).toBe(providerId);
    const apiIntegration = await addIntegration("active");
    await state.db.update(providerIntegrations).set({lastSyncedAt:new Date()}).where(eq(providerIntegrations.id,apiIntegration));
    await state.db.update(providerRecords).set({apiCataloguePublished:true}).where(eq(providerRecords.id,providerId));
    await state.db.update(serviceRecords).set({externalId:sql`cast(${serviceRecords.id} as char)`,sourceKind:"provider_api",sourceRate:"1.0123456",status:"draft",reviewStatus:"pending",pricingConfirmed:false,priceCurrency:null,priceUnit:null,policyReviewed:false,incomplete:true}).where(eq(serviceRecords.providerId,providerId));
    invalidateCatalogueCaches();
    const apiPage = await measure("api_catalogue_page_ms",()=>getMarketplaceSnapshot({scope:"services",market:"smm"}));
    expect(apiPage.pagination.total).toBe(size); expect(apiPage.services).toHaveLength(25);
    expect(apiPage.services.every(service=>service.catalogueListing==="api_source" && service.sourceRate==="1.0123456")).toBe(true);
    const apiReaders = await measure("api_catalogue_100_readers_ms",()=>Promise.all(Array.from({length:100},()=>getCachedMarketplaceSnapshot({scope:"services",market:"smm"}))));
    expect(apiReaders.every(page=>page.pagination.total===size && page.services.length===25)).toBe(true);
    expect(timings.api_catalogue_page_ms).toBeLessThan(2500); expect(timings.api_catalogue_100_readers_ms).toBeLessThan(2500);
    expect(Buffer.byteLength(JSON.stringify(apiPage))).toBeLessThan(40000);
    console.log("API_CATALOGUE_SCALE_RESULT",JSON.stringify({services:size,simultaneousReaders:100,publicBytes:Buffer.byteLength(JSON.stringify(apiPage)),api_page_ms:timings.api_catalogue_page_ms,api_100_readers_ms:timings.api_catalogue_100_readers_ms}));
    // Evidence is synthetic only inside this isolated performance fixture.
    await state.db.update(serviceRecords).set({sourceCurrency:"USD",sourcePriceUnit:"per_1000",sourcePricingEvidenceUrl:"https://provider.example/services",sourcePricingConfirmedAt:new Date(),sourcePricingIdentity:"fixture"}).where(eq(serviceRecords.providerId,providerId));
    const pricePage=await measure("api_price_quantity_page_ms",()=>getMarketplaceSnapshot({scope:"services",market:"smm",priceCurrency:"USD",priceUnit:"per_1000",sort:"price",quantity:500}));
    expect(pricePage.pagination.total).toBe(size); expect(pricePage.services).toHaveLength(25);
    expect(quantityQuoteExact(pricePage.services[0]!,500)).toBe("0.5061728");
    expect(timings.api_price_quantity_page_ms).toBeLessThan(2500);
    console.log("API_PRICE_SCALE_RESULT",JSON.stringify({services:size,pageSize:25,quantity:500,pricePageMs:timings.api_price_quantity_page_ms}));
    await state.db.update(providerRecords).set({ status: "draft" }).where(eq(providerRecords.id, providerId));
    const stats = await getAdminOverview(rolePermissions.catalogue_editor);
    expect(stats).toMatchObject({ totalServices: size, publishedServices: 0, teamMembers: null, recordedActions: null });
    expect((await getMarketplaceSnapshot({ scope: "services" })).services).toEqual([]);
    expect((await getMarketplaceSnapshot({ scope: "compare", ids: [first.items[0]!.id] })).services).toEqual([]);
    expect((await listAdminServices()).total).toBe(size);
  }, 120_000);

});
