import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  communityGroups as groups,
  communityReports as reports,
} from "../drizzle/communitySchema";
import { memberAccounts, memberAuthBuckets } from "../drizzle/memberSchema";
import { auditEntries, providerRecords, users } from "../drizzle/schema";
import { groupInput, groupListInput } from "../shared/community";
import {
  adminGroups,
  createGroup,
  editGroup,
  groupProviders,
  groupReports,
  ownGroups,
  publicGroups,
  reportGroup,
  resolveGroupReport,
  reviewGroup,
  withdrawGroup,
} from "./communityDb";
import {
  authenticateMemberSession,
  logoutMember,
  registerMember,
} from "./memberDb";
import { memberCookieName } from "./memberSecurity";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";

export function communityAcceptanceCases(
  database: () => any,
  actorId: () => number,
  providerId: () => number
) {
  describe("community groups with real storage and authorization", () => {
    beforeEach(async () => {
      await database().delete(groups);
      await database().delete(memberAccounts);
      await database().delete(memberAuthBuckets);
      vi.stubEnv("AUTH_PEPPER", "groups-local-test-pepper");
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      vi.stubEnv("MAIL_ENABLED", "false");
      vi.stubEnv("OAUTH_SERVER_URL", "");
    });
    const input = (patch: Record<string, unknown> = {}) =>
      groupInput.parse({
        name: "Provider discussions",
        description: "A group for sharing practical provider experiences.",
        url: "https://t.me/beacon_test_group",
        topic: "providers",
        language: "ar",
        ...patch,
      });
    async function member(email = "groups@example.com", verified = true) {
      const result = await registerMember({
        name: "Group submitter",
        email,
        password: "a long local group password",
      });
      if (verified)
        await database()
          .update(memberAccounts)
          .set({ emailVerifiedAt: new Date() })
          .where(eq(memberAccounts.id, result.member.id));
      return { result, auth: (await authenticateMemberSession(result.token))! };
    }
    const list = (patch: Record<string, unknown> = {}) =>
      publicGroups(groupListInput.parse(patch));
    async function row(id: number) {
      return (
        await database().select().from(groups).where(eq(groups.id, id))
      )[0];
    }
    async function approve(id: number, providerConfirmed = false) {
      return reviewGroup(actorId(), {
        id,
        revision: (await row(id)).revision,
        decision: "approved",
        note: "Opened and checked the actual group",
        groupConfirmed: true,
        providerConfirmed,
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
    it("requires verified members, keeps submissions private, and publishes only the reviewed revision", async () => {
      const unverified = await member("unverified@example.com", false);
      await expect(
        createGroup({ member: unverified.auth }, input())
      ).rejects.toThrow("groups_verify_email");
      const { auth } = await member();
      const { id } = await createGroup({ member: auth }, input());
      expect((await list()).items).toEqual([]);
      expect(await ownGroups(auth)).toMatchObject([
        { id, status: "pending", revision: 1 },
      ]);
      await expect(
        reviewGroup(actorId(), {
          id,
          revision: 1,
          decision: "approved",
          note: "Unchecked destination",
          groupConfirmed: false,
          providerConfirmed: false,
        })
      ).rejects.toThrow("groups_review_required");
      await approve(id);
      const published = await list();
      expect(published.items).toMatchObject([
        { id, provider: null, language: "ar" },
      ]);
      expect(published.items[0].reviewedAt).toBeInstanceOf(Date);
      expect(JSON.stringify(published)).not.toMatch(
        /submittedBy|memberId|urlKey|reviewNote|email|openReports/
      );
      await editGroup(
        { member: auth },
        {
          ...input({
            name: "Updated discussion group",
            url: "https://t.me/updated_group",
          }),
          id,
          revision: 2,
        }
      );
      expect((await list()).items).toEqual([]);
      await expect(
        reviewGroup(actorId(), {
          id,
          revision: 2,
          decision: "approved",
          note: "Attempted stale review",
          groupConfirmed: true,
          providerConfirmed: false,
        })
      ).rejects.toThrow("groups_changed");
      expect(await row(id)).toMatchObject({
        status: "pending",
        reviewedAt: null,
        revision: 3,
      });
      await approve(id);
      expect((await list()).items[0].name).toBe("Updated discussion group");
      expect(
        (await database().select().from(auditEntries))
          .filter((a: any) => a.entityId === String(id))
          .map((a: any) => a.action)
      ).toContain("groups.edited");
    });
    it("deduplicates canonical links across accounts while preserving case-sensitive invitations", async () => {
      const a = await member();
      const b = await member("second@example.com");
      const results = await Promise.allSettled([
        createGroup({ member: a.auth }, input()),
        createGroup(
          { member: b.auth },
          input({ url: "https://telegram.me/BEACON_TEST_GROUP/" })
        ),
      ]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(results.find(r => r.status === "rejected")).toMatchObject({
        reason: { message: "groups_duplicate" },
      });
      await createGroup(
        { actorId: actorId() },
        input({ url: "https://t.me/+AbC_def12345" })
      );
      await createGroup(
        { actorId: actorId() },
        input({ url: "https://t.me/+abc_def12345" })
      );
      expect(await database().select().from(groups)).toHaveLength(3);
    });
    it("requires first-party provider evidence and removes hidden provider associations from public responses", async () => {
      await database()
        .update(providerRecords)
        .set({ websiteUrl: "https://provider.example" })
        .where(eq(providerRecords.id, providerId()));
      const values = input({
        providerId: providerId(),
        evidenceUrl: "https://provider.example/community",
      });
      await expect(
        createGroup(
          { actorId: actorId() },
          { ...values, evidenceUrl: "https://evil.example/community" }
        )
      ).rejects.toThrow("groups_evidence_required");
      const { id } = await createGroup({ actorId: actorId() }, values);
      await expect(approve(id)).rejects.toThrow("groups_evidence_required");
      await approve(id, true);
      expect((await list()).items[0]).toMatchObject({
        provider: { id: providerId(), name: "Test provider" },
        evidenceUrl: values.evidenceUrl,
      });
      await database()
        .update(providerRecords)
        .set({ websiteUrl: "https://new-provider.example" })
        .where(eq(providerRecords.id, providerId()));
      expect((await list()).items[0]).toMatchObject({
        provider: null,
        evidenceUrl: null,
      });
      await database()
        .update(providerRecords)
        .set({ websiteUrl: "https://provider.example" })
        .where(eq(providerRecords.id, providerId()));
      await database()
        .update(providerRecords)
        .set({ status: "suspended" })
        .where(eq(providerRecords.id, providerId()));
      expect((await list()).items[0]).toMatchObject({
        provider: null,
        evidenceUrl: null,
      });
      expect((await list({ providerId: providerId() })).items).toEqual([]);
      expect(await groupProviders("")).toEqual([]);
      await expect(
        createGroup(
          { actorId: actorId() },
          input({ ...values, url: "https://t.me/another_group" })
        )
      ).rejects.toThrow("groups_provider_unavailable");
    });
    it("enforces ownership, signed-in cache partitions, same-origin writes and session revocation", async () => {
      const a = await member();
      const b = await member("other@example.com");
      const { api, res } = await caller(a.result.token);
      const { id } = await api.community.submit(input());
      await expect(
        editGroup({ member: b.auth }, { ...input(), id, revision: 1 })
      ).rejects.toThrow("groups_missing");
      await expect(withdrawGroup(b.auth, id, 1)).rejects.toThrow(
        "groups_missing"
      );
      expect(await ownGroups(b.auth)).toEqual([]);
      await expect(
        api.community.mine({ accountId: b.auth.member.id })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      const hostile = await caller(a.result.token, "https://evil.example");
      await expect(
        hostile.api.community.withdraw({ id, revision: 1 })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        (await caller()).api.community.submit(input())
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        api.community.submit({ ...input(), status: "approved" } as any)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      await approve(id);
      await api.community.withdraw({ id, revision: 2 });
      expect((await list()).items).toEqual([]);
      expect(await row(id)).toMatchObject({
        status: "hidden",
        reviewedAt: null,
      });
      await logoutMember(a.result.token, true);
      await expect(
        editGroup({ member: a.auth }, { ...input(), id, revision: 1 })
      ).rejects.toThrow();
      await expect(
        api.community.withdraw({ id, revision: 1 })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
    it("records reports once, protects report history and supports resolving and reporting a new incident", async () => {
      const { auth } = await member();
      const { id } = await createGroup({ actorId: actorId() }, input());
      await expect(
        reportGroup(auth, { id, reason: "broken", note: "Expired" })
      ).rejects.toThrow("groups_missing");
      await approve(id);
      await Promise.all([
        reportGroup(auth, { id, reason: "broken", note: "Expired invitation" }),
        reportGroup(auth, { id, reason: "broken", note: "Expired invitation" }),
      ]);
      const result = await groupReports(id);
      expect(result.items).toHaveLength(1);
      expect(JSON.stringify(result)).not.toContain("memberId");
      expect(
        (await adminGroups({ reportsOnly: true, q: "" })).items[0].openReports
      ).toBe(1);
      expect((await list()).items).toHaveLength(1); // Reports do not let one member unpublish a group.
      await resolveGroupReport(
        actorId(),
        result.items[0].id,
        1,
        "Reviewed the invitation manually"
      );
      expect((await groupReports(id)).items).toEqual([]);
      await reportGroup(auth, {
        id,
        reason: "unrelated",
        note: "The destination has changed",
      });
      const reopened = (await groupReports(id)).items[0];
      expect(reopened.revision).toBe(3);
      await expect(
        resolveGroupReport(
          actorId(),
          reopened.id,
          1,
          "Stale resolution attempt"
        )
      ).rejects.toThrow("groups_changed");
      await reviewGroup(actorId(), {
        id,
        revision: 2,
        decision: "hidden",
        note: "Destination changed after review",
        groupConfirmed: false,
        providerConfirmed: false,
      });
      expect((await list()).items).toEqual([]);
    });
    it("denies member and editor moderation, permits administrators and rejects cross-origin staff changes", async () => {
      const memberResult = await member();
      const memberApi = (await caller(memberResult.result.token)).api;
      await expect(memberApi.admin.groups.list({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      const [staff] = await database()
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      const ordinary = (
        await caller(undefined, "https://providerbeacon.com", {
          ...staff,
          id: 0,
          openId: "ordinary-groups-test",
          role: "user",
        })
      ).api;
      await expect(ordinary.admin.groups.create(input())).rejects.toMatchObject(
        { code: "FORBIDDEN" }
      );
      const admin = (
        await caller(undefined, "https://providerbeacon.com", {
          ...staff,
          role: "admin",
        })
      ).api;
      const { id } = await admin.admin.groups.create(input());
      expect((await admin.admin.groups.list({})).items).toHaveLength(1);
      const hostile = (
        await caller(undefined, "https://evil.example", {
          ...staff,
          role: "admin",
        })
      ).api;
      await expect(
        hostile.admin.groups.review({
          id,
          revision: 1,
          decision: "approved",
          note: "Must not accept cross-origin review",
          groupConfirmed: true,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        admin.community.submit(input({ url: "https://t.me/another_group" }))
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await admin.admin.groups.review({
        id,
        revision: 1,
        decision: "approved",
        note: "Reviewed real destination",
        groupConfirmed: true,
      });
      expect((await list()).items).toHaveLength(1);
    });
    it("serializes member capacity and applies the shared database-backed submission rate limit", async () => {
      const { auth, result } = await member();
      const results = await Promise.allSettled(
        Array.from({ length: 11 }, (_, i) =>
          createGroup(
            { member: auth },
            input({ url: `https://t.me/test_group_${i}` })
          )
        )
      );
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(10);
      expect(results.find(r => r.status === "rejected")).toMatchObject({
        reason: { message: "groups_limit" },
      });
      const api = (await caller(result.token)).api;
      for (let i = 0; i < 5; i++)
        await expect(api.community.submit(input())).rejects.toThrow(
          "groups_limit"
        );
      await expect(api.community.submit(input())).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
      });
    });
    it("filters and paginates published groups without duplicates and cascades deleted member data", async () => {
      for (let i = 0; i < 27; i++) {
        const { id } = await createGroup(
          { actorId: actorId() },
          input({
            url: `https://t.me/public_group_${i}`,
            language: i === 26 ? "en" : "ar",
            topic: i === 26 ? "support" : "providers",
          })
        );
        await approve(id);
      }
      const first = await list();
      const second = await list({ cursor: first.nextCursor });
      expect(first.total).toBe(27);
      expect(first.items).toHaveLength(24);
      expect(second.items).toHaveLength(3);
      expect(
        new Set([...first.items, ...second.items].map(v => v.id)).size
      ).toBe(27);
      expect(
        (await list({ language: "en", topic: "support", platform: "telegram" }))
          .items
      ).toHaveLength(1);
      expect((await list({ q: "%" })).items).toEqual([]);
      const { auth } = await member();
      const { id } = await createGroup({ member: auth }, input());
      await approve(id);
      await reportGroup(auth, {
        id: first.items[0].id,
        reason: "broken",
        note: "Check link",
      });
      await database()
        .delete(memberAccounts)
        .where(eq(memberAccounts.id, auth.member.id));
      expect(await row(id)).toBeUndefined();
      expect(await database().select().from(reports)).toEqual([]);
      expect((await list()).total).toBe(27); // Staff-created directory entries are independent of member accounts.
    });
  });
}
