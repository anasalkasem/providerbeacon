import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { providerBusinessAccounts } from "../drizzle/businessSchema";
import { providerRecords, teamMembers, users } from "../drizzle/schema";
import {
  providerAnalyticsDaily as daily,
  providerAnalyticsDedupe as dedupe,
  providerAnalyticsLimits as limits,
  providerAnalyticsState,
} from "../drizzle/analyticsSchema";
import {
  cleanupProviderAnalytics,
  getProviderAnalytics,
  recordProviderEvent,
} from "./providerAnalyticsDb";
import { analyticsRequestKeys } from "./providerAnalyticsRoutes";
import {
  ANALYTICS_DAY_MS,
  ANALYTICS_REPEAT_MS,
  analyticsDate,
  type ProviderEvent,
} from "../shared/providerAnalytics";
import { appRouter } from "./routers";

export function providerAnalyticsAcceptanceCases(
  database: () => any,
  actorId: () => number,
  providerId: () => number
) {
  describe("provider analytics MySQL acceptance", () => {
    const now = Date.parse("2026-09-16T12:00:00Z");
    const visitor = "8c20ce60-ae70-4710-9409-02d9e23f03f1";
    const keys = (at = now, id = visitor) =>
      analyticsRequestKeys(
        {
          headers: {
            origin: "https://providerbeacon.com",
            "user-agent": "Mozilla/5.0 Safari/605.1.15",
          },
          socket: { remoteAddress: "203.0.113.5" },
        } as any,
        id,
        at
      )!;
    const record = (
      kind: ProviderEvent["kind"] = "view",
      at = now,
      id = visitor,
      provider = providerId()
    ) =>
      recordProviderEvent(
        { providerId: provider, visitorId: id, kind },
        keys(at, id),
        at
      );
    const report = (patch = {}) =>
      getProviderAnalytics({ days: 7, page: 1, ...patch }, now);
    beforeEach(async () => {
      vi.stubEnv("AUTH_PEPPER", "analytics-acceptance-secret");
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      await database().delete(limits);
      await database().insert(providerBusinessAccounts).values({ providerId: providerId(), status: "active", startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000) });
      await database()
        .update(providerAnalyticsState)
        .set({ startedAt: new Date(now - 2 * ANALYTICS_DAY_MS) })
        .where(eq(providerAnalyticsState.id, 1));
      await database()
        .update(providerRecords)
        .set({
          websiteUrl: "https://provider.example/",
          telegramUrl: "https://t.me/providersupport",
        })
        .where(eq(providerRecords.id, providerId()));
    });
    it("counts simultaneous retries once and keeps website and Telegram independent", async () => {
      const results = await Promise.all(
        Array.from({ length: 24 }, () => record())
      );
      expect(results.filter(result => result === "counted")).toHaveLength(1);
      expect(results.filter(result => result === "duplicate")).toHaveLength(23);
      expect(await record("website")).toBe("counted");
      expect(await record("telegram")).toBe("counted");
      expect(await record("website")).toBe("duplicate");
      expect((await report()).totals).toEqual({
        views: 1,
        website: 1,
        telegram: 1,
      });
    });
    it("deduplicates rolling 30-minute visits, rotates daily and does not merge browsers or providers", async () => {
      expect(await record()).toBe("counted");
      expect(await record("view", now + ANALYTICS_REPEAT_MS - 1000)).toBe(
        "duplicate"
      );
      expect(await record("view", now + ANALYTICS_REPEAT_MS)).toBe("counted");
      expect(await record("view", now + ANALYTICS_DAY_MS)).toBe("counted");
      expect(
        await record("view", now, "608e1d1e-3ea6-4fc2-b35a-8ca0a5876018")
      ).toBe("counted");
      const [other] = await database()
        .insert(providerRecords)
        .values({
          slug: "other-provider",
          name: "Other provider",
          initials: "OP",
          status: "active",
        })
        .$returningId();
      expect(await record("view", now, visitor, other.id)).toBe("counted");
      const result = await report();
      expect(result.totals.views).toBe(4); // Tomorrow's event is outside today's report.
      expect((await report({ providerId: providerId() })).totals.views).toBe(3);
      expect(await database().select().from(dedupe)).toHaveLength(4);
    });
    it("counts first sub-second events and preserves the exact rolling boundary", async () => {
      const first = now + 750;
      expect(await record("view", first)).toBe("counted");
      expect(await record("view", first + ANALYTICS_REPEAT_MS - 1)).toBe(
        "duplicate"
      );
      expect(await record("view", first + ANALYTICS_REPEAT_MS)).toBe("counted");
      const [row] = await database().select().from(dedupe);
      expect(row.lastCountedAt).toEqual(new Date(first + ANALYTICS_REPEAT_MS));
      expect((await report()).totals.views).toBe(2);
      await cleanupProviderAnalytics(row.expiresAt.getTime());
      expect(await database().select().from(dedupe)).toHaveLength(0);
    });
    it("ignores unpublished providers and missing or unsafe contact destinations", async () => {
      for (const status of ["draft", "pending_review", "suspended"]) {
        await database()
          .update(providerRecords)
          .set({ status })
          .where(eq(providerRecords.id, providerId()));
        expect(await record()).toBe("ignored");
      }
      await database()
        .update(providerRecords)
        .set({ status: "active", apiCataloguePublished: true })
        .where(eq(providerRecords.id, providerId()));
      expect(await record()).toBe("ignored");
      await database()
        .update(providerRecords)
        .set({
          apiCataloguePublished: false,
          websiteUrl: "javascript:alert(1)",
          telegramUrl: null,
        })
        .where(eq(providerRecords.id, providerId()));
      expect(await record("website")).toBe("ignored");
      expect(await record("telegram")).toBe("ignored");
      expect(await record("view", now, visitor, 2_147_483_647)).toBe("ignored");
      expect((await report()).totals).toEqual({
        views: 0,
        website: 0,
        telegram: 0,
      });
      expect(await database().select().from(dedupe)).toHaveLength(0);
    });
    it("enforces shared rate limits even when a client keeps changing visitor IDs", async () => {
      const requests = Array.from({ length: 65 }, (_, i) =>
        record(
          "view",
          now,
          `${String(i).padStart(8, "0")}-ae70-4710-9409-02d9e23f03f1`
        )
      );
      const results = await Promise.all(requests);
      expect(results.filter(result => result === "counted")).toHaveLength(60);
      expect(results.filter(result => result === "limited")).toHaveLength(5);
      expect(await record("website", now + 60_000)).toBe("counted");
      await database()
        .update(limits)
        .set({ used: 1000 })
        .where(eq(limits.key, `day:${keys().clientKey}`));
      expect(await record("telegram", now + 120_000)).toBe("limited");
      expect((await report()).totals).toEqual({
        views: 60,
        website: 1,
        telegram: 0,
      });
    });
    it("keeps counters, duplicate state and rate reservations atomic on database failure", async () => {
      await database()
        .insert(daily)
        .values({
          providerId: providerId(),
          day: analyticsDate(now),
          views: 2_147_483_647,
        });
      await expect(record()).rejects.toThrow();
      expect(await database().select().from(dedupe)).toHaveLength(0);
      expect(await database().select().from(limits)).toHaveLength(0);
      await database().update(daily).set({ views: 0 });
      expect(await record()).toBe("counted");
      expect((await report()).totals.views).toBe(1);
    });
    it("returns a truthful empty report and marks dates before collection as unmeasured", async () => {
      const result = await report();
      expect(result.totals).toEqual({ views: 0, website: 0, telegram: 0 });
      expect(result.daily).toHaveLength(7);
      expect(result.daily.filter(day => day.measured)).toHaveLength(3);
      expect(result.providers).toMatchObject([
        { id: providerId(), views: 0, website: 0, telegram: 0 },
      ]);
      expect(result.collectionEnabled).toBe(true);
      expect(result.startedAt).toEqual(new Date(now - 2 * ANALYTICS_DAY_MS));
    });
    it("aggregates date and provider filters correctly, paginates stably and preserves suspended-provider history", async () => {
      const others = await database()
        .insert(providerRecords)
        .values(
          Array.from({ length: 26 }, (_, i) => ({
            slug: `stats-provider-${i}`,
            name: `Provider ${i}`,
            initials: "SP",
            status: "active",
          }))
        )
        .$returningId();
      await database()
        .insert(daily)
        .values([
          {
            providerId: providerId(),
            day: analyticsDate(now),
            views: 10,
            website: 3,
            telegram: 2,
          },
          {
            providerId: providerId(),
            day: analyticsDate(now - 6 * ANALYTICS_DAY_MS),
            views: 4,
            website: 2,
            telegram: 1,
          },
          {
            providerId: providerId(),
            day: analyticsDate(now - 7 * ANALYTICS_DAY_MS),
            views: 90,
            website: 80,
            telegram: 70,
          },
          {
            providerId: others[0].id,
            day: analyticsDate(now),
            views: 100,
            website: 7,
            telegram: 3,
          },
        ]);
      // A historical fixture must have a collection start before its events.
      await database()
        .update(providerAnalyticsState)
        .set({ startedAt: new Date(now - 30 * ANALYTICS_DAY_MS) });
      await database()
        .update(providerRecords)
        .set({ status: "suspended" })
        .where(eq(providerRecords.id, others[0].id));
      const result = await report();
      expect(result.totals).toEqual({ views: 114, website: 12, telegram: 6 });
      expect(result.daily.reduce((sum, row) => sum + row.views, 0)).toBe(114);
      expect(result.providers[0].id).toBe(others[0].id);
      expect(result.providers).toHaveLength(25);
      expect(result.pageCount).toBe(2);
      const page2 = await report({ page: 999 });
      expect(page2.page).toBe(2);
      expect(page2.providers).toHaveLength(2);
      expect(
        page2.providers.some(row =>
          result.providers.some(first => first.id === row.id)
        )
      ).toBe(false);
      const single = await report({ providerId: providerId() });
      expect(single.providers).toHaveLength(1);
      expect(single.totals).toEqual({ views: 14, website: 5, telegram: 3 });
      expect(
        (await report({ days: 30, providerId: providerId() })).totals
      ).toEqual({ views: 104, website: 85, telegram: 73 });
    });
    it("protects reports with authoritative staff access and exposes no visitor records", async () => {
      const [user] = await database()
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      const headers = { setHeader: vi.fn() };
      const caller = (actor: any) =>
        appRouter.createCaller({
          user: actor,
          authMode: actor ? "staff" : null,
          req: { headers: {} },
          res: headers,
        } as any);
      await expect(
        caller(null).admin.analytics({ days: 7 })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await record();
      const data = await caller(user).admin.analytics({ days: 7 });
      expect(headers.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "no-store"
      );
      expect(JSON.stringify(data)).not.toMatch(
        /visitorKey|visitorId|clientKey|203\.0\.113|userAgent|email|cookie|credential/i
      );
      await database()
        .update(teamMembers)
        .set({ status: "suspended" })
        .where(eq(teamMembers.userId, actorId()));
      await expect(
        caller(user).admin.analytics({ days: 7 })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("expires short-lived digests independently of aggregate counts", async () => {
      await record();
      await database()
        .insert(dedupe)
        .values({
          providerId: providerId(),
          visitorKey: "a".repeat(64),
          kind: "website",
          lastCountedAt: new Date(now - 4 * ANALYTICS_DAY_MS),
          expiresAt: new Date(now - 1),
        });
      await database()
        .insert(limits)
        .values({
          key: "expired-limit",
          used: 1,
          expiresAt: new Date(now - 1),
        });
      await database()
        .insert(daily)
        .values({
          providerId: providerId(),
          day: analyticsDate(now - 401 * ANALYTICS_DAY_MS),
          views: 5,
        });
      await cleanupProviderAnalytics(now);
      expect(await database().select().from(dedupe)).toHaveLength(1);
      expect(
        (await database().select().from(limits)).some(
          (row: any) => row.key === "expired-limit"
        )
      ).toBe(false);
      expect(await database().select().from(daily)).toHaveLength(1);
      expect((await report()).totals.views).toBe(1);
    });
  });
}
