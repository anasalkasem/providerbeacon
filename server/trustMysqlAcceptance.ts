import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { providerRatings, screeningControl } from "../drizzle/trustSchema";
import { memberAccounts, memberAuthBuckets } from "../drizzle/memberSchema";
import { providerBusinessAccounts } from "../drizzle/businessSchema";
import { providerRecords, serviceRecords } from "../drizzle/schema";
import {
  authenticateMemberSession,
  logoutMember,
  registerMember,
} from "./memberDb";
import {
  providerRatingSummary,
  ownProviderRating,
  writeProviderRating,
  visitorRatingSummaries,
} from "./providerRatings";
import {
  decideServiceScreening,
  runServiceScreeningStep,
  serviceScreeningSummary,
  setServiceScreeningEnabled,
} from "./serviceScreening";
import {
  getCachedMarketplaceSnapshot,
  getMarketplaceSnapshot,
} from "./marketplaceDb";
import { assistantOffersByIds } from "./assistantCatalogue";
import { listAdminServices } from "./adminCatalogueDb";
import { applyServiceReview } from "./serviceReviewDb";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { memberCookieName } from "./memberSecurity";

export function trustAcceptanceCases(
  database: () => any,
  actorId: () => number,
  providerId: () => number,
  addIntegration: (status?: "active" | "disabled") => Promise<number>
) {
  describe("visitor ratings and automatic service screening", () => {
    beforeEach(async () => {
      await database().delete(providerRatings);
      await database().delete(memberAccounts);
      await database().delete(memberAuthBuckets);
      await database().delete(screeningControl);
      vi.stubEnv("AUTH_PEPPER", "ratings-local-test-pepper");
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      vi.stubEnv("MAIL_ENABLED", "false");
      vi.stubEnv("OAUTH_SERVER_URL", "");
      vi.stubEnv("OPENAI_API_KEY", "local-no-network");
      vi.stubEnv("BEACON_AI_ENABLED", "true");
      vi.stubEnv("BEACON_SCREENING_DAILY_REQUESTS", "2400");
    });
    async function member(email = "rating@example.com", verified = true) {
      const result = await registerMember({
        name: "Visitor",
        email,
        password: "long local test ratings password",
      });
      if (verified)
        await database()
          .update(memberAccounts)
          .set({ emailVerifiedAt: new Date() })
          .where(eq(memberAccounts.id, result.member.id));
      return {
        ...result,
        auth: (await authenticateMemberSession(result.token))!,
      };
    }
    async function caller(
      token?: string,
      origin = "https://providerbeacon.com",
      user: any = null
    ) {
      const ctx = await createContext({
        req: {
          headers: {
            ...(token
              ? { cookie: `${memberCookieName("session")}=${token}` }
              : {}),
            origin,
          },
          socket: { remoteAddress: "127.0.0.1" },
        },
        res: { setHeader: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn() },
      } as any);
      return appRouter.createCaller({ ...ctx, user });
    }
    const rating = (accountId: number, stars = 4, revision = 0) => ({
      providerId: providerId(),
      accountId,
      stars,
      revision,
    });
    async function service(patch: Record<string, unknown> = {}) {
      const [r] = await database()
        .insert(serviceRecords)
        .values({
          providerId: providerId(),
          externalId: `ext-${Math.random()}`,
          slug: `test-${Math.random()}`,
          name: "TikTok Views",
          platform: "TikTok",
          category: "Views",
          priceAmount: "1.0000",
          minOrder: 100,
          maxOrder: 1000,
          status: "active",
          reviewStatus: "approved",
          incomplete: false,
          normalizationVersion: 1,
          pricingConfirmed: true,
          priceCurrency: "USD",
          priceUnit: "per_1000",
          policyReviewed: true,
          evidenceUrl: "https://provider.example/services",
          sourceUpdatedAt: new Date(),
          ...patch,
        })
        .$returningId();
      return r.id as number;
    }
    async function row(id: number) {
      return (
        await database()
          .select()
          .from(serviceRecords)
          .where(eq(serviceRecords.id, id))
      )[0];
    }
    function model(
      issue: "none" | "unclear" | "unavailable" = "none",
      confidence = 0.99,
      beforeResponse?: () => Promise<void>
    ) {
      const mock = vi.fn(async (_url: string, init: RequestInit) => {
        const request = JSON.parse(String(init.body));
        const inputs = JSON.parse(request.input[0].content);
        await beforeResponse?.();
        const results = inputs.map((input: any) => ({
          id: input.id,
          issue,
          confidence,
          evidence: issue === "none" ? "" : input.name,
        }));
        return new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                type: "message",
                content: [
                  { type: "output_text", text: JSON.stringify({ results }) },
                ],
              },
            ],
          })
        );
      });
      vi.stubGlobal("fetch", mock);
      return mock;
    }
    it("counts real verified visitors, updates one vote and removes it without legacy fabricated values", async () => {
      await database()
        .update(providerRecords)
        .set({ ratingBasisPoints: 499, reviewCount: 900 })
        .where(eq(providerRecords.id, providerId()));
      expect(await providerRatingSummary(providerId())).toEqual({
        rating: null,
        reviews: 0,
      });
      const a = await member();
      const b = await member("other-rating@example.com");
      await writeProviderRating(a.auth, rating(a.member.id, 5));
      await writeProviderRating(b.auth, rating(b.member.id, 3));
      expect(await providerRatingSummary(providerId())).toEqual({
        rating: 4,
        reviews: 2,
      });
      expect(
        (await getMarketplaceSnapshot({ scope: "providers" })).providers[0]
      ).toMatchObject({ rating: 4, reviews: 2 });
      await writeProviderRating(a.auth, rating(a.member.id, 1, 1));
      expect(await providerRatingSummary(providerId())).toEqual({
        rating: 2,
        reviews: 2,
      });
      await writeProviderRating(
        a.auth,
        { providerId: providerId(), accountId: a.member.id, revision: 2 },
        true
      );
      expect(await providerRatingSummary(providerId())).toEqual({
        rating: 3,
        reviews: 1,
      });
      expect(
        JSON.stringify(await providerRatingSummary(providerId()))
      ).not.toContain("member");
    });
    it("requires verified current accounts, validates stars and forbids own-provider votes", async () => {
      const m = await member(undefined, false);
      await expect(
        writeProviderRating(m.auth, rating(m.member.id))
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await database()
        .update(memberAccounts)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(memberAccounts.id, m.member.id));
      for (const stars of [0, 6, 1.5])
        await expect(
          writeProviderRating(m.auth, rating(m.member.id, stars))
        ).rejects.toThrow();
      await database()
        .insert(providerBusinessAccounts)
        .values({ providerId: providerId(), ownerMemberId: m.member.id });
      await expect(
        writeProviderRating(m.auth, rating(m.member.id))
      ).rejects.toMatchObject({ message: "ratings_owner" });
      await database().delete(providerBusinessAccounts);
      await logoutMember(m.token);
      await expect(
        writeProviderRating(m.auth, rating(m.member.id))
      ).rejects.toThrow();
    });
    it("serializes first votes and rejects stale edits and switched-account writes", async () => {
      const m = await member();
      const writes = await Promise.allSettled([
        writeProviderRating(m.auth, rating(m.member.id, 3)),
        writeProviderRating(m.auth, rating(m.member.id, 5)),
      ]);
      expect(writes.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect((await providerRatingSummary(providerId())).reviews).toBe(1);
      await expect(
        writeProviderRating(m.auth, rating(m.member.id))
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        writeProviderRating(m.auth, rating(m.member.id + 1))
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
    it("excludes suspended/deleted visitors and ownership changes from aggregates", async () => {
      const m = await member();
      await writeProviderRating(m.auth, rating(m.member.id));
      await database()
        .update(memberAccounts)
        .set({ status: "suspended" })
        .where(eq(memberAccounts.id, m.member.id));
      expect((await visitorRatingSummaries([providerId()])).size).toBe(0);
      await database()
        .update(memberAccounts)
        .set({ status: "active" })
        .where(eq(memberAccounts.id, m.member.id));
      await database()
        .insert(providerBusinessAccounts)
        .values({ providerId: providerId(), ownerMemberId: m.member.id });
      expect((await visitorRatingSummaries([providerId()])).size).toBe(0);
      await database()
        .delete(memberAccounts)
        .where(eq(memberAccounts.id, m.member.id));
      expect(await database().select().from(providerRatings)).toHaveLength(0);
    });
    it("enforces signed-in, same-origin and hourly rate limits at the router", async () => {
      const m = await member();
      await expect(
        (await caller()).ratings.save(rating(m.member.id))
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        (await caller(m.token, "https://evil.example")).ratings.save(
          rating(m.member.id)
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const api = await caller(m.token);
      await expect(
        api.ratings.mine({
          providerId: providerId(),
          accountId: m.member.id + 1,
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      for (let i = 0; i < 20; i++)
        await api.ratings.save(rating(m.member.id, (i % 5) + 1, i));
      await expect(
        api.ratings.save(rating(m.member.id, 5, 20))
      ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    });
    it("hides held services from public catalogue, compare and assistant while retaining admin records and manual review state", async () => {
      const id = await service({ name: "Service stopped" });
      await getCachedMarketplaceSnapshot({ scope: "services" });
      model("unavailable");
      expect(await runServiceScreeningStep()).toBe(true);
      expect(await row(id)).toMatchObject({
        screeningStatus: "held",
        reviewStatus: "approved",
        pricingConfirmed: true,
        available: true,
      });
      expect(
        (await getCachedMarketplaceSnapshot({ scope: "services" })).services
      ).toHaveLength(0);
      expect(
        (await getMarketplaceSnapshot({ scope: "compare", ids: [id] })).services
      ).toHaveLength(0);
      expect(await assistantOffersByIds([`service-${id}`])).toHaveLength(0);
      expect(
        (await listAdminServices({ screening: "held" })).items.map(r => r.id)
      ).toContain(id);
      await expect(
        applyServiceReview({
          action: "publish",
          items: [{ id, revision: 2 }],
          reason: "Attempt held publication",
          actorUserId: actorId(),
        })
      ).rejects.toThrow();
      await decideServiceScreening(
        {
          id,
          revision: 2,
          action: "release",
          reason: "Checked current source; service resumed",
        },
        actorId()
      );
      expect(
        (await getMarketplaceSnapshot({ scope: "services" })).services
      ).toHaveLength(1);
      expect(await runServiceScreeningStep()).toBe(false);
    });
    it("applies the same hold to a published API source catalogue", async () => {
      const integration = await addIntegration("active");
      const { providerIntegrations } = await import("../drizzle/schema");
      await database()
        .update(providerIntegrations)
        .set({ lastSyncedAt: new Date() })
        .where(eq(providerIntegrations.id, integration));
      await database()
        .update(providerRecords)
        .set({ apiCataloguePublished: true })
        .where(eq(providerRecords.id, providerId()));
      const id = await service({
        sourceKind: "provider_api",
        reviewStatus: "pending",
        status: "draft",
        incomplete: true,
        sourceRate: "1.00",
        normalizationVersion: 2,
      });
      expect(
        (await getMarketplaceSnapshot({ scope: "services" })).services
      ).toHaveLength(1);
      model("unclear");
      await runServiceScreeningStep();
      expect(
        (await getMarketplaceSnapshot({ scope: "services" })).services
      ).toHaveLength(0);
      expect((await row(id)).screeningStatus).toBe("held");
    });
    it("requeues changed revisions and discards a stale model result", async () => {
      const id = await service();
      model("unclear", 0.99, async () => {
        await database()
          .update(serviceRecords)
          .set({ name: "Updated TikTok Views", revision: 2 })
          .where(eq(serviceRecords.id, id));
      });
      await runServiceScreeningStep();
      expect((await row(id)).screeningStatus).toBe("pending");
      model();
      await runServiceScreeningStep();
      expect(await row(id)).toMatchObject({
        screeningStatus: "clear",
        screeningRevision: 3,
        revision: 3,
      });
      await database()
        .update(serviceRecords)
        .set({ name: "Service stopped", revision: 4 })
        .where(eq(serviceRecords.id, id));
      model("unavailable");
      await runServiceScreeningStep();
      expect((await row(id)).screeningStatus).toBe("held");
    });
    it("does not invent holds on outages and preserves existing holds on uncertain rechecks", async () => {
      const id = await service();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("outage", { status: 503 }))
      );
      await runServiceScreeningStep();
      expect(await row(id)).toMatchObject({
        screeningStatus: "pending",
        screeningError: "unavailable",
      });
      expect(
        (await getMarketplaceSnapshot({ scope: "services" })).services
      ).toHaveLength(1);
      await decideServiceScreening(
        {
          id,
          revision: 1,
          action: "hold",
          reason: "Manually hold this listing for review",
        },
        actorId()
      );
      await database()
        .update(screeningControl)
        .set({ leaseUntil: null })
        .where(eq(screeningControl.id, 1));
      expect(await runServiceScreeningStep()).toBe(false);
      await decideServiceScreening(
        {
          id,
          revision: 2,
          action: "retry",
          reason: "Recheck this held listing with model",
        },
        actorId()
      );
      model("unclear", 0.6);
      await runServiceScreeningStep();
      expect((await row(id)).screeningStatus).toBe("held");
    });
    it("coordinates concurrent workers, pause/resume and durable daily budgets", async () => {
      await service();
      const fetch = model();
      vi.stubEnv("BEACON_SCREENING_DAILY_REQUESTS", "1");
      await Promise.all([runServiceScreeningStep(), runServiceScreeningStep()]);
      expect(fetch).toHaveBeenCalledTimes(1);
      await service();
      await runServiceScreeningStep();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect((await serviceScreeningSummary()).lastError).toBe("daily_limit");
      await database()
        .update(screeningControl)
        .set({ budgetDay: "2020-01-01", leaseUntil: null })
        .where(eq(screeningControl.id, 1));
      await setServiceScreeningEnabled(false, actorId());
      expect(await runServiceScreeningStep()).toBe(false);
      await setServiceScreeningEnabled(true, actorId());
      await runServiceScreeningStep();
      expect(fetch).toHaveBeenCalledTimes(2);
    });
    it("rejects invented model evidence and prevents deterministic-invalid release", async () => {
      const id = await service({ priceAmount: "0.0000" });
      model();
      await runServiceScreeningStep();
      expect(await row(id)).toMatchObject({
        screeningStatus: "held",
        screeningReason: "invalid_values",
        screeningModel: "rules-v1",
      });
      await expect(
        decideServiceScreening(
          {
            id,
            revision: 2,
            action: "release",
            reason: "Cannot bypass invalid source values",
          },
          actorId()
        )
      ).rejects.toMatchObject({ message: "screening_fix_source_first" });
      const second = await service();
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                status: "completed",
                output: [
                  {
                    type: "message",
                    content: [
                      {
                        type: "output_text",
                        text: JSON.stringify({
                          results: [
                            {
                              id: second,
                              issue: "unavailable",
                              confidence: 1,
                              evidence: "invented shutdown",
                            },
                          ],
                        }),
                      },
                    ],
                  },
                ],
              })
            )
        )
      );
      await runServiceScreeningStep();
      expect(await row(second)).toMatchObject({
        screeningStatus: "pending",
        screeningError: "invalid_response",
      });
    });
    it("requires review permission and same-origin staff changes", async () => {
      const api = await caller();
      await expect(
        api.admin.services.screeningToggle({ enabled: false })
      ).rejects.toThrow();
      const { users } = await import("../drizzle/schema");
      const [user] = await database()
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      await expect(
        (
          await caller(undefined, "https://evil.example", user)
        ).admin.services.screeningToggle({ enabled: false })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await (
        await caller(undefined, "https://providerbeacon.com", user)
      ).admin.services.screeningToggle({ enabled: false });
      expect((await serviceScreeningSummary()).enabled).toBe(false);
    });
  });
}
