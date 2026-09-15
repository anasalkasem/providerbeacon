import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  auditEntries,
  staffAccounts,
  staffSessions,
  teamMembers,
  users,
} from "../drizzle/schema";
import {
  emailEvents,
  emailOutbox,
  emailSuppressions,
} from "../drizzle/emailSchema";
import { memberAuthBuckets } from "../drizzle/memberSchema";
import {
  createTeamInvite,
  listTeamMembers,
  removeTeamMember,
  resendTeamInvite,
  setTeamMemberRole,
  setTeamMemberStatus,
} from "./teamDb";
import {
  registerInvitedAccount,
  authenticateStaffSession,
  loginWithPassword,
} from "./authDb";
import { decryptValue, hashToken } from "./security";
import { memberEmailKey } from "./memberSecurity";
import { recordEmailEvent, sendOneEmail } from "./emailDb";
import { resolveTeamRole, hasPermission } from "./authorization";
import { appRouter } from "./routers";
import { acceptTeamInvite } from "./marketplaceDb";

export function teamAcceptanceCases(
  database: () => any,
  actorId: () => number
) {
  describe("team invitations, email and access lifecycle with MySQL", () => {
    const email = "employee@example.com",
      password = "Employee!LongPassword2026";
    const req = {
      headers: { origin: "https://providerbeacon.com" },
      ip: "127.0.0.1",
    };
    beforeEach(async () => {
      const db = database();
      await db.delete(emailOutbox);
      await db.delete(emailEvents);
      await db.delete(emailSuppressions);
      await db.delete(staffSessions);
      await db.delete(staffAccounts);
      await db.delete(memberAuthBuckets);
      await db
        .update(teamMembers)
        .set({ role: "owner" })
        .where(eq(teamMembers.userId, actorId()));
      vi.stubEnv("AUTH_PEPPER", "team-local-test-pepper");
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      vi.stubEnv("MAIL_ENABLED", "true");
      vi.stubEnv("RESEND_API_KEY", "local-test-not-a-real-key");
      vi.stubEnv("RESEND_WEBHOOK_SECRET", "local-test");
      vi.stubEnv("MAIL_FROM", "ProviderBeacon <soporte@providerbeacon.com>");
      vi.stubEnv("MAIL_REPLY_TO", "soporte@providerbeacon.com");
    });
    const invite = (patch: Record<string, unknown> = {}) =>
      createTeamInvite({
        email,
        role: "auditor",
        locale: "ar",
        actorUserId: actorId(),
        ...patch,
      } as any);
    const token = (url: string) =>
      new URLSearchParams(new URL(url).hash.slice(1)).get("token")!;
    async function row(id: number) {
      return (
        await database()
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.id, id))
      )[0];
    }
    async function mail() {
      return database().select().from(emailOutbox).orderBy(emailOutbox.id);
    }
    async function input(id: number) {
      return { id, revision: (await row(id)).revision, actorUserId: actorId() };
    }
    async function due() {
      await database()
        .update(emailOutbox)
        .set({ availableAt: new Date(Date.now() - 5000) });
    }
    async function age() {
      await database()
        .update(emailOutbox)
        .set({ createdAt: new Date(Date.now() - 65000) });
    }
    const register = (url: string, address = email) =>
      registerInvitedAccount({
        token: token(url),
        name: "Local employee",
        email: address,
        password,
        req,
      });
    async function active(role = "auditor") {
      const invited = await invite({ role });
      const signed = await register(invited.inviteUrl);
      return { invited, signed };
    }
    async function caller(id = actorId(), origin = req.headers.origin) {
      const [user] = await database()
        .select()
        .from(users)
        .where(eq(users.id, id));
      const res = { setHeader: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn() };
      return {
        api: appRouter.createCaller({
          user: user ?? null,
          authMode: "staff",
          req: { headers: { origin }, socket: { remoteAddress: "127.0.0.1" } },
          res,
        } as any),
        res,
      };
    }
    it("queues a branded encrypted invitation atomically, sends via the shared worker and records delivery", async () => {
      const created = await invite();
      expect(fetch).not.toHaveBeenCalled();
      const [queued] = await mail();
      expect(queued).toMatchObject({
        memberId: null,
        teamMemberId: created.id,
        kind: "staff_invite",
        status: "queued",
        locale: "ar",
      });
      expect(JSON.stringify(queued)).not.toContain(token(created.inviteUrl));
      const payload = JSON.parse(decryptValue(queued.payload, "email-outbox"));
      expect(payload.to).toEqual([email]);
      expect(payload.from).toBe("ProviderBeacon <soporte@providerbeacon.com>");
      expect(payload.text).toContain(created.inviteUrl);
      expect(payload.html).toContain('dir="rtl"');
      const listing = await listTeamMembers();
      expect(listing.find(r => r.id === created.id)?.mailStatus).toBe("queued");
      expect(JSON.stringify(listing)).not.toMatch(
        /invitationTokenHash|inviteTokenHash|payload|ciphertext/
      );
      const provider = vi.fn(
        async (_url: unknown, _init?: RequestInit) =>
          new Response(JSON.stringify({ id: "team-mail-one" }), { status: 200 })
      );
      vi.stubGlobal("fetch", provider);
      await due();
      expect(await sendOneEmail()).toBe(true);
      expect(JSON.parse(provider.mock.calls[0][1]!.body as string)).toEqual(
        payload
      );
      expect((await mail())[0]).toMatchObject({
        status: "accepted",
        payload: null,
        attempts: 1,
      });
      await recordEmailEvent("local-team-delivered", {
        type: "email.delivered",
        data: { email_id: "team-mail-one" },
      });
      expect(
        (await listTeamMembers()).find(r => r.id === created.id)?.mailStatus
      ).toBe("delivered");
      const log = await (await caller()).api.admin.email.history({});
      expect(log.items).toHaveLength(1);
      expect(log.items[0]).toMatchObject({
        kind: "staff_invite",
        email,
        status: "delivered",
      });
    });
    it("never reports success when mail is disabled or the recipient is suppressed", async () => {
      vi.stubEnv("MAIL_ENABLED", "false");
      await expect(invite()).rejects.toThrow("team_mail_disabled");
      expect(
        (await listTeamMembers()).filter(r => r.email === email)
      ).toHaveLength(0);
      vi.stubEnv("MAIL_ENABLED", "true");
      await database()
        .insert(emailSuppressions)
        .values({ recipientHash: memberEmailKey(email), reason: "bounced" });
      await expect(invite()).rejects.toThrow("team_mail_suppressed");
      expect(await mail()).toHaveLength(0);
      expect(fetch).not.toHaveBeenCalled();
    });
    it("retries transient delivery with the same payload and key; permanent failures are visible", async () => {
      await invite();
      const requests: any[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url, init) => {
          requests.push(init);
          return new Response("{}", {
            status: requests.length === 1 ? 503 : 403,
          });
        })
      );
      await due();
      expect(await sendOneEmail()).toBe(false);
      expect((await mail())[0]).toMatchObject({
        status: "queued",
        lastError: "provider_http_503",
      });
      await due();
      expect(await sendOneEmail()).toBe(false);
      expect(requests[0].headers["Idempotency-Key"]).toBe(
        requests[1].headers["Idempotency-Key"]
      );
      expect(requests[0].body).toBe(requests[1].body);
      expect((await mail())[0]).toMatchObject({
        status: "failed",
        payload: null,
        lastError: "provider_http_403",
      });
    });
    it("resends old unsent invitations and invalidates earlier links and queued messages", async () => {
      const [{ id }] = await database()
        .insert(teamMembers)
        .values({
          email,
          role: "auditor",
          status: "invited",
          invitationTokenHash: hashToken("old-invitation-token-value"),
          invitationExpiresAt: new Date(Date.now() + 60000),
        })
        .$returningId();
      expect(
        (await listTeamMembers()).find(r => r.id === id)?.mailStatus
      ).toBeNull();
      const first = await resendTeamInvite({
        ...(await input(id)),
        locale: "ar",
      });
      await expect(
        resendTeamInvite({ ...(await input(id)), locale: "ar" })
      ).rejects.toThrow("team_resend_wait");
      await age();
      const latest = await resendTeamInvite({
        ...(await input(id)),
        locale: "es",
      });
      expect((await mail())[0]).toMatchObject({
        status: "cancelled",
        payload: null,
      });
      await expect(register(first.inviteUrl)).rejects.toThrow(
        "team_invalid_invite"
      );
      await expect(
        register(latest.inviteUrl, "someoneelse@example.com")
      ).rejects.toThrow("team_invalid_invite");
      const registered = await register(latest.inviteUrl);
      expect(await authenticateStaffSession(registered.token)).toMatchObject({
        id: registered.userId,
      });
      expect(await row(id)).toMatchObject({
        status: "active",
        invitationTokenHash: null,
      });
      await expect(register(latest.inviteUrl)).rejects.toThrow(
        "team_invalid_invite"
      );
      await due();
      expect(await sendOneEmail()).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });
    it("consumes an invitation once under concurrent registration and rejects duplicate invites without changing access", async () => {
      const created = await invite();
      const accepted = await Promise.allSettled([
        register(created.inviteUrl),
        register(created.inviteUrl),
      ]);
      expect(accepted.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(
        await database()
          .select()
          .from(staffAccounts)
          .where(eq(staffAccounts.email, email))
      ).toHaveLength(1);
      const before = await row(created.id);
      await expect(invite({ role: "administrator" })).rejects.toThrow(
        "team_exists"
      );
      expect(await row(created.id)).toMatchObject({
        role: "auditor",
        status: "active",
        revision: before.revision,
      });
      expect(
        await database()
          .select()
          .from(auditEntries)
          .where(eq(auditEntries.action, "auth.invite.register"))
      ).toHaveLength(1);
    });
    it("changes permissions and revokes sessions, without recovering access through legacy admin flags", async () => {
      const { invited, signed } = await active("administrator");
      const user = (await authenticateStaffSession(signed.token))!;
      expect(hasPermission(await resolveTeamRole(user), "emails.send")).toBe(
        true
      );
      const change = await input(invited.id);
      await setTeamMemberRole({ ...change, role: "auditor" });
      expect(await authenticateStaffSession(signed.token)).toBeNull();
      expect(await resolveTeamRole({ ...user, role: "admin" })).toBe("auditor");
      expect(hasPermission(await resolveTeamRole(user), "emails.send")).toBe(
        false
      );
      await expect(
        setTeamMemberRole({ ...change, role: "administrator" })
      ).rejects.toThrow("team_changed");
      const logged = await loginWithPassword({ email, password, req });
      await setTeamMemberStatus({
        ...(await input(invited.id)),
        status: "suspended",
      });
      expect(await authenticateStaffSession(logged.token)).toBeNull();
      expect(await resolveTeamRole({ ...user, role: "admin" })).toBeNull();
      await expect(loginWithPassword({ email, password, req })).rejects.toThrow(
        "suspended"
      );
      await setTeamMemberStatus({
        ...(await input(invited.id)),
        status: "active",
      });
      const reactivated = await loginWithPassword({ email, password, req });
      expect(await authenticateStaffSession(reactivated.token)).toMatchObject({ id: user.id });
      expect(
        await database()
          .select()
          .from(auditEntries)
          .where(eq(auditEntries.action, "team.member.role"))
      ).toHaveLength(1);
    });
    it("removes active and suspended employees, credentials and sessions while retaining audit attribution", async () => {
      const { invited, signed } = await active("administrator");
      const user = (await authenticateStaffSession(signed.token))!;
      await removeTeamMember(await input(invited.id));
      expect(await row(invited.id)).toBeUndefined();
      expect(await authenticateStaffSession(signed.token)).toBeNull();
      expect(await resolveTeamRole({ ...user, role: "admin" })).toBeNull();
      expect(
        await database()
          .select()
          .from(staffAccounts)
          .where(eq(staffAccounts.userId, user.id))
      ).toHaveLength(0);
      expect(
        await database()
          .select()
          .from(staffSessions)
          .where(eq(staffSessions.userId, user.id))
      ).toHaveLength(0);
      expect(
        await database().select().from(users).where(eq(users.id, user.id))
      ).toHaveLength(1);
      expect(
        await database()
          .select()
          .from(auditEntries)
          .where(eq(auditEntries.actorUserId, user.id))
      ).toHaveLength(1);
      const again = await active();
      expect(again.signed.userId).not.toBe(user.id);
      await setTeamMemberStatus({
        ...(await input(again.invited.id)),
        status: "suspended",
      });
      await removeTeamMember(await input(again.invited.id));
      expect(await row(again.invited.id)).toBeUndefined();
    });
    it("invalidates deleted invitations, protects owner/self and blocks non-owner and cross-origin mutations", async () => {
      const created = await invite();
      const owner = (await listTeamMembers()).find(
        r => r.userId === actorId()
      )!;
      const ownerInput = await input(owner.id);
      for (const action of [
        () => removeTeamMember(ownerInput),
        () => setTeamMemberRole({ ...ownerInput, role: "auditor" }),
        () => setTeamMemberStatus({ ...ownerInput, status: "suspended" }),
      ])
        await expect(action()).rejects.toThrow("team_protected");
      const bad = await caller(actorId(), "https://evil.example");
      await expect(
        bad.api.admin.team.remove((await input(created.id)) as any)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const readOnly = await database()
        .insert(users)
        .values({ openId: "team-read-only-user", role: "admin" })
        .onDuplicateKeyUpdate({ set: { role: "admin" } });
      const [reader] = await database()
        .select()
        .from(users)
        .where(eq(users.openId, "team-read-only-user"));
      const legacy = await caller(reader.id);
      await expect(legacy.api.admin.team.list()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await database()
        .insert(teamMembers)
        .values({
          userId: reader.id,
          email: "team-reader@example.com",
          role: "administrator",
          status: "active",
        });
      const admin = await caller(reader.id);
      expect(await admin.api.admin.team.list()).toHaveLength(3);
      await expect(
        admin.api.admin.team.remove({
          id: created.id,
          revision: (await row(created.id)).revision,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await removeTeamMember(await input(created.id));
      await expect(register(created.inviteUrl)).rejects.toThrow(
        "team_invalid_invite"
      );
      await due();
      expect(await sendOneEmail()).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });
    it("binds accepted OAuth invitations to the exact identity and honors edited pending roles", async () => {
      const created = await invite();
      await setTeamMemberRole({
        ...(await input(created.id)),
        role: "provider_reviewer",
      });
      const [{ id: userId }] = await database()
        .insert(users)
        .values({ openId: `team-oauth-${created.id}`, email, role: "user" })
        .$returningId();
      await expect(
        acceptTeamInvite({
          token: token(created.inviteUrl),
          userId,
          email: "other@example.com",
        })
      ).rejects.toThrow("team_invalid_invite");
      const results = await Promise.allSettled([
        acceptTeamInvite({ token: token(created.inviteUrl), userId, email }),
        acceptTeamInvite({ token: token(created.inviteUrl), userId, email }),
      ]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      const [user] = await database()
        .select()
        .from(users)
        .where(eq(users.id, userId));
      expect(await resolveTeamRole(user)).toBe("provider_reviewer");
      await removeTeamMember(await input(created.id));
      expect(await resolveTeamRole({ ...user, role: "admin" })).toBeNull();
    });
  });
}
