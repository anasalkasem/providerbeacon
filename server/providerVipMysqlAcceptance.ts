import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  providerRecords,
  teamMembers,
  users,
  auditEntries,
} from "../drizzle/schema";
import { memberAccounts, memberAuthBuckets } from "../drizzle/memberSchema";
import { providerBusinessAccounts as accounts } from "../drizzle/businessSchema";
import {
  providerVipCards as cards,
  providerVipDaily,
  providerVipDedupe,
} from "../drizzle/vipSchema";
import { providerAnalyticsLimits } from "../drizzle/analyticsSchema";
import { importedMedia } from "../drizzle/linkMetadataSchema";
import { authenticateMemberSession, registerMember } from "./memberDb";
import {
  saveVipCard,
  ownVipCard,
  reviewVipCard,
  withdrawVipCard,
  publicVipCards,
  recordVipEvent,
  vipAnalytics,
  cleanupVipAnalytics,
  grantComplimentaryVip,
  revokeComplimentaryVip,
  vipGrantState,
} from "./providerVipDb";
import { cleanupImportedMedia } from "./linkMetadata";
import { createContext } from "./_core/context";
import { memberCookieName } from "./memberSecurity";
import { appRouter } from "./routers";

const cover =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK2sAAAAASUVORK5CYII=";
export function providerVipAcceptanceCases(
  database: () => any,
  actorId: () => number,
  providerId: () => number
) {
  describe("VIP album lifecycle, access and measurement", () => {
    beforeEach(async () => {
      await database().delete(memberAccounts);
      await database().delete(memberAuthBuckets);
      await database().delete(providerAnalyticsLimits);
      vi.stubEnv("AUTH_PEPPER", "vip-local-test-pepper");
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      vi.stubEnv("MAIL_ENABLED", "false");
      vi.stubEnv("OAUTH_SERVER_URL", "");
      await database()
        .update(providerRecords)
        .set({ websiteUrl: "https://provider.example/" })
        .where(eq(providerRecords.id, providerId()));
    });
    async function member(email = "vip-owner@example.com") {
      const result = await registerMember({
        name: "VIP owner",
        email,
        password: "a long local VIP test account password",
      });
      await database()
        .update(memberAccounts)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(memberAccounts.id, result.member.id));
      return {
        ...result,
        auth: (await authenticateMemberSession(result.token))!,
      };
    }
    async function owner() {
      const user = await member();
      await database()
        .insert(accounts)
        .values({
          providerId: providerId(),
          ownerMemberId: user.member.id,
          ownerHost: "provider.example",
          ownershipVerifiedAt: new Date(),
          status: "active",
          startsAt: new Date(Date.now() - 86400000),
          endsAt: new Date(Date.now() + 86400000),
        });
      return user;
    }
    const input = () => ({
      providerId: providerId(),
      revision: 0,
      tagline: "A provider with clearly described services",
      specialties: ["Telegram", "Instagram"],
      offer: "",
      offerEndsAt: null,
      cover,
    });
    const list = () => publicVipCards({ page: 1, rotation: 0 });
    const review = (
      revision = 1,
      decision: "approved" | "hidden" | "rejected" = "approved"
    ) =>
      reviewVipCard(actorId(), {
        providerId: providerId(),
        revision,
        decision,
        contentConfirmed: true,
        note: "Reviewed cover and all advertised details",
      });
    async function published() {
      const user = await owner();
      await saveVipCard(user.auth, input());
      await review();
      return user;
    }
    const event = (
      revision = 2,
      kind: "click" | "impression" = "impression"
    ) => ({
      providerId: providerId(),
      revision,
      kind,
      visitorId: "550e8400-e29b-41d4-a716-446655440000",
    });
    const keys = { visitorKey: "a".repeat(64), clientKey: "b".repeat(64) };
    const grantInput = (revision = 0) => ({
      providerId: providerId(),
      revision,
      durationDays: 30 as const,
      tagline: "Explore this real provider's services and terms",
      contentConfirmed: true as const,
      note: "Platform owner complimentary placement",
    });
    async function caller(
      token?: string,
      origin = "https://providerbeacon.com",
      user?: any
    ) {
      const res = { setHeader: vi.fn(), getHeader: vi.fn() } as any;
      const ctx = await createContext({
        req: {
          headers: {
            origin,
            cookie: token ? `${memberCookieName("session")}=${token}` : "",
            "user-agent": "VIP acceptance",
          },
          socket: { remoteAddress: "127.0.0.1" },
          protocol: "https",
        } as any,
        res,
      } as any);
      return appRouter.createCaller({ ...ctx, user: user ?? null });
    }

    it("publishes only reviewed paid cards and exposes no owner, draft or review metadata", async () => {
      const user = await owner();
      await saveVipCard(user.auth, input());
      expect((await list()).items).toEqual([]);
      await review();
      const result = await list();
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        name: "Test provider",
        ownershipVerified: true,
        revision: 2,
      });
      expect(JSON.stringify(result)).not.toMatch(
        /ownerMemberId|websiteHost|reviewNote|vip-owner|base64/
      );
      const [provider] = await database()
        .select()
        .from(providerRecords)
        .where(eq(providerRecords.id, providerId()));
      expect(provider.verified).toBe(false);
    });
    it("returns edited cards to review and rejects stale edits and reviews", async () => {
      const user = await published();
      await saveVipCard(user.auth, {
        ...input(),
        revision: 2,
        cover: undefined,
        tagline: "Updated wording needs a fresh review",
      });
      expect((await list()).items).toEqual([]);
      await expect(review(2)).rejects.toThrow("business_stale");
      await expect(
        saveVipCard(user.auth, { ...input(), revision: 2 })
      ).rejects.toThrow("business_stale");
      await review(3);
      expect((await list()).items[0].tagline).toBe(
        "Updated wording needs a fresh review"
      );
    });
    it("paginates a stable rotation without repeating or losing eligible providers", async () => {
      const user = await published();
      const original = (await ownVipCard(user.auth, providerId()))!;
      const { coverUrl: _url, ...template } = original;
      for (let i = 0; i < 9; i++) {
        const [p] = await database()
          .insert(providerRecords)
          .values({
            slug: `vip-page-${i}`,
            name: `VIP fixture ${i}`,
            initials: "VP",
            websiteUrl: "https://provider.example/",
            status: "active",
          })
          .$returningId();
        await database()
          .insert(accounts)
          .values({
            providerId: p.id,
            ownerMemberId: user.member.id,
            ownerHost: "provider.example",
            ownershipVerifiedAt: new Date(),
            status: "active",
            startsAt: new Date(Date.now() - 86400000),
            endsAt: new Date(Date.now() + 86400000),
          });
        await database()
          .insert(cards)
          .values({ ...template, providerId: p.id });
      }
      const first = await publicVipCards({ page: 1, rotation: 7 });
      const second = await publicVipCards({
        page: 2,
        rotation: first.rotation,
      });
      expect(first.items).toHaveLength(8);
      expect(second.items).toHaveLength(2);
      expect(
        new Set([...first.items, ...second.items].map(c => c.providerId)).size
      ).toBe(10);
    });
    it("serializes simultaneous first submissions into one card per provider", async () => {
      const user = await owner();
      const results = await Promise.allSettled([
        saveVipCard(user.auth, input()),
        saveVipCard(user.auth, input()),
      ]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(await database().select().from(cards)).toHaveLength(1);
    });
    it("hides cards immediately on expiry, suspension, invalid ownership or a hidden provider", async () => {
      const user = await published();
      for (const patch of [
        { endsAt: new Date(Date.now() - 1000) },
        { status: "suspended" },
        { startsAt: new Date(Date.now() + 86400000) },
        { ownershipVerifiedAt: null },
        { ownerHost: "changed.example" },
      ]) {
        await database()
          .update(accounts)
          .set(patch)
          .where(eq(accounts.providerId, providerId()));
        expect((await list()).items).toEqual([]);
        expect(await recordVipEvent(event(), keys)).toBe("ignored");
        await database()
          .update(accounts)
          .set({
            endsAt: new Date(Date.now() + 86400000),
            startsAt: new Date(Date.now() - 86400000),
            status: "active",
            ownershipVerifiedAt: new Date(),
            ownerHost: "provider.example",
          })
          .where(eq(accounts.providerId, providerId()));
      }
      await database()
        .update(providerRecords)
        .set({ status: "suspended" })
        .where(eq(providerRecords.id, providerId()));
      expect((await list()).items).toEqual([]);
      await database()
        .update(providerRecords)
        .set({ status: "active", websiteUrl: "https://changed.example/" })
        .where(eq(providerRecords.id, providerId()));
      expect((await list()).items).toEqual([]);
      await database()
        .update(providerRecords)
        .set({ websiteUrl: "https://provider.example/" })
        .where(eq(providerRecords.id, providerId()));
      await database()
        .update(memberAccounts)
        .set({ status: "suspended" })
        .where(eq(memberAccounts.id, user.member.id));
      expect((await list()).items).toEqual([]);
    });
    it("rejects foreign owners, unverified accounts and unpaid writes while allowing withdrawal after expiry", async () => {
      const user = await published(),
        foreign = await member("vip-other@example.com");
      await expect(ownVipCard(foreign.auth, providerId())).rejects.toThrow(
        "business_owner_required"
      );
      await expect(
        saveVipCard(foreign.auth, { ...input(), revision: 2 })
      ).rejects.toThrow("business_owner_required");
      await database()
        .update(memberAccounts)
        .set({ emailVerifiedAt: null })
        .where(eq(memberAccounts.id, user.member.id));
      await expect(ownVipCard(user.auth, providerId())).rejects.toThrow(
        "business_verify_email"
      );
      await database()
        .update(memberAccounts)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(memberAccounts.id, user.member.id));
      await database()
        .update(accounts)
        .set({ endsAt: new Date(Date.now() - 1000) })
        .where(eq(accounts.providerId, providerId()));
      await expect(
        saveVipCard(user.auth, { ...input(), revision: 2 })
      ).rejects.toThrow("business_subscription_required");
      await expect(vipAnalytics(user.auth, providerId(), 30)).rejects.toThrow(
        "business_subscription_required"
      );
      await withdrawVipCard(user.auth, {
        providerId: providerId(),
        revision: 2,
      });
      expect((await ownVipCard(user.auth, providerId()))?.status).toBe(
        "hidden"
      );
    });
    it("does not publish a previous owner's card when ownership changes", async () => {
      await published();
      const next = await member("vip-new@example.com");
      await database()
        .update(accounts)
        .set({ ownerMemberId: next.member.id })
        .where(eq(accounts.providerId, providerId()));
      expect((await list()).items).toEqual([]);
      expect(await ownVipCard(next.auth, providerId())).toBeNull();
      await expect(
        saveVipCard(next.auth, { ...input(), cover: undefined })
      ).rejects.toThrow("business_vip_cover");
      await saveVipCard(next.auth, input());
      expect((await ownVipCard(next.auth, providerId()))?.revision).toBe(3);
      expect((await list()).items).toEqual([]);
    });
    it("requires content confirmation and rechecks paid eligibility at approval", async () => {
      const user = await owner();
      await saveVipCard(user.auth, input());
      await expect(
        reviewVipCard(actorId(), {
          providerId: providerId(),
          revision: 1,
          decision: "approved",
          contentConfirmed: false,
          note: "Not yet reviewed the cover",
        })
      ).rejects.toThrow("business_review_required");
      await database()
        .update(accounts)
        .set({ status: "inactive" })
        .where(eq(accounts.providerId, providerId()));
      await expect(review()).rejects.toThrow("business_subscription_required");
    });
    it("removes expired offer copy without hiding an otherwise eligible card", async () => {
      await published();
      await database()
        .update(cards)
        .set({
          offer: "Old discount",
          offerEndsAt: new Date(Date.now() - 1000),
        })
        .where(eq(cards.providerId, providerId()));
      expect((await list()).items[0].offer).toBe("");
    });
    it("deduplicates concurrent events and keeps VIP measurements separate from profile views", async () => {
      const user = await published();
      const now = Date.now() - 1800001;
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          recordVipEvent(event(2, "click"), keys, now)
        )
      );
      expect(results.filter(r => r === "counted")).toHaveLength(1);
      expect(await vipAnalytics(user.auth, providerId(), 30)).toMatchObject({
        impressions: 1,
        clicks: 1,
      });
      expect(await recordVipEvent(event(1), keys, now + 1000)).toBe("ignored");
      expect(await recordVipEvent(event(), keys, now + 1800000)).toBe(
        "counted"
      );
      expect(await vipAnalytics(user.auth, providerId(), 30)).toMatchObject({
        impressions: 2,
        clicks: 1,
      });
    });
    it("enforces member identity, same-origin writes and staff business permissions at the API", async () => {
      const user = await owner();
      const anon = await caller();
      await expect(
        anon.business.vip.mine({
          accountId: user.member.id,
          providerId: providerId(),
        })
      ).rejects.toThrow();
      const api = await caller(user.token);
      await expect(
        api.business.vip.mine({
          accountId: user.member.id + 1,
          providerId: providerId(),
        })
      ).rejects.toThrow("business_owner_required");
      await expect(
        (await caller(user.token, "https://evil.example")).business.vip.submit(
          input()
        )
      ).rejects.toThrow();
      await saveVipCard(user.auth, input());
      const [staffUser] = await database()
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      await database()
        .update(teamMembers)
        .set({ role: "auditor" })
        .where(eq(teamMembers.userId, actorId()));
      await expect(
        (
          await caller(undefined, undefined, staffUser)
        ).admin.business.vip.review({
          providerId: providerId(),
          revision: 1,
          decision: "approved",
          contentConfirmed: true,
          note: "Forbidden auditor write test",
        })
      ).rejects.toThrow();
      await database()
        .update(teamMembers)
        .set({ role: "administrator" })
        .where(eq(teamMembers.userId, actorId()));
      await expect(
        (
          await caller(undefined, "https://evil.example", staffUser)
        ).admin.business.vip.review({
          providerId: providerId(),
          revision: 1,
          decision: "approved",
          contentConfirmed: true,
          note: "Forbidden cross origin write",
        })
      ).rejects.toThrow();
    });
    it("retains referenced cover images and cleans short-lived visitor digests", async () => {
      const user = await published();
      const card = (await ownVipCard(user.auth, providerId()))!;
      await database()
        .update(importedMedia)
        .set({ createdAt: new Date(Date.now() - 40 * 86400000) })
        .where(eq(importedMedia.id, card.coverId));
      await cleanupImportedMedia();
      expect(
        await database()
          .select()
          .from(importedMedia)
          .where(eq(importedMedia.id, card.coverId))
      ).toHaveLength(1);
      await recordVipEvent(event(), keys);
      await cleanupVipAnalytics(Date.now() + 3 * 86400000);
      expect(await database().select().from(providerVipDedupe)).toHaveLength(0);
      expect(await database().select().from(providerVipDaily)).toHaveLength(1);
    });

    it("grants an unowned real provider VIP without creating billing, payments or verified ownership", async () => {
      const started = Date.now();
      const grant = await grantComplimentaryVip(actorId(), grantInput());
      expect(grant.endsAt.getTime()).toBeGreaterThanOrEqual(
        started + 30 * 86400000
      );
      expect(await database().select().from(accounts)).toEqual([]);
      const result = await list();
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        placement: "complimentary",
        ownershipVerified: false,
        coverUrl: "",
        revision: 1,
      });
      expect(result.items[0].endsAt).toEqual(grant.endsAt);
      expect(JSON.stringify(result)).not.toMatch(
        /ownerMemberId|reviewNote|complimentaryEndsAt/
      );
      expect(
        (await database().select().from(providerRecords))[0].verified
      ).toBe(false);
      expect((await database().select().from(auditEntries))[0]).toMatchObject({
        actorUserId: actorId(),
        action: "business.vip.complimentary.granted",
      });
      expect(await recordVipEvent(event(1), keys)).toBe("counted");
    });

    it("restricts grants and revocation to the platform owner and rejects cross-origin writes", async () => {
      const user = await member();
      const [staffUser] = await database()
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      await expect(
        (await caller()).admin.business.vip.grant(grantInput())
      ).rejects.toThrow();
      await expect(
        (await caller(user.token)).admin.business.vip.grant(grantInput())
      ).rejects.toThrow();
      for (const role of [
        "administrator",
        "auditor",
        "provider_reviewer",
      ] as const) {
        await database()
          .update(teamMembers)
          .set({ role })
          .where(eq(teamMembers.userId, actorId()));
        const api = await caller(undefined, undefined, staffUser);
        await expect(
          api.admin.business.vip.grantState({ providerId: providerId() })
        ).rejects.toThrow();
        await expect(
          api.admin.business.vip.grant(grantInput())
        ).rejects.toThrow();
        await expect(
          api.admin.business.vip.revokeGrant({
            providerId: providerId(),
            revision: 1,
            note: "Unauthorized staff revocation",
          })
        ).rejects.toThrow();
      }
      await database()
        .update(teamMembers)
        .set({ role: "owner" })
        .where(eq(teamMembers.userId, actorId()));
      const api = await caller(undefined, undefined, staffUser);
      await expect(
        (
          await caller(undefined, "https://evil.example", staffUser)
        ).admin.business.vip.grant(grantInput())
      ).rejects.toThrow();
      await api.admin.business.vip.grant(grantInput());
      expect(
        (await api.admin.business.vip.grantState({ providerId: providerId() }))
          .card?.placement
      ).toBe("complimentary");
      await expect(
        (
          await caller(undefined, "https://evil.example", staffUser)
        ).admin.business.vip.revokeGrant({
          providerId: providerId(),
          revision: 1,
          note: "Cross-origin revocation attempt",
        })
      ).rejects.toThrow();
      await api.admin.business.vip.revokeGrant({
        providerId: providerId(),
        revision: 1,
        note: "Owner ended the promotion",
      });
      expect((await list()).items).toEqual([]);
      // Existing sessions must lose this permission immediately after a role change.
      await database()
        .update(teamMembers)
        .set({ role: "administrator" })
        .where(eq(teamMembers.userId, actorId()));
      await expect(
        api.admin.business.vip.grant(grantInput(2))
      ).rejects.toThrow();
    });

    it("does not replace active subscriber artwork or change subscription dates and pricing", async () => {
      await published();
      const [before] = await database().select().from(accounts);
      const oldCard = (await vipGrantState(providerId())).card;
      await expect(
        grantComplimentaryVip(actorId(), grantInput(2))
      ).rejects.toThrow("business_vip_paid_card");
      expect((await vipGrantState(providerId())).card).toEqual(oldCard);
      expect((await database().select().from(accounts))[0]).toEqual(before);
      await database()
        .update(accounts)
        .set({ endsAt: new Date(Date.now() - 1000) })
        .where(eq(accounts.providerId, providerId()));
      const [expired] = await database().select().from(accounts);
      await grantComplimentaryVip(actorId(), grantInput(2));
      await revokeComplimentaryVip(actorId(), {
        providerId: providerId(),
        revision: 3,
        note: "End the complimentary period",
      });
      expect((await database().select().from(accounts))[0]).toEqual(expired);
    });

    it("expires grants immediately for reads and analytics and rejects suspended or changed-domain providers", async () => {
      await grantComplimentaryVip(actorId(), { ...grantInput(), cover });
      for (const patch of [
        { complimentaryEndsAt: new Date(Date.now() - 1000) },
        { status: "hidden" },
      ]) {
        await database()
          .update(cards)
          .set(patch)
          .where(eq(cards.providerId, providerId()));
        expect((await list()).items).toEqual([]);
        expect(await recordVipEvent(event(1), keys)).toBe("ignored");
        await database()
          .update(cards)
          .set({
            status: "approved",
            complimentaryEndsAt: new Date(Date.now() + 86400000),
          })
          .where(eq(cards.providerId, providerId()));
      }
      for (const patch of [
        { status: "suspended" },
        { websiteUrl: "https://changed.example/" },
      ]) {
        await database()
          .update(providerRecords)
          .set(patch)
          .where(eq(providerRecords.id, providerId()));
        expect((await list()).items).toEqual([]);
        expect(await recordVipEvent(event(1), keys)).toBe("ignored");
        if (patch.status)
          await expect(
            grantComplimentaryVip(actorId(), grantInput(1))
          ).rejects.toThrow("business_provider_unavailable");
        await database()
          .update(providerRecords)
          .set({ status: "active", websiteUrl: "https://provider.example/" })
          .where(eq(providerRecords.id, providerId()));
      }
      expect((await list()).items).toHaveLength(1);
    });

    it("serializes complimentary grants, renews once, rejects stale revocation and allows only the owner route to manage them", async () => {
      const results = await Promise.allSettled([
        grantComplimentaryVip(actorId(), grantInput()),
        grantComplimentaryVip(actorId(), grantInput()),
      ]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      await expect(review(1, "hidden")).rejects.toThrow(
        "business_vip_owner_only"
      );
      await grantComplimentaryVip(actorId(), {
        ...grantInput(1),
        durationDays: 90,
      });
      await expect(
        revokeComplimentaryVip(actorId(), {
          providerId: providerId(),
          revision: 1,
          note: "Stale revocation is rejected",
        })
      ).rejects.toThrow("business_stale");
      await revokeComplimentaryVip(actorId(), {
        providerId: providerId(),
        revision: 2,
        note: "Owner ended the free placement",
      });
      expect((await list()).items).toEqual([]);
      expect(await recordVipEvent(event(3), keys)).toBe("ignored");
      await grantComplimentaryVip(actorId(), grantInput(3));
      expect((await list()).items).toHaveLength(1);
      expect(await database().select().from(cards)).toHaveLength(1);
    });

    it("lets a subscribed verified provider submit its own reviewed card after a platform promotion", async () => {
      const user = await owner();
      await grantComplimentaryVip(actorId(), grantInput());
      expect(await ownVipCard(user.auth, providerId())).toBeNull();
      await saveVipCard(user.auth, input());
      expect((await list()).items).toEqual([]);
      const card = (await ownVipCard(user.auth, providerId()))!;
      expect(card).toMatchObject({
        placement: "subscription",
        complimentaryEndsAt: null,
        status: "pending",
        revision: 2,
      });
      await review(2);
      expect((await list()).items[0]).toMatchObject({
        placement: "subscription",
        ownershipVerified: true,
      });
    });
  });
}
