import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  auditEntries,
  providerRecords,
  serviceRecords,
  teamMembers,
  users,
} from "../drizzle/schema";
import { memberAccounts } from "../drizzle/memberSchema";
import {
  providerBusinessAccounts as accounts,
  providerPromotions as offers,
} from "../drizzle/businessSchema";
import { communityGroups } from "../drizzle/communitySchema";
import { providerVipCards } from "../drizzle/vipSchema";
import { providerPayments } from "../drizzle/paymentSchema";
import { groupInput, groupListInput } from "../shared/community";
import {
  REVIEW_WORKSPACE_SLUG,
  reviewWorkspaceInput,
} from "../shared/reviewWorkspace";
import { authenticateMemberSession, registerMember } from "./memberDb";
import { memberCookieName } from "./memberSecurity";
import { createContext } from "./_core/context";
import { appRouter } from "./routers";
import { provisionReviewWorkspace } from "./reviewWorkspaceDb";
import {
  adminBusinessAccount,
  businessAnalytics,
  businessWorkspace,
  ownPromotions,
  prepareOwnershipClaim,
  publicPromotions,
  revokeBusinessOwner,
  savePromotion,
} from "./providerBusinessDb";
import { createGroup, groupProviders, publicGroups } from "./communityDb";
import { publicVipCards } from "./providerVipDb";
import { startProviderCheckout } from "./providerPaymentsDb";
import { getMarketplaceSnapshot } from "./marketplaceDb";
import { assistantOffersByIds } from "./assistantCatalogue";
import { saveProviderIntegration } from "./vaultDb";

export function reviewWorkspaceAcceptanceCases(
  database: () => any,
  actorId: () => number
) {
  describe("private app review workspace", () => {
    beforeEach(async () => {
      await database().delete(memberAccounts);
      vi.stubEnv("AUTH_PEPPER", "private-review-test-only-pepper");
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      vi.stubEnv("MAIL_ENABLED", "false");
      vi.stubEnv("OAUTH_SERVER_URL", "");
    });
    async function member(email = "reviewer@example.com", verified = true) {
      const result = await registerMember({
        email,
        name: "Review tester",
        password: "local acceptance password only",
      });
      if (verified)
        await database()
          .update(memberAccounts)
          .set({ emailVerifiedAt: new Date() })
          .where(eq(memberAccounts.id, result.member.id));
      return { result, auth: (await authenticateMemberSession(result.token))! };
    }
    const input = (email = "reviewer@example.com") =>
      reviewWorkspaceInput.parse({
        email,
        privateOnly: true,
        note: "Authorized private Google Play review access; no payment received.",
      });
    async function caller(
      user?: any,
      token?: string,
      origin = "https://providerbeacon.com"
    ) {
      const ctx = await createContext({
        req: {
          headers: {
            origin,
            cookie: token ? `${memberCookieName("session")}=${token}` : "",
            "user-agent": "review acceptance",
          },
          socket: { remoteAddress: "127.0.0.1" },
          protocol: "https",
        } as any,
        res: { setHeader: vi.fn(), getHeader: vi.fn() } as any,
      } as any);
      return appRouter.createCaller({ ...ctx, user: user ?? null });
    }

    it("requires platform-owner authority, canonical Origin, and a verified active member", async () => {
      const reviewer = await member();
      const [staffUser] = await database()
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      await expect(
        (await caller()).admin.business.reviewWorkspace.provision(input())
      ).rejects.toThrow();
      await expect(
        (
          await caller(undefined, reviewer.result.token)
        ).admin.business.reviewWorkspace.provision(input())
      ).rejects.toThrow();
      for (const role of [
        "administrator",
        "provider_reviewer",
        "auditor",
      ] as const) {
        await database()
          .update(teamMembers)
          .set({ role })
          .where(eq(teamMembers.userId, actorId()));
        const api = await caller(staffUser);
        await expect(
          api.admin.business.reviewWorkspace.state()
        ).rejects.toThrow();
        await expect(
          api.admin.business.reviewWorkspace.provision(input())
        ).rejects.toThrow();
      }
      await database()
        .update(teamMembers)
        .set({ role: "owner" })
        .where(eq(teamMembers.userId, actorId()));
      await expect(
        (
          await caller(staffUser, undefined, "https://evil.example")
        ).admin.business.reviewWorkspace.provision(input())
      ).rejects.toThrow("staff_origin");
      const api = await caller(staffUser);
      await expect(
        api.admin.business.reviewWorkspace.provision(
          input("missing@example.com")
        )
      ).rejects.toThrow("review_verified_member_required");
      await member("unverified@example.com", false);
      await expect(
        api.admin.business.reviewWorkspace.provision(
          input("unverified@example.com")
        )
      ).rejects.toThrow("review_verified_member_required");
      const first = await api.admin.business.reviewWorkspace.provision(input());
      const repeated =
        await api.admin.business.reviewWorkspace.provision(input());
      expect(repeated.providerId).toBe(first.providerId);
      expect(await api.admin.business.reviewWorkspace.state()).toMatchObject({
        email: "reviewer@example.com",
        state: "active",
      });
      await member("other@example.com");
      await expect(
        api.admin.business.reviewWorkspace.provision(input("other@example.com"))
      ).rejects.toThrow("review_owner_conflict");
      const audit = await database()
        .select()
        .from(auditEntries)
        .where(
          eq(auditEntries.action, "business.review_workspace.provisioned")
        );
      expect(audit).toHaveLength(2);
      expect(audit[0].metadata).toMatchObject({
        privateOnly: true,
        paymentCreated: false,
        access: "complimentary_review",
      });
    });

    it("uses normal owned tools while excluding even approved content and direct lookups from all public surfaces", async () => {
      const reviewer = await member();
      const stranger = await member("stranger@example.com");
      const { providerId } = await provisionReviewWorkspace(actorId(), input());
      expect(
        (await businessWorkspace(reviewer.auth)).providers[0]
      ).toMatchObject({
        provider: { id: providerId, isReviewWorkspace: true },
        ownershipValid: true,
        subscription: { state: "active" },
      });
      expect(
        (await businessAnalytics(reviewer.auth, providerId, 7)).totals
      ).toMatchObject({ views: 0, website: 0, telegram: 0 });
      await expect(
        businessAnalytics(stranger.auth, providerId, 7)
      ).rejects.toThrow("owner_required");
      await expect(
        prepareOwnershipClaim(stranger.auth, providerId)
      ).rejects.toThrow("provider_unavailable");
      const promotion = await savePromotion(reviewer.auth, {
        providerId,
        title: "Private review sample",
        description:
          "Sample terms for app review only; this is not a customer offer.",
        couponCode: "REVIEW",
        destinationUrl: "https://providerbeacon.com/",
        startsAt: new Date(Date.now() - 1000),
        endsAt: new Date(Date.now() + 86400000),
      });
      expect(
        (await ownPromotions(reviewer.auth, providerId)).items
      ).toHaveLength(1);
      const group = await createGroup(
        { member: reviewer.auth, providerId },
        groupInput.parse({
          providerId,
          name: "Review group fixture",
          description: "Local test fixture for private review isolation.",
          url: "https://t.me/review_test_fixture",
          topic: "support",
          language: "en",
          evidenceUrl: "https://providerbeacon.com/",
        })
      );
      // Deliberately mark fixtures approved: privacy must not depend on moderation.
      await database()
        .update(offers)
        .set({ status: "approved" })
        .where(eq(offers.id, promotion.id));
      await database()
        .update(communityGroups)
        .set({ status: "approved" })
        .where(eq(communityGroups.id, group.id));
      await database()
        .insert(providerVipCards)
        .values({
          providerId,
          ownerMemberId: reviewer.auth.member.id,
          websiteHost: "providerbeacon.com",
          tagline: "Review fixture private card",
          specialties: ["Testing"],
          coverId: "a".repeat(64),
          offer: "",
          status: "approved",
        });
      const [service] = await database()
        .insert(serviceRecords)
        .values({
          providerId,
          slug: "private-review-service",
          name: "Review service",
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
          evidenceUrl: "https://providerbeacon.com/",
          sourceUpdatedAt: new Date(),
        })
        .$returningId();
      for (const scope of [
        "home",
        "providers",
        "services",
        "compare",
        "provider",
      ] as const) {
        const data = await getMarketplaceSnapshot({
          scope,
          providerIds: [providerId],
          ...(scope === "provider" ? { slug: REVIEW_WORKSPACE_SLUG } : {}),
        });
        expect(data.source).toBe("database");
        expect(data.providers).toEqual([]);
        expect(data.services).toEqual([]);
      }
      expect(await assistantOffersByIds([`service-${service.id}`])).toEqual([]);
      expect(await groupProviders("ProviderBeacon Review")).toEqual([]);
      expect(
        (await publicGroups(groupListInput.parse({ providerId }))).items
      ).toEqual([]);
      expect((await publicPromotions({ providerId })).items).toEqual([]);
      expect((await publicVipCards({ page: 1 })).items).toEqual([]);
      await expect(
        startProviderCheckout(reviewer.auth, providerId, "paypal")
      ).rejects.toThrow("review_workspace");
      expect(
        await database()
          .select()
          .from(providerPayments)
          .where(eq(providerPayments.providerId, providerId))
      ).toEqual([]);
      await expect(
        saveProviderIntegration({
          providerId,
          name: "Forbidden live connection",
          baseUrl: "https://provider.example/api/v2",
          apiKey: "local-test-key-only",
          enabled: true,
          syncIntervalMinutes: 60,
          actorUserId: actorId(),
        })
      ).rejects.toThrow("cannot connect live provider APIs");
      const account = await adminBusinessAccount(providerId);
      await revokeBusinessOwner(actorId(), {
        providerId,
        revision: account.subscription.revision,
        note: "End private test access",
      });
      await expect(
        businessAnalytics(reviewer.auth, providerId, 7)
      ).rejects.toThrow("owner_required");
      expect((await businessWorkspace(reviewer.auth)).providers).toEqual([]);
    });

    it("never converts an existing ordinary provider into a review tenant", async () => {
      await member();
      await database()
        .insert(providerRecords)
        .values({
          slug: REVIEW_WORKSPACE_SLUG,
          name: "Existing ordinary provider",
          initials: "EP",
          status: "active",
        });
      await expect(
        provisionReviewWorkspace(actorId(), input())
      ).rejects.toThrow("review_slug_conflict");
      const [existing] = await database()
        .select()
        .from(providerRecords)
        .where(eq(providerRecords.slug, REVIEW_WORKSPACE_SLUG));
      expect(existing).toMatchObject({
        name: "Existing ordinary provider",
        isReviewWorkspace: false,
      });
      expect(
        await database()
          .select()
          .from(accounts)
          .where(eq(accounts.providerId, existing.id))
      ).toEqual([]);
    });
  });
}
