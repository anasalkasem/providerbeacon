import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  providerBusinessAccounts as accounts,
  providerOwnershipClaims as claims,
  providerPromotions as promotions,
} from "../drizzle/businessSchema";
import { communityGroups as groups } from "../drizzle/communitySchema";
import { memberAccounts, memberAuthBuckets } from "../drizzle/memberSchema";
import {
  providerAnalyticsDaily,
  providerAnalyticsState,
} from "../drizzle/analyticsSchema";
import {
  auditEntries,
  providerRecords,
  users,
  teamMembers,
} from "../drizzle/schema";
import { importedMedia } from "../drizzle/linkMetadataSchema";
import { cleanupImportedMedia } from "./linkMetadata";
import { groupInput, groupListInput } from "../shared/community";
import {
  BUSINESS_DAY_MS,
  PROMOTIONS_PER_MONTH,
} from "../shared/providerBusiness";
import { analyticsDate } from "../shared/providerAnalytics";
import { providerMonthAnniversary } from "../shared/providerBusinessPricing";
import {
  authenticateMemberSession,
  logoutMember,
  registerMember,
} from "./memberDb";
import { memberCookieName } from "./memberSecurity";
import { createContext } from "./_core/context";
import { appRouter } from "./routers";
import {
  adminBusinessAccount,
  businessAnalytics,
  businessOverview,
  businessWorkspace,
  ownPromotions,
  prepareOwnershipClaim,
  publicPromotions,
  reviewOwnershipClaim,
  reviewPromotion,
  revokeBusinessOwner,
  savePromotion,
  saveOwnerPromotion,
  setBusinessSubscription,
  submitOwnershipProof,
  withdrawPromotion,
} from "./providerBusinessDb";
import {
  createGroup,
  editGroup,
  publicGroups,
  reviewGroup,
} from "./communityDb";
import {
  getCachedMarketplaceSnapshot,
  getMarketplaceSnapshot,
} from "./marketplaceDb";

export function providerBusinessAcceptanceCases(
  database: () => any,
  actorId: () => number,
  providerId: () => number
) {
  describe("provider business ownership, subscriptions and paid tools", () => {
    beforeEach(async () => {
      await database().delete(groups);
      await database().delete(memberAccounts);
      await database().delete(memberAuthBuckets);
      await database()
        .update(providerRecords)
        .set({
          websiteUrl: "https://provider.example/",
          telegramUrl: "https://t.me/provider_paid_group",
        })
        .where(eq(providerRecords.id, providerId()));
      vi.stubEnv("AUTH_PEPPER", "business-local-test-pepper");
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      vi.stubEnv("MAIL_ENABLED", "false");
      vi.stubEnv("OAUTH_SERVER_URL", "");
    });
    async function member(
      email = "provider-owner@example.com",
      verified = true
    ) {
      const result = await registerMember({
        name: "Provider owner",
        email,
        password: "a long local provider owner password",
      });
      if (verified)
        await database()
          .update(memberAccounts)
          .set({ emailVerifiedAt: new Date() })
          .where(eq(memberAccounts.id, result.member.id));
      return { result, auth: (await authenticateMemberSession(result.token))! };
    }
    async function currentClaim(id: number) {
      return (
        await database().select().from(claims).where(eq(claims.id, id))
      )[0];
    }
    async function currentPromotion(id: number) {
      return (
        await database().select().from(promotions).where(eq(promotions.id, id))
      )[0];
    }
    async function approvedOwner() {
      const owner = await member();
      const { id } = await prepareOwnershipClaim(owner.auth, providerId());
      await submitOwnershipProof(owner.auth, {
        id,
        revision: 1,
        proofUrl: "https://provider.example/providerbeacon-verification.txt",
      });
      await reviewOwnershipClaim(actorId(), {
        id,
        revision: 2,
        decision: "approved",
        tokenConfirmed: true,
        note: "Checked the exact token on the provider domain",
      });
      return owner;
    }
    async function activate(
      status: "active" | "inactive" | "suspended" = "active"
    ) {
      const account = await adminBusinessAccount(providerId());
      return setBusinessSubscription(actorId(), {
        providerId: providerId(),
        revision: account.subscription.revision,
        status,
        startsAt: new Date(Date.now() - BUSINESS_DAY_MS),
        endsAt: new Date(Date.now() + 30 * BUSINESS_DAY_MS),
        note: "Manual test payment reference",
      });
    }
    const offerInput = () => ({
      providerId: providerId(),
      title: "September provider offer",
      description: "A time limited provider offer with clear conditions.",
      couponCode: "BEACON10",
      destinationUrl: "https://provider.example/offers",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 7 * BUSINESS_DAY_MS),
    });
    async function approveOffer(id: number) {
      const row = await currentPromotion(id);
      return reviewPromotion(actorId(), {
        id,
        revision: row.revision,
        decision: "approved",
        destinationConfirmed: true,
        note: "Reviewed the offer and destination terms",
      });
    }
    async function caller(
      token?: string,
      origin = "https://providerbeacon.com",
      user: any = null
    ) {
      const res = { setHeader: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn() };
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
        res,
      } as any);
      return { api: appRouter.createCaller({ ...ctx, user }), res };
    }

    it("requires email and first-party proof, keeps an unapproved claimant out and never changes quality scores", async () => {
      const unverified = await member("unverified-business@example.com", false);
      await expect(
        prepareOwnershipClaim(unverified.auth, providerId())
      ).rejects.toThrow("business_verify_email");
      const owner = await member();
      const { id } = await prepareOwnershipClaim(owner.auth, providerId());
      await expect(
        businessAnalytics(owner.auth, providerId(), 7)
      ).rejects.toThrow("business_owner_required");
      await expect(
        submitOwnershipProof(owner.auth, {
          id,
          revision: 1,
          proofUrl: "https://evil.example/proof",
        })
      ).rejects.toThrow("business_proof_domain");
      await submitOwnershipProof(owner.auth, {
        id,
        revision: 1,
        proofUrl: "https://provider.example/providerbeacon-verification.txt",
      });
      await expect(
        reviewOwnershipClaim(actorId(), {
          id,
          revision: 2,
          decision: "approved",
          tokenConfirmed: false,
          note: "Skipped checking the token",
        })
      ).rejects.toThrow("business_review_required");
      await reviewOwnershipClaim(actorId(), {
        id,
        revision: 2,
        decision: "approved",
        tokenConfirmed: true,
        note: "Verified the exact domain challenge",
      });
      const workspace = await businessWorkspace(owner.auth);
      expect(workspace.providers[0]).toMatchObject({
        ownershipValid: true,
        subscription: { state: "inactive" },
      });
      await expect(
        businessAnalytics(owner.auth, providerId(), 7)
      ).rejects.toThrow("business_subscription_required");
      await activate();
      const snapshot = await getMarketplaceSnapshot({ scope: "providers" });
      expect(snapshot.providers[0]).toMatchObject({
        verified: false,
        score: null,
      });
      const audit = await database().select().from(auditEntries);
      expect(audit.map((r: any) => r.action)).toContain(
        "business.subscription.updated"
      );
      expect(JSON.stringify(audit)).not.toContain(
        (await currentClaim(id)).token
      );
    });

    it("serializes competing ownership approvals and rejects expired or stale challenges", async () => {
      const a = await member();
      const b = await member("second-owner@example.com");
      const first = await prepareOwnershipClaim(a.auth, providerId());
      const second = await prepareOwnershipClaim(b.auth, providerId());
      for (const [owner, claim] of [
        [a, first],
        [b, second],
      ] as const)
        await submitOwnershipProof(owner.auth, {
          id: claim.id!,
          revision: 1,
          proofUrl: "https://provider.example/providerbeacon-verification.txt",
        });
      const approvals = await Promise.allSettled(
        [first, second].map(row =>
          reviewOwnershipClaim(actorId(), {
            id: row.id!,
            revision: 2,
            decision: "approved",
            tokenConfirmed: true,
            note: "Verified the requested ownership code",
          })
        )
      );
      expect(approvals.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(
        (await database().select().from(accounts))[0].ownerMemberId
      ).toBeTruthy();
      const loser = approvals[0].status === "fulfilled" ? second : first;
      const failed = approvals.find(r => r.status === "rejected");
      expect(failed).toMatchObject({ reason: { message: "business_claimed" } });
      expect((await currentClaim(loser.id!)).status).toBe("pending");
    });

    it("rotates expired challenges and rejects proofs for the previous revision or a changed provider domain", async () => {
      const owner = await member();
      const first = await prepareOwnershipClaim(owner.auth, providerId());
      const old = await currentClaim(first.id!);
      await database()
        .update(claims)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(claims.id, first.id!));
      await expect(
        submitOwnershipProof(owner.auth, {
          id: first.id!,
          revision: 1,
          proofUrl: "https://provider.example/providerbeacon-verification.txt",
        })
      ).rejects.toThrow("business_claim_expired");
      await prepareOwnershipClaim(owner.auth, providerId());
      const renewed = await currentClaim(first.id!);
      expect(renewed.token).not.toBe(old.token);
      await expect(
        submitOwnershipProof(owner.auth, {
          id: first.id!,
          revision: 1,
          proofUrl: "https://provider.example/providerbeacon-verification.txt",
        })
      ).rejects.toThrow("business_changed");
      await database()
        .update(providerRecords)
        .set({ websiteUrl: "https://changed.example/" })
        .where(eq(providerRecords.id, providerId()));
      await expect(
        submitOwnershipProof(owner.auth, {
          id: first.id!,
          revision: 2,
          proofUrl: "https://changed.example/providerbeacon-verification.txt",
        })
      ).rejects.toThrow("business_proof_domain");
    });

    it("hides unpaid groups and cached Telegram links, restores reviewed records on renewal and preserves free community groups", async () => {
      const owner = await approvedOwner();
      const group = groupInput.parse({
        name: "Paid provider group",
        description:
          "A provider group with published sales and support information.",
        url: "https://t.me/paid_provider_group",
        providerId: providerId(),
        evidenceUrl: "https://provider.example/community",
        topic: "offers",
        language: "en",
      });
      await expect(
        createGroup({ member: owner.auth, providerId: providerId() }, group)
      ).rejects.toThrow("business_subscription_required");
      const { id } = await createGroup({ actorId: actorId() }, group);
      await reviewGroup(actorId(), {
        id,
        revision: 1,
        decision: "approved",
        groupConfirmed: true,
        providerConfirmed: true,
        note: "Checked the provider group and its evidence",
      });
      expect((await publicGroups(groupListInput.parse({}))).items).toEqual([]);
      expect(
        (await getCachedMarketplaceSnapshot({ scope: "providers" }))
          .providers[0].telegramUrl
      ).toBeNull();
      await activate();
      expect((await publicGroups(groupListInput.parse({}))).items[0].id).toBe(
        id
      );
      expect(
        (await getCachedMarketplaceSnapshot({ scope: "providers" }))
          .providers[0].telegramUrl
      ).toBe("https://t.me/provider_paid_group");
      await database()
        .update(accounts)
        .set({ endsAt: new Date(Date.now() - 1) })
        .where(eq(accounts.providerId, providerId()));
      expect((await publicGroups(groupListInput.parse({}))).total).toBe(0);
      expect(
        (await getCachedMarketplaceSnapshot({ scope: "providers" }))
          .providers[0].telegramUrl
      ).toBeNull();
      expect((await database().select().from(groups))[0]).toMatchObject({
        id,
        status: "approved",
        revision: 2,
      });
      await activate();
      expect((await publicGroups(groupListInput.parse({}))).items[0].id).toBe(
        id
      );
      await activate("suspended");
      const free = await createGroup(
        { actorId: actorId() },
        {
          ...group,
          name: "Independent discussion",
          url: "https://t.me/community_only_group",
          providerId: null,
          evidenceUrl: "",
        }
      );
      await reviewGroup(actorId(), {
        id: free.id,
        revision: 1,
        decision: "approved",
        groupConfirmed: true,
        providerConfirmed: false,
        note: "Checked independent community discussion",
      });
      expect(
        (await publicGroups(groupListInput.parse({}))).items.map(g => g.id)
      ).toEqual([free.id]);
    });

    it("cannot turn a provider group free by unlinking it or deleting its provider", async () => {
      const owner = await approvedOwner();
      await activate();
      const input = groupInput.parse({
        name: "Owner provider group",
        description: "A reviewed group belonging to the provider business.",
        url: "https://t.me/owner_provider_group",
        providerId: providerId(),
        evidenceUrl: "https://provider.example/community",
        topic: "support",
        language: "en",
      });
      const { id } = await createGroup(
        { member: owner.auth, providerId: providerId() },
        input
      );
      await expect(
        editGroup(
          { member: owner.auth },
          { ...input, id, revision: 1, providerId: null, evidenceUrl: "" }
        )
      ).rejects.toThrow("groups_evidence_required");
      await reviewGroup(actorId(), {
        id,
        revision: 1,
        decision: "approved",
        groupConfirmed: true,
        providerConfirmed: true,
        note: "Verified group and provider connection",
      });
      await database()
        .delete(providerRecords)
        .where(eq(providerRecords.id, providerId()));
      expect((await database().select().from(groups))[0]).toMatchObject({
        providerId: null,
        requiresSubscription: true,
      });
      expect((await publicGroups(groupListInput.parse({}))).items).toEqual([]);
    });

    it("returns only the signed-in owner’s analytics, rejects forged partitions and rechecks subscription expiry", async () => {
      const owner = await approvedOwner();
      await activate();
      const other = await member("business-stranger@example.com");
      const [anotherProvider] = await database()
        .insert(providerRecords)
        .values({
          slug: "another-business",
          name: "Other provider",
          initials: "OT",
          status: "active",
        })
        .$returningId();
      const now = Date.now();
      await database()
        .update(providerAnalyticsState)
        .set({ startedAt: new Date(now - 90 * BUSINESS_DAY_MS) })
        .where(eq(providerAnalyticsState.id, 1));
      await database()
        .insert(providerAnalyticsDaily)
        .values([
          {
            providerId: providerId(),
            day: analyticsDate(now),
            views: 8,
            website: 3,
            telegram: 2,
          },
          {
            providerId: anotherProvider.id,
            day: analyticsDate(now),
            views: 900,
            website: 800,
            telegram: 700,
          },
          {
            providerId: providerId(),
            day: analyticsDate(now - 7 * BUSINESS_DAY_MS),
            views: 4,
            website: 1,
            telegram: 0,
          },
        ]);
      const { api, res } = await caller(owner.result.token);
      const report = await api.business.analytics({
        accountId: owner.auth.member.id,
        providerId: providerId(),
        days: 7,
      });
      expect(report.totals).toEqual({ views: 8, website: 3, telegram: 2 });
      expect(report.previous.totals.views).toBe(4);
      expect(report.providers.map(p => p.id)).toEqual([providerId()]);
      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      await expect(
        api.business.analytics({
          accountId: other.auth.member.id,
          providerId: providerId(),
          days: 7,
        })
      ).rejects.toThrow("business_owner_required");
      await expect(
        api.business.analytics({
          accountId: owner.auth.member.id,
          providerId: anotherProvider.id,
          days: 7,
        })
      ).rejects.toThrow("business_owner_required");
      await expect(
        (await caller(other.result.token)).api.business.analytics({
          accountId: other.auth.member.id,
          providerId: providerId(),
          days: 7,
        })
      ).rejects.toThrow("business_owner_required");
      await database()
        .update(accounts)
        .set({ endsAt: new Date(Date.now() - 1) })
        .where(eq(accounts.providerId, providerId()));
      await expect(
        api.business.analytics({
          accountId: owner.auth.member.id,
          providerId: providerId(),
          days: 7,
        })
      ).rejects.toThrow("business_subscription_required");
    });

    it("scopes dashboard totals to the owner and counts beyond pagination without publishing expired, foreign-domain or unpaid offers", async () => {
      const owner = await approvedOwner();
      await activate();
      const now = Date.now();
      await database()
        .insert(promotions)
        .values([
          ...Array.from({ length: 30 }, (_, i) => ({
            ...offerInput(),
            title: `Pending offer ${i}`,
            status: "pending",
          })),
          {
            ...offerInput(),
            title: "Visible offer",
            status: "approved",
            reviewedAt: new Date(),
            endsAt: new Date(now + BUSINESS_DAY_MS),
          },
          {
            ...offerInput(),
            title: "Old domain",
            status: "approved",
            reviewedAt: new Date(),
            destinationUrl: "https://old.example/offer",
          },
          {
            ...offerInput(),
            title: "Expired",
            status: "approved",
            reviewedAt: new Date(),
            endsAt: new Date(now - 1000),
          },
          {
            ...offerInput(),
            title: "Scheduled",
            status: "approved",
            reviewedAt: new Date(),
            startsAt: new Date(now + BUSINESS_DAY_MS),
          },
        ]);
      await database()
        .insert(groups)
        .values(
          [
            { status: "approved", reviewedAt: new Date() },
            { status: "approved", reviewedAt: null },
            { status: "pending", reviewedAt: null },
          ].map((state, index) => ({
            ...state,
            providerId: providerId(),
            submittedBy: owner.auth.member.id,
            name: `Dashboard group ${index}`,
            description: "Local dashboard acceptance fixture",
            url: `https://t.me/dashboard_fixture_${index}`,
            urlKey: `dashboard-fixture-${index}`,
            platform: "telegram",
            topic: "support",
            language: "en",
            requiresSubscription: true,
          }))
        );
      // Platform ads are managed by the owner and must not inflate member tools.
      await database().insert(promotions).values(
        ["pending", "rejected", "approved"].map(status => ({
          ...offerInput(),
          title: "Platform advertisement",
          placement: "platform",
          status,
          reviewedAt: status === "approved" ? new Date() : null,
          endsAt: new Date(now + 60_000),
        }))
      );
      const report = await businessOverview(owner.auth, providerId());
      expect(report.groups).toMatchObject({ total: 3, live: 1, pending: 1 });
      expect(report.offers).toMatchObject({
        total: 34,
        pending: 30,
        rejected: 0,
        live: 1,
        expiring: 1,
        nextExpiry: { title: "Visible offer" },
      });
      expect(report.usage).toMatchObject({ used: 34, limit: 5 });
      expect(report).not.toHaveProperty("analytics");
      const stranger = await member("dashboard-stranger@example.com");
      await expect(
        businessOverview(stranger.auth, providerId())
      ).rejects.toThrow("business_owner_required");
      const { api } = await caller(owner.result.token);
      await expect(
        api.business.overview({
          accountId: stranger.auth.member.id,
          providerId: providerId(),
        })
      ).rejects.toThrow("business_owner_required");
      await activate("suspended");
      expect(
        (await businessOverview(owner.auth, providerId())).groups.live
      ).toBe(0);
      expect(
        (await businessOverview(owner.auth, providerId())).offers
      ).toMatchObject({ total: 34, live: 0, expiring: 0, nextExpiry: null });
      await expect(
        businessAnalytics(owner.auth, providerId(), 7)
      ).rejects.toThrow("business_subscription_required");
      await database()
        .update(providerRecords)
        .set({ websiteUrl: "https://changed.example/" })
        .where(eq(providerRecords.id, providerId()));
      await expect(businessOverview(owner.auth, providerId())).rejects.toThrow(
        "business_owner_required"
      );
    });

    it("publishes only reviewed, current paid offers and sends edits back to review", async () => {
      const owner = await approvedOwner();
      await activate();
      const input = offerInput();
      const { id } = await savePromotion(owner.auth, input);
      expect((await publicPromotions({})).items).toEqual([]);
      await expect(
        reviewPromotion(actorId(), {
          id,
          revision: 1,
          decision: "approved",
          destinationConfirmed: false,
          note: "Unchecked offer destination",
        })
      ).rejects.toThrow("business_review_required");
      await approveOffer(id);
      expect((await publicPromotions({})).items[0]).toMatchObject({
        id,
        couponCode: "BEACON10",
      });
      expect(JSON.stringify(await publicPromotions({}))).not.toMatch(
        /createdByMemberId|reviewNote|ownerMemberId|token|email/
      );
      await savePromotion(owner.auth, {
        ...input,
        id,
        revision: 2,
        title: "Updated provider offer",
      });
      expect((await publicPromotions({})).items).toEqual([]);
      await expect(
        reviewPromotion(actorId(), {
          id,
          revision: 2,
          decision: "approved",
          destinationConfirmed: true,
          note: "Stale approval is not accepted",
        })
      ).rejects.toThrow("business_changed");
      await approveOffer(id);
      await database()
        .update(promotions)
        .set({ startsAt: new Date(Date.now() + BUSINESS_DAY_MS) })
        .where(eq(promotions.id, id));
      expect((await publicPromotions({})).items).toEqual([]);
      await database()
        .update(promotions)
        .set({ startsAt: input.startsAt, endsAt: new Date(Date.now() - 1) })
        .where(eq(promotions.id, id));
      expect((await publicPromotions({})).items).toEqual([]);
      expect((await ownPromotions(owner.auth, providerId())).items[0].id).toBe(
        id
      );
      await database()
        .update(promotions)
        .set({ endsAt: input.endsAt })
        .where(eq(promotions.id, id));
      await activate("suspended");
      expect((await publicPromotions({})).items).toEqual([]);
      await withdrawPromotion(owner.auth, {
        providerId: providerId(),
        id,
        revision: 4,
      });
      expect((await currentPromotion(id)).status).toBe("hidden");
    });

    it("keeps owner ads pending, retains artwork, searches content and obeys placement, revision and expiry", async () => {
      const input = {
        ...offerInput(),
        category: "Instagram" as const,
        title: "Independent ad headline",
        revision: 0,
        showInExplorer: true,
        note: "Owner advertisement acceptance",
        cover:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK2sAAAAASUVORK5CYII=",
      };
      const { id } = await saveOwnerPromotion(actorId(), input);
      expect((await publicPromotions({})).items).toEqual([]);
      await approveOffer(id);
      const published = (
        await publicPromotions({
          q: "Independent",
          category: "Instagram",
          explorer: true,
        })
      ).items;
      expect(published).toHaveLength(1);
      expect(published[0]).toMatchObject({
        id,
        title: input.title,
        placement: "platform",
      });
      expect(published[0].coverUrl).toMatch(
        /\/api\/imported-media\/[a-f0-9]{64}$/
      );
      expect((await publicPromotions({ q: "%" })).items).toEqual([]);
      expect((await publicPromotions({ category: "TikTok" })).items).toEqual(
        []
      );
      const row = await currentPromotion(id);
      await database()
        .update(importedMedia)
        .set({ createdAt: new Date(Date.now() - 40 * BUSINESS_DAY_MS) })
        .where(eq(importedMedia.id, row.coverId));
      await cleanupImportedMedia();
      expect(
        await database()
          .select()
          .from(importedMedia)
          .where(eq(importedMedia.id, row.coverId))
      ).toHaveLength(1);
      await saveOwnerPromotion(actorId(), {
        ...input,
        cover: undefined,
        id,
        revision: row.revision,
        showInExplorer: false,
      });
      expect((await publicPromotions({})).items).toEqual([]);
      await expect(
        saveOwnerPromotion(actorId(), { ...input, id, revision: row.revision })
      ).rejects.toThrow("business_changed");
      await approveOffer(id);
      expect((await publicPromotions({})).items[0].coverUrl).toBe(
        published[0].coverUrl
      );
      expect((await publicPromotions({ explorer: true })).items).toEqual([]);
      await database()
        .update(promotions)
        .set({ endsAt: new Date(Date.now() - 1000) })
        .where(eq(promotions.id, id));
      expect((await publicPromotions({})).items).toEqual([]);
    });

    it("does not let a provider edit a platform ad or move an existing ad to another provider", async () => {
      const owner = await approvedOwner();
      await activate();
      const input = {
        ...offerInput(),
        revision: 0,
        showInExplorer: false,
        note: "Owner advertisement acceptance",
      };
      const { id } = await saveOwnerPromotion(actorId(), input);
      expect((await ownPromotions(owner.auth, providerId())).items).toEqual([]);
      await expect(
        savePromotion(owner.auth, { ...offerInput(), id, revision: 1 })
      ).rejects.toThrow("business_owner_required");
      await expect(
        withdrawPromotion(owner.auth, {
          providerId: providerId(),
          id,
          revision: 1,
        })
      ).rejects.toThrow("business_owner_required");
      const [other] = await database()
        .insert(providerRecords)
        .values({
          name: "Other advertiser",
          initials: "OA",
          slug: "other-advertiser",
          status: "active",
          websiteUrl: "https://provider.example/",
        })
        .$returningId();
      await expect(
        saveOwnerPromotion(actorId(), {
          ...input,
          providerId: other.id,
          id,
          revision: 1,
        })
      ).rejects.toThrow("business_missing");
      await expect(
        saveOwnerPromotion(actorId(), {
          ...input,
          destinationUrl: "https://other.example/ad",
        })
      ).rejects.toThrow("business_destination_domain");
      await expect(
        saveOwnerPromotion(actorId(), {
          ...input,
          cover: "data:image/svg+xml;base64,PHN2Zy8+",
        })
      ).rejects.toThrow("business_vip_cover");
      expect((await currentPromotion(id)).revision).toBe(1);
    });

    it("restricts owner ad creation to the platform owner and rejects cross-origin publication", async () => {
      const [staff] = await database()
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      const input = {
        ...offerInput(),
        revision: 0,
        showInExplorer: false,
        note: "Owner advertisement acceptance",
      };
      const { api } = await caller(
        undefined,
        "https://providerbeacon.com",
        staff
      );
      await expect(api.admin.business.savePromotion(input)).rejects.toThrow(
        "business_vip_owner_only"
      );
      await database()
        .update(teamMembers)
        .set({ role: "owner" })
        .where(eq(teamMembers.userId, actorId()));
      await expect(
        (
          await caller(undefined, "https://evil.example", staff)
        ).api.admin.business.savePromotion(input)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        (
          await caller(undefined, "https://providerbeacon.com", staff)
        ).api.admin.business.savePromotion(input)
      ).resolves.toMatchObject({ revision: 1 });
    });

    it("enforces the monthly creation limit under concurrent submissions and never trusts supplied publication status", async () => {
      const owner = await approvedOwner();
      await activate();
      const input = offerInput();
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, (_, i) =>
          savePromotion(owner.auth, {
            ...input,
            title: `Provider promotion number ${i}`,
          })
        )
      );
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(
        PROMOTIONS_PER_MONTH
      );
      expect((await ownPromotions(owner.auth, providerId())).usage.used).toBe(
        PROMOTIONS_PER_MONTH
      );
      const { api } = await caller(owner.result.token);
      await expect(
        api.business.promotions.submit({ ...input, status: "approved" } as any)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        api.business.promotions.submit({
          ...input,
          destinationUrl: "https://evil.example/offers",
        })
      ).rejects.toThrow("business_destination_domain");
      expect((await publicPromotions({})).items).toEqual([]);
    });

    it("checks staff permissions, same-origin mutations and optimistic subscription revisions", async () => {
      const owner = await approvedOwner();
      const account = await adminBusinessAccount(providerId());
      const input = {
        providerId: providerId(),
        revision: account.subscription.revision,
        status: "active" as const,
        startsAt: new Date(Date.now() - 1000),
        endsAt: new Date(Date.now() + BUSINESS_DAY_MS),
        note: "Manual activation reference",
      };
      const [staff] = await database()
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      await expect(
        (await caller(owner.result.token)).api.admin.business.setSubscription(
          input
        )
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        (
          await caller(undefined, "https://evil.example", staff)
        ).api.admin.business.setSubscription(input)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const { api } = await caller(
        undefined,
        "https://providerbeacon.com",
        staff
      );
      await api.admin.business.setSubscription(input);
      await expect(api.admin.business.setSubscription(input)).rejects.toThrow(
        "business_changed"
      );
      await expect(
        (
          await caller(owner.result.token, "https://evil.example")
        ).api.business.promotions.submit(offerInput())
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await logoutMember(owner.result.token, true);
      await expect(savePromotion(owner.auth, offerInput())).rejects.toThrow();
    });

    it("preserves the first activation and 19/29 USD pricing through renewal, suspension and ownership revocation", async () => {
      const owner = await approvedOwner();
      expect(
        (await adminBusinessAccount(providerId())).subscription.pricing.phase
      ).toBe("not_started");
      const first = new Date(Date.now() - 20 * BUSINESS_DAY_MS);
      const write = async (
        status: "active" | "inactive" | "suspended",
        startsAt: Date | null,
        endsAt: Date | null
      ) => {
        const current = await adminBusinessAccount(providerId());
        return setBusinessSubscription(actorId(), {
          providerId: providerId(),
          revision: current.subscription.revision,
          status,
          startsAt,
          endsAt,
          note: "Recorded local subscription period",
        });
      };
      await write("inactive", first, providerMonthAnniversary(first, 1));
      expect(
        (await adminBusinessAccount(providerId())).subscription.firstActivatedAt
      ).toBeNull();
      await write("active", first, providerMonthAnniversary(first, 1));
      const initial = (await adminBusinessAccount(providerId())).subscription;
      expect(initial.firstActivatedAt).toEqual(first);
      expect(initial.pricing.currentMonthlyCents).toBe(1900);
      expect(initial.pricing.introEndsAt).toEqual(
        providerMonthAnniversary(first, 3)
      );
      await write(
        "active",
        providerMonthAnniversary(first, 1),
        providerMonthAnniversary(first, 2)
      );
      await write("suspended", null, null);
      await write("inactive", null, null);
      await write(
        "active",
        new Date(),
        providerMonthAnniversary(new Date(), 1)
      );
      const renewed = (await businessWorkspace(owner.auth)).providers[0]
        .subscription;
      expect(renewed.firstActivatedAt).toEqual(first);
      expect(renewed.pricing.introEndsAt).toEqual(initial.pricing.introEndsAt);
      await expect(
        write(
          "active",
          new Date(first.getTime() - BUSINESS_DAY_MS),
          providerMonthAnniversary(first, 1)
        )
      ).rejects.toThrow("business_pricing_start_fixed");
      const latest = await adminBusinessAccount(providerId());
      await revokeBusinessOwner(actorId(), {
        providerId: providerId(),
        revision: latest.subscription.revision,
        note: "Ownership change keeps the original pricing window",
      });
      expect(
        (await adminBusinessAccount(providerId())).subscription.firstActivatedAt
      ).toEqual(first);
    });

    it("returns the standard price after the introductory window and does not restart it on reactivation", async () => {
      const owner = await approvedOwner();
      const first = new Date(Date.now() - 120 * BUSINESS_DAY_MS);
      let current = await adminBusinessAccount(providerId());
      await setBusinessSubscription(actorId(), {
        providerId: providerId(),
        revision: current.subscription.revision,
        status: "active",
        startsAt: first,
        endsAt: new Date(Date.now() + BUSINESS_DAY_MS),
        note: "Long-running local subscription fixture",
      });
      current = await adminBusinessAccount(providerId());
      expect(current.subscription.pricing).toMatchObject({
        currency: "USD",
        phase: "standard",
        currentMonthlyCents: 2900,
      });
      await setBusinessSubscription(actorId(), {
        providerId: providerId(),
        revision: current.subscription.revision,
        status: "active",
        startsAt: new Date(),
        endsAt: providerMonthAnniversary(new Date(), 1),
        note: "Renew at the standard monthly price",
      });
      expect(
        (await businessWorkspace(owner.auth)).providers[0].subscription.pricing
      ).toMatchObject({ firstActivatedAt: first, currentMonthlyCents: 2900 });
    });

    it("removes owner access on revocation or domain change and suspends public paid tools without deleting content", async () => {
      const owner = await approvedOwner();
      await activate();
      const { id } = await savePromotion(owner.auth, offerInput());
      await approveOffer(id);
      await database()
        .update(providerRecords)
        .set({ websiteUrl: "https://changed.example/" })
        .where(eq(providerRecords.id, providerId()));
      expect(
        (await businessWorkspace(owner.auth)).providers[0].ownershipValid
      ).toBe(false);
      await expect(
        businessAnalytics(owner.auth, providerId(), 7)
      ).rejects.toThrow("business_owner_required");
      expect((await publicPromotions({})).items).toEqual([]);
      await database()
        .update(providerRecords)
        .set({ websiteUrl: "https://provider.example/" })
        .where(eq(providerRecords.id, providerId()));
      const account = await adminBusinessAccount(providerId());
      await revokeBusinessOwner(actorId(), {
        providerId: providerId(),
        revision: account.subscription.revision,
        note: "Ownership transfer requires a fresh verification",
      });
      expect((await businessWorkspace(owner.auth)).providers).toEqual([]);
      await expect(ownPromotions(owner.auth, providerId())).rejects.toThrow(
        "business_owner_required"
      );
      expect((await publicPromotions({})).items).toEqual([]);
      expect(await currentPromotion(id)).toBeTruthy();
    });
  });
}
