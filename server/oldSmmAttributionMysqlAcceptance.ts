import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auditEntries, priceSnapshots, providerIntegrations, providerRecords, providerSyncJobs, serviceRecords } from "../drizzle/schema";
import { repairOldSmmAttribution } from "./oldSmmAttributionRepair";
import { getProviderSourceIdentity } from "./providerSourceIdentity";
import { saveProviderIntegration } from "./vaultDb";

export function oldSmmAttributionAcceptanceCases(database: () => any, providerId: () => number, actorId: () => number, addIntegration: () => Promise<number>) {
  async function fixture() {
    const db = database();
    await db.update(providerRecords).set({ slug: "justanotherpanel", name: "JustAnotherPanel", websiteUrl: "https://justanotherpanel.com/" }).where(eq(providerRecords.id, providerId()));
    const connectionId = await addIntegration();
    await db.update(providerIntegrations).set({ baseUrl: "https://oldsmm.com/api/v2" }).where(eq(providerIntegrations.id, connectionId));
    const [job] = await db.insert(providerSyncJobs).values({ integrationId: connectionId, providerId: providerId(), configFingerprint: "local-retained-source-evidence", sourceUrl: "https://oldsmm.com/api/v2", status: "completed", processedCount: 39, totalCount: 39, finishedAt: new Date() }).$returningId();
    const sourceUpdatedAt = new Date("2026-09-23T04:26:50Z");
    const base = { providerId: providerId(), platform: "TikTok", category: "Views", name: "TikTok Views", priceAmount: "0.1234", sourceRate: "0.1234", sourceCurrency: "USD", sourcePriceUnit: "per_1000", sourceKind: "provider_api", sourceUrl: "https://oldsmm.com/api/v2", sourceUpdatedAt, minOrder: 100, maxOrder: 1000, reviewStatus: "pending" };
    await db.insert(serviceRecords).values(Array.from({ length: 26 }, (_, index) => ({ ...base, externalId: String(index), slug: `retained-old-${index}`, sourceData: { service: String(index), name: "TikTok Views", rate: "0.1234" } })));
    await db.insert(serviceRecords).values({ ...base, externalId: "correct-overlap", slug: "already-correct-jap", sourceUrl: "https://justanotherpanel.com/api/v2" });
    const before = await db.select().from(serviceRecords).orderBy(serviceRecords.id);
    await db.insert(priceSnapshots).values({ serviceId: before[0].id, priceAmount: "0.1234", sourceRate: "0.1234", priceCurrency: "USD", priceUnit: "per_1000", kind: "source", comparisonKey: "retained-history-key" });
    return { connectionId, jobId: job.id, before };
  }
  describe("confirmed OldSMM attribution repair", () => {
    it("separates exactly the proven source once, preserves IDs/history/credentials and keeps the destination private", async () => {
      const { connectionId, jobId, before } = await fixture();
      const db = database();
      const [connectionBefore] = await db.select().from(providerIntegrations).where(eq(providerIntegrations.id, connectionId));
      const historyBefore = await db.select().from(priceSnapshots);
      const results = await Promise.all([repairOldSmmAttribution(), repairOldSmmAttribution()]);
      expect(results.reduce((sum, row) => sum + row.changed, 0)).toBe(26);
      const [target] = await db.select().from(providerRecords).where(eq(providerRecords.slug, "oldsmm"));
      expect(target).toMatchObject({ websiteUrl: "https://oldsmm.com/", status: "draft", verified: false, apiCataloguePublished: false });
      const after = await db.select().from(serviceRecords).orderBy(serviceRecords.id);
      for (let index = 0; index < 26; index++) {
        expect(after[index].providerId).toBe(target.id);
        expect(after[index].revision).toBe(before[index].revision + 1);
        expect({ ...after[index], providerId: before[index].providerId, revision: before[index].revision, updatedAt: before[index].updatedAt }).toEqual(before[index]);
      }
      expect(after[26]).toEqual(before[26]);
      expect(await db.select().from(priceSnapshots)).toEqual(historyBefore);
      const [connectionAfter] = await db.select().from(providerIntegrations).where(eq(providerIntegrations.id, connectionId));
      expect(connectionAfter).toMatchObject({ id: connectionId, providerId: target.id, status: "disabled", nextSyncAt: null });
      expect({ ...connectionAfter, providerId: connectionBefore.providerId, updatedAt: connectionBefore.updatedAt }).toEqual(connectionBefore);
      expect((await db.select().from(providerSyncJobs).where(eq(providerSyncJobs.id, jobId)))[0].providerId).toBe(providerId());
      const audits = await db.select().from(auditEntries).where(eq(auditEntries.action, "integration.source_attribution.repair"));
      expect(audits).toHaveLength(1);
      expect(audits[0].metadata).toMatchObject({ fromProviderId: providerId(), toProviderId: target.id, serviceIds: before.slice(0, 26).map((row: any) => row.id), connectionEnabled: false });
      expect(JSON.stringify(audits)).not.toMatch(/credential|local-test-key/);
      expect((await getProviderSourceIdentity(providerId())).sources.map(row => row.host)).toEqual(["justanotherpanel.com"]);
      expect((await getProviderSourceIdentity(target.id)).sources).toMatchObject([{ host: "oldsmm.com", count: 26, matchesWebsite: true }]);
      await expect(saveProviderIntegration({ id: connectionId, providerId: providerId(), name: "Attempt reassignment", baseUrl: connectionAfter.baseUrl, syncIntervalMinutes: 360, enabled: false, actorUserId: actorId() })).rejects.toThrow("cannot be moved");
    });
    it.each(["count", "review", "active", "job", "website", "evidence"])("leaves all records and credentials unchanged when %s evidence no longer matches", async condition => {
      const { connectionId, jobId, before } = await fixture();
      const db = database();
      if (condition === "count") await db.delete(serviceRecords).where(eq(serviceRecords.id, before[0].id));
      if (condition === "review") await db.update(serviceRecords).set({ reviewReason: "Human correction" }).where(eq(serviceRecords.id, before[0].id));
      if (condition === "active") await db.update(providerIntegrations).set({ status: "active" }).where(eq(providerIntegrations.id, connectionId));
      if (condition === "job") await db.update(providerSyncJobs).set({ activeProviderId: providerId(), status: "queued" }).where(eq(providerSyncJobs.id, jobId));
      if (condition === "website") await db.update(providerRecords).set({ websiteUrl: "https://different.example" }).where(eq(providerRecords.id, providerId()));
      if (condition === "evidence") await db.delete(providerSyncJobs).where(eq(providerSyncJobs.id, jobId));
      const servicesBefore = await db.select().from(serviceRecords).orderBy(serviceRecords.id);
      const connectionsBefore = await db.select().from(providerIntegrations);
      expect((await repairOldSmmAttribution()).changed).toBe(0);
      expect(await db.select().from(serviceRecords).orderBy(serviceRecords.id)).toEqual(servicesBefore);
      expect(await db.select().from(providerIntegrations)).toEqual(connectionsBefore);
      expect(await db.select().from(providerRecords).where(eq(providerRecords.slug, "oldsmm"))).toHaveLength(0);
    });
    it("preserves an existing destination catalogue instead of merging identities or colliding external IDs", async () => {
      const { before } = await fixture();
      const db = database();
      const [target] = await db.insert(providerRecords).values({ slug: "oldsmm", name: "Existing OldSMM", initials: "OS", websiteUrl: "https://oldsmm.com/", status: "draft" }).$returningId();
      await db.insert(serviceRecords).values({ ...before[0], id: undefined, providerId: target.id, slug: "existing-destination" });
      const servicesBefore = await db.select().from(serviceRecords).orderBy(serviceRecords.id);
      expect(await repairOldSmmAttribution()).toMatchObject({ changed: 0, reason: "destination_not_empty" });
      expect(await db.select().from(serviceRecords).orderBy(serviceRecords.id)).toEqual(servicesBefore);
    });
  });
}
