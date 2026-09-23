import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { auditEntries, providerIntegrations, providerRecords, providerSyncJobs, serviceRecords, teamMembers, users } from "../drizzle/schema";
import { createProviderDraft, getMarketplaceSnapshot, setProviderCataloguePublication, updateProviderStatus } from "./marketplaceDb";
import { saveProviderIntegration, setProviderIntegrationEnabled, syncStoredIntegration } from "./vaultDb";
import { runProviderSyncStep } from "./providerSync";
import { getProviderSourceIdentity } from "./providerSourceIdentity";
import { appRouter } from "./routers";

export function providerSourceIdentityAcceptanceCases(
  database: () => any, actorId: () => number, providerId: () => number,
  addIntegration: () => Promise<number>, finishJob: (id: number) => Promise<any>,
) {
  const input = (patch: Record<string, unknown> = {}) => ({
    providerId: providerId(), name: "Source identity test", baseUrl: "https://provider.example/api/v2",
    apiKey: "source-test-secret-no-network", syncIntervalMinutes: 360, enabled: false, actorUserId: actorId(), ...patch,
  });
  const sourceRow = { service: 100, name: "TikTok Views", category: "Views", rate: "1.00", min: "100", max: "1000", currency: "USD", unit: "per_1000" };
  const upstream = (rows = [sourceRow]) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(rows))));
  const services = () => database().select().from(serviceRecords).orderBy(serviceRecords.id);
  async function sync(id: number) {
    const queued = await syncStoredIntegration({ id, actorUserId: actorId() });
    return finishJob(queued.jobId!);
  }
  describe("provider source attribution acceptance", () => {
    it("creates a provider, imports its API and publishes distinct catalogues with overlapping external IDs", async () => {
      upstream();
      const first = await saveProviderIntegration(input());
      await sync(first.id!);
      const original = (await services())[0];
      const draft = await createProviderDraft({ name: "Second Source", websiteUrl: "https://second.example", actorUserId: actorId() });
      const second = await saveProviderIntegration(input({ providerId: draft.id, baseUrl: "https://api.second.example/v2" }));
      upstream([{ ...sourceRow, name: "Instagram Likes", category: "Likes", rate: "2.50" }]);
      await sync(second.id!);
      expect((await services())[0]).toEqual(original);
      expect((await services())[1]).toMatchObject({ providerId: draft.id, externalId: "100", name: "Instagram Likes", sourceRate: "2.50", sourceUrl: "https://api.second.example/v2" });
      await updateProviderStatus({ id: draft.id, status: "active", actorUserId: actorId() });
      for (const id of [first.id!, second.id!]) await setProviderIntegrationEnabled({ id, enabled: true, actorUserId: actorId() });
      for (const id of [providerId(), draft.id]) await setProviderCataloguePublication({ id, enabled: true, reason: "Local source attribution acceptance", actorUserId: actorId() });
      const firstPublic = await getMarketplaceSnapshot({ scope: "provider", slug: "test-provider" });
      const secondPublic = await getMarketplaceSnapshot({ scope: "provider", slug: draft.slug });
      expect(firstPublic.services).toHaveLength(1);
      expect(secondPublic.services).toHaveLength(1);
      expect(firstPublic.services[0].id).toBe(`service-${original.id}`);
      expect(secondPublic.services[0].name).toBe("Instagram Likes");
      expect(secondPublic.services[0].id).not.toBe(`service-${original.id}`);
    });

    it("blocks conflicting new, edited and pre-existing connections without changing the retained catalogue", async () => {
      const id = await addIntegration();
      await sync(id);
      const before = await services();
      const [connection] = await database().select().from(providerIntegrations).where(eq(providerIntegrations.id, id));
      const conflicting = input({ baseUrl: "https://different.example/api", sourceIdentityConfirmed: true });
      await expect(saveProviderIntegration(conflicting)).rejects.toThrow("catalogue_source_conflict");
      await expect(saveProviderIntegration({ ...conflicting, id })).rejects.toThrow("catalogue_source_conflict");
      expect((await database().select().from(providerIntegrations).where(eq(providerIntegrations.id, id)))[0]).toEqual(connection);
      const oldOther = await addIntegration();
      await database().update(providerIntegrations).set({ baseUrl: conflicting.baseUrl }).where(eq(providerIntegrations.id, oldOther));
      await expect(syncStoredIntegration({ id: oldOther, actorUserId: actorId() })).rejects.toThrow("catalogue_source_conflict");
      expect(await services()).toEqual(before);
    });

    it("rechecks jobs already queued before a source conflict was discovered", async () => {
      const id = await addIntegration();
      await sync(id);
      const queued = await syncStoredIntegration({ id, actorUserId: actorId() });
      await database().update(serviceRecords).set({ sourceUrl: "https://different.example/api" }).where(eq(serviceRecords.providerId, providerId()));
      const before = await services();
      vi.mocked(fetch).mockClear();
      await runProviderSyncStep();
      expect(fetch).not.toHaveBeenCalled();
      expect((await database().select().from(providerSyncJobs).where(eq(providerSyncJobs.id, queued.jobId!)))[0]).toMatchObject({ status: "failed", lastError: "catalogue_source_conflict", processedCount: 0 });
      expect(await services()).toEqual(before);
    });

    it("records scheduled source conflicts through worker failure reporting instead of silently retrying enqueue", async () => {
      const id = await addIntegration();
      await sync(id);
      await database().update(providerIntegrations).set({ baseUrl: "https://different.example/api", status: "active", nextSyncAt: new Date(Date.now() - 60_000) }).where(eq(providerIntegrations.id, id));
      const queued = await syncStoredIntegration({ id, scheduled: true });
      const before = await services();
      await runProviderSyncStep();
      const [job] = await database().select().from(providerSyncJobs).where(eq(providerSyncJobs.id, queued.jobId!));
      const [connection] = await database().select().from(providerIntegrations).where(eq(providerIntegrations.id, id));
      expect(job).toMatchObject({ status: "failed", lastError: "catalogue_source_conflict" });
      expect(connection.lastError).toBe("catalogue_source_conflict");
      expect(connection.consecutiveFailures).toBe(1);
      expect(connection.nextSyncAt.getTime()).toBeGreaterThan(Date.now());
      expect(await services()).toEqual(before);
    });

    it.each([false, true])("preserves the entire batch when source identity changes after staging (quarantine=%s)", async invalid => {
      const id = await addIntegration();
      await sync(id);
      upstream([{ ...sourceRow, min: invalid ? "invalid" : "100", rate: "9.00" }, { ...sourceRow, service: 200 }]);
      const queued = await syncStoredIntegration({ id, actorUserId: actorId() });
      await runProviderSyncStep();
      expect((await database().select().from(providerSyncJobs).where(eq(providerSyncJobs.id, queued.jobId!)))[0].status).toBe("importing");
      await database().update(serviceRecords).set({ sourceUrl: "https://different.example/api" }).where(eq(serviceRecords.providerId, providerId()));
      const before = await services();
      await runProviderSyncStep();
      expect((await database().select().from(providerSyncJobs).where(eq(providerSyncJobs.id, queued.jobId!)))[0]).toMatchObject({ status: "failed", lastError: "catalogue_source_conflict", processedCount: 0 });
      expect(await services()).toEqual(before);
    });

    it("requires a fresh domain acknowledgement and audits it without retaining a plaintext key", async () => {
      await database().update(providerRecords).set({ websiteUrl: "https://provider.example" }).where(eq(providerRecords.id, providerId()));
      const mismatched = input({ baseUrl: "https://external.example/api" });
      await expect(saveProviderIntegration(mismatched)).rejects.toThrow("source_identity_confirmation_required");
      expect(await database().select().from(providerIntegrations)).toHaveLength(0);
      const saved = await saveProviderIntegration({ ...mismatched, sourceIdentityConfirmed: true });
      await expect(saveProviderIntegration({ ...mismatched, id: saved.id, baseUrl: "https://another.example/api" })).rejects.toThrow("source_identity_confirmation_required");
      const audits = await database().select().from(auditEntries).where(eq(auditEntries.action, "integration.vault.create"));
      expect(audits[0].metadata).toMatchObject({ sourceIdentityConfirmed: true, host: "external.example" });
      expect(JSON.stringify(audits)).not.toContain(mismatched.apiKey);
    });

    it("reports retained, mismatched and unknown hosts without leaking payloads or allowing non-staff access", async () => {
      await database().update(providerRecords).set({ websiteUrl: "https://provider.example" }).where(eq(providerRecords.id, providerId()));
      const id = await addIntegration();
      await sync(id);
      const [original] = await services();
      for (const [index, url] of Array.from(["https://other.example/api", "https://provider.example/api?key=private-token", null].entries())) {
        await database().insert(serviceRecords).values({ ...original, id: undefined, externalId: String(200 + index), slug: `source-identity-${index}`, sourceUrl: url, sourceData: { private: "raw-source-secret" } });
      }
      const report = await getProviderSourceIdentity(providerId());
      expect(report.provider.websiteHost).toBe("provider.example");
      expect(report.sources).toHaveLength(4);
      expect(report.sources.find(row => row.host === "provider.example")).toMatchObject({ count: 1, sampleServiceId: original.id, matchesWebsite: true });
      expect(report.sources.find(row => row.host === "other.example")?.matchesWebsite).toBe(false);
      expect(report.sources.filter(row => row.host === null)).toHaveLength(2);
      expect(JSON.stringify(report)).not.toMatch(/private-token|raw-source-secret|credential|local-test-key/);
      const [user] = await database().select().from(users).where(eq(users.id, actorId()));
      const caller = (staff: boolean) => appRouter.createCaller({ user: staff ? user : null, authMode: staff ? "staff" : "member", req: { headers: {} }, res: { setHeader: vi.fn() } } as any);
      await expect(caller(false).admin.integrations.sourceIdentity({ providerId: providerId() })).rejects.toThrow();
      await database().update(teamMembers).set({ role: "catalogue_editor" }).where(eq(teamMembers.userId, actorId()));
      await expect(caller(true).admin.integrations.sourceIdentity({ providerId: providerId() })).rejects.toThrow();
      await database().update(teamMembers).set({ role: "auditor" }).where(eq(teamMembers.userId, actorId()));
      expect((await caller(true).admin.integrations.sourceIdentity({ providerId: providerId() })).sources).toEqual(report.sources);
    });
  });
}
