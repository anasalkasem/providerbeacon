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
        theme: "beacon",
        edgeGlowEnabled: true,
        revision: 1,
      });
      expect(
        await caller().admin.appearance.update({
          edgeGlowEnabled: false,
          revision: 1,
        })
      ).toEqual({ edgeGlowEnabled: false, theme: "beacon", revision: 2 });
      expect(await caller(false).appearance.public()).toEqual({
        theme: "beacon",
        edgeGlowEnabled: false,
      });
      expect(await readSiteAppearance()).toEqual({
        theme: "beacon",
        edgeGlowEnabled: false,
        revision: 2,
      });
      await caller().admin.appearance.update({
        edgeGlowEnabled: true,
        revision: 2,
      });
      expect(await caller(false).appearance.public()).toEqual({
        theme: "beacon",
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
          theme: "beacon",
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
            theme: "beacon",
            revision: 1,
          })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      await database().delete(teamMembers);
      await expect(
        caller().admin.appearance.update({
          edgeGlowEnabled: false,
          theme: "beacon",
          revision: 1,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await readSiteAppearance()).toEqual({
        theme: "beacon",
        edgeGlowEnabled: true,
        revision: 1,
      });
    });
    it("rejects cross-site writes and stale toggles without losing the owner's saved choice", async () => {
      await role("owner");
      await expect(
        caller(true, "https://other.example").admin.appearance.update({
          edgeGlowEnabled: false,
          theme: "beacon",
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
        theme: "beacon",
        edgeGlowEnabled: false,
      });
    });
    it("does not silently enable the feature when configuration is missing", async () => {
      await database().delete(siteAppearance);
      await expect(caller(false).appearance.public()).rejects.toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });
    });
    it("normalizes retired saved designs and never restores a removed preset", async () => {
      await role("owner");
      const retired = ["copper", "summer", "midnight", "pearl", "fire", "navy"];
      for (const theme of retired) {
        await database()
          .update(siteAppearance)
          .set({ theme, edgeGlowEnabled: false, revision: 1 })
          .where(eq(siteAppearance.id, 1));
        expect(await caller(false).appearance.public()).toEqual({
          theme: "beacon",
          edgeGlowEnabled: false,
        });
        await expect(
          caller().admin.appearance.update({ theme, revision: 1 } as any)
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        const saved = await caller().admin.appearance.update({
          theme: "beacon",
          revision: 1,
        });
        expect(saved).toEqual({
          theme: "beacon",
          edgeGlowEnabled: false,
          revision: 2,
        });
        const [row] = await database().select().from(siteAppearance);
        expect(row.theme).toBe("beacon");
        expect(
          await caller().admin.appearance.update({
            theme: "beacon",
            revision: 2,
          })
        ).toEqual(saved);
      }
      const entries = await database()
        .select()
        .from(auditEntries)
        .where(eq(auditEntries.action, "appearance.theme_changed"));
      expect(entries).toHaveLength(6);
      expect(entries.map((entry: any) => entry.metadata)).toEqual(
        expect.arrayContaining(
          retired.map(before => ({ before, after: "beacon" }))
        )
      );
    });
    it("persists Orbit for fresh visitors and can restore Classic without touching glow", async () => {
      await role("owner");
      const orbit = await caller().admin.appearance.update({
        theme: "orbit",
        revision: 1,
      });
      expect(orbit).toEqual({
        theme: "orbit",
        edgeGlowEnabled: true,
        revision: 2,
      });
      expect(await caller(false).appearance.public()).toEqual({
        theme: "orbit",
        edgeGlowEnabled: true,
      });
      expect(
        await caller().admin.appearance.update({ theme: "orbit", revision: 2 })
      ).toEqual(orbit);
      await expect(
        caller(true, "https://other.example").admin.appearance.update({
          theme: "beacon",
          revision: 2,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await caller().admin.appearance.update({ theme: "beacon", revision: 2 });
      expect(await caller(false).appearance.public()).toEqual({
        theme: "beacon",
        edgeGlowEnabled: true,
      });
      const entries = await database()
        .select()
        .from(auditEntries)
        .where(eq(auditEntries.action, "appearance.theme_changed"));
      expect(entries.map((entry: any) => entry.metadata)).toEqual([
        { before: "beacon", after: "orbit" },
        { before: "orbit", after: "beacon" },
      ]);
    });
    it("rejects invalid themes, empty patches and concurrent stale appearance changes", async () => {
      await role("owner");
      for (const input of [
        { theme: "unknown", revision: 1 },
        { revision: 1 },
        { theme: "beacon", extra: true, revision: 1 },
      ]) {
        await expect(
          caller().admin.appearance.update(input as any)
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      }
      const writes = await Promise.allSettled([
        caller().admin.appearance.update({
          edgeGlowEnabled: false,
          revision: 1,
        }),
        caller().admin.appearance.update({
          edgeGlowEnabled: false,
          revision: 1,
        }),
      ]);
      expect(
        writes.filter(result => result.status === "fulfilled")
      ).toHaveLength(1);
      const rejected = writes.find(
        result => result.status === "rejected"
      ) as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ code: "CONFLICT" });
      const winner = writes.find(
        result => result.status === "fulfilled"
      ) as PromiseFulfilledResult<any>;
      expect(await readSiteAppearance()).toEqual(winner.value);
      expect(winner.value.edgeGlowEnabled).toBe(false);
    });
  });
}
