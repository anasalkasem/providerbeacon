import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { auditEntries, siteAppearance, teamMembers } from "../drizzle/schema";
import { appRouter } from "./routers";
import { readSiteAppearance } from "./siteAppearance";

export function appearanceAcceptanceCases(
  database: () => any,
  actorId: () => number
) {
  describe("owner-controlled site appearance", () => {
    beforeEach(async () => {
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      await database().delete(siteAppearance);
      await database()
        .insert(siteAppearance)
        .values({ id: 1, edgeGlowEnabled: true, revision: 1 });
    });
    const caller = (signedIn = true, origin = "https://providerbeacon.com") =>
      appRouter.createCaller({
        user: signedIn
          ? { id: actorId(), openId: "appearance-test-user", role: "admin" }
          : null,
        req: { headers: { origin } },
        res: { setHeader: vi.fn() },
      } as any);
    const role = (value: string) =>
      database()
        .update(teamMembers)
        .set({ role: value })
        .where(eq(teamMembers.userId, actorId()));

    it("persists both switch directions for fresh visitors and audits the owner's changes", async () => {
      await role("owner");
      expect(await caller().admin.appearance.get()).toEqual({
        edgeGlowEnabled: true,
        revision: 1,
      });
      expect(
        await caller().admin.appearance.update({
          edgeGlowEnabled: false,
          revision: 1,
        })
      ).toEqual({ edgeGlowEnabled: false, revision: 2 });
      expect(await caller(false).appearance.public()).toEqual({
        edgeGlowEnabled: false,
      });
      expect(await readSiteAppearance()).toEqual({
        edgeGlowEnabled: false,
        revision: 2,
      });
      await caller().admin.appearance.update({
        edgeGlowEnabled: true,
        revision: 2,
      });
      expect(await caller(false).appearance.public()).toEqual({
        edgeGlowEnabled: true,
      });
      const entries = await database()
        .select()
        .from(auditEntries)
        .where(eq(auditEntries.action, "appearance.edge_glow_changed"));
      expect(entries).toHaveLength(2);
      expect(
        entries.every((entry: any) => entry.actorUserId === actorId())
      ).toBe(true);
      expect(entries.map((entry: any) => entry.metadata.after).sort()).toEqual([
        false,
        true,
      ]);
    });
    it("rejects guests, ordinary accounts and every non-owner staff role", async () => {
      await expect(
        caller(false).admin.appearance.update({
          edgeGlowEnabled: false,
          revision: 1,
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      for (const value of [
        "administrator",
        "operations_manager",
        "provider_reviewer",
        "catalogue_editor",
        "translation_manager",
        "auditor",
      ]) {
        await role(value);
        await expect(caller().admin.appearance.get()).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
        await expect(
          caller().admin.appearance.update({
            edgeGlowEnabled: false,
            revision: 1,
          })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      await database().delete(teamMembers);
      await expect(
        caller().admin.appearance.update({
          edgeGlowEnabled: false,
          revision: 1,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await readSiteAppearance()).toEqual({
        edgeGlowEnabled: true,
        revision: 1,
      });
    });
    it("rejects cross-site writes and stale toggles without losing the owner's saved choice", async () => {
      await role("owner");
      await expect(
        caller(true, "https://other.example").admin.appearance.update({
          edgeGlowEnabled: false,
          revision: 1,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await caller().admin.appearance.update({
        edgeGlowEnabled: false,
        revision: 1,
      });
      await expect(
        caller().admin.appearance.update({ edgeGlowEnabled: true, revision: 1 })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await caller(false).appearance.public()).toEqual({
        edgeGlowEnabled: false,
      });
    });
    it("does not silently enable the feature when configuration is missing", async () => {
      await database().delete(siteAppearance);
      await expect(caller(false).appearance.public()).rejects.toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });
    });
  });
}
