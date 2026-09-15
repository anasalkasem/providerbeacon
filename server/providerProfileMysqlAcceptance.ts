import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  auditEntries,
  providerIntegrations,
  providerRecords,
  providerSyncJobs,
  serviceRecords,
  teamMembers,
  users,
} from "../drizzle/schema";
import { getProviderProfile, saveProviderProfile } from "./providerProfileDb";
import { getCachedMarketplaceSnapshot } from "./marketplaceDb";
import { appRouter } from "./routers";
import { syncStoredIntegration } from "./vaultDb";

export function providerProfileAcceptanceCases(
  database: () => any,
  actorId: () => number,
  providerId: () => number,
  addIntegration: () => Promise<number>
) {
  describe("provider public profile persistence", () => {
    const input = () => ({
      id: providerId(),
      revision: 1,
      name: "Provider Identity",
      description: "Public description",
      websiteUrl: "https://provider.example/",
      logoUrl: "https://cdn.provider.example/logo.png",
      websitePreviewUrl: "https://cdn.provider.example/screen.png",
      telegramUrl: "@ProviderSupport",
    });
    const save = (patch: Record<string, unknown> = {}, actor = actorId()) =>
      saveProviderProfile({
        input: { ...input(), ...patch } as any,
        actorUserId: actor,
      });
    async function caller(origin = "https://providerbeacon.com") {
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      const [user] = await database()
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      return appRouter.createCaller({
        user,
        authMode: "staff",
        req: { headers: { origin }, ip: "127.0.0.1" },
        res: { setHeader: vi.fn() },
      } as any);
    }
    it("saves real public identity, invalidates the catalogue cache and audits atomically", async () => {
      const old = await getCachedMarketplaceSnapshot({ scope: "providers" });
      expect(old.providers[0].name).toBe("Test provider");
      const saved = await (await caller()).admin.providers.saveProfile(input());
      expect(saved).toMatchObject({
        name: "Provider Identity",
        revision: 2,
        telegramUrl: "https://t.me/providersupport",
        isPublic: true,
      });
      expect(await getProviderProfile(providerId())).toEqual(saved);
      const fresh = await getCachedMarketplaceSnapshot({ scope: "providers" });
      expect(fresh.providers[0]).toMatchObject({
        name: saved.name,
        websiteUrl: saved.websiteUrl,
        logoUrl: saved.logoUrl,
        websitePreviewUrl: saved.websitePreviewUrl,
        telegramUrl: saved.telegramUrl,
        initials: "PI",
        verified: false,
        score: null,
        updatedMinutes: null,
      });
      const audits = await database()
        .select()
        .from(auditEntries)
        .where(eq(auditEntries.action, "provider.profile.update"));
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        actorUserId: actorId(),
        metadata: { before: { revision: 1 }, after: { revision: 2 } },
      });
      expect(JSON.stringify(saved)).not.toMatch(/credential|apiKey|baseUrl/);
    });
    it("allows profile editing while a sync is queued and leaves credentials, jobs and services untouched", async () => {
      const integrationId = await addIntegration();
      await syncStoredIntegration({
        id: integrationId,
        actorUserId: actorId(),
      });
      const before = await database().select().from(providerIntegrations);
      const jobs = await database().select().from(providerSyncJobs);
      const services = await database().select().from(serviceRecords);
      await save();
      expect(await database().select().from(providerIntegrations)).toEqual(
        before
      );
      expect(await database().select().from(providerSyncJobs)).toEqual(jobs);
      expect(await database().select().from(serviceRecords)).toEqual(services);
      expect(before[0].credentialCiphertext).toBeTruthy();
    });
    it("rejects stale edits and rolls back the provider if its audit cannot be written", async () => {
      const saved = await save();
      await expect(save({ name: "Stale change" })).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await expect(
        save({ revision: 2, name: "Unaudited change" }, 2147483647)
      ).rejects.toThrow();
      expect(await getProviderProfile(providerId())).toEqual(saved);
      expect(
        await database()
          .select()
          .from(auditEntries)
          .where(eq(auditEntries.action, "provider.profile.update"))
      ).toHaveLength(1);
    });
    it("enforces staff permissions and origin; operations staff can edit identity without key-write access", async () => {
      const api = await caller();
      await database()
        .update(teamMembers)
        .set({ role: "auditor" })
        .where(eq(teamMembers.userId, actorId()));
      expect(
        await api.admin.providers.profile({ id: providerId() })
      ).toMatchObject({ revision: 1 });
      await expect(
        api.admin.providers.saveProfile(input())
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await database()
        .update(teamMembers)
        .set({ role: "operations_manager" })
        .where(eq(teamMembers.userId, actorId()));
      const access = await api.admin.access();
      expect(access.permissions).toContain("providers.write");
      expect(access.permissions).not.toContain("integrations.write");
      await expect(
        (await caller("https://evil.example")).admin.providers.saveProfile(
          input()
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect((await api.admin.providers.saveProfile(input())).revision).toBe(2);
    });
    it("clears optional images and links without publishing a draft or changing verification", async () => {
      await database()
        .update(providerRecords)
        .set({ status: "draft" })
        .where(eq(providerRecords.id, providerId()));
      expect((await save()).isPublic).toBe(false);
      await save({
        revision: 2,
        websiteUrl: "",
        logoUrl: "",
        websitePreviewUrl: "",
        telegramUrl: "",
      });
      expect(await getProviderProfile(providerId())).toMatchObject({
        revision: 3,
        websiteUrl: null,
        logoUrl: null,
        websitePreviewUrl: null,
        telegramUrl: null,
        isPublic: false,
      });
      expect(
        (await getCachedMarketplaceSnapshot({ scope: "providers" })).providers
      ).toEqual([]);
      const [row] = await database()
        .select()
        .from(providerRecords)
        .where(eq(providerRecords.id, providerId()));
      expect(row).toMatchObject({
        status: "draft",
        verified: false,
        apiCataloguePublished: false,
        sourceUpdatedAt: null,
      });
    });
    it("rejects unsafe input without writing and omits unsafe legacy URLs from public output", async () => {
      const api = await caller();
      await expect(
        api.admin.providers.saveProfile({
          ...input(),
          websiteUrl: "https://localhost/",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        api.admin.providers.saveProfile({
          ...input(),
          apiKey: "do-not-save",
        } as any)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect((await getProviderProfile(providerId())).revision).toBe(1);
      expect(await database().select().from(auditEntries)).toHaveLength(0);
      await database()
        .update(providerRecords)
        .set({
          logoUrl: "javascript:alert(1)",
          websiteUrl: "https://provider.example/?api_key=secret",
          telegramUrl: "https://example.com/impostor",
        })
        .where(eq(providerRecords.id, providerId()));
      expect(
        (await getCachedMarketplaceSnapshot({ scope: "providers" }))
          .providers[0]
      ).toMatchObject({ websiteUrl: null, logoUrl: null, telegramUrl: null });
    });
  });
}
