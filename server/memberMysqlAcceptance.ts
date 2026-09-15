import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  memberAccounts,
  memberAuthBuckets,
  memberOAuthFlows,
  memberSessions,
} from "../drizzle/memberSchema";
import { users } from "../drizzle/schema";
import {
  authenticateMemberSession,
  changeMemberPassword,
  consumeGoogleFlow,
  deleteMember,
  loginGoogleMember,
  loginMember,
  logoutMember,
  recoverMember,
  registerMember,
  reserveMemberRequests,
  saveGoogleFlow,
} from "./memberDb";
import {
  memberCookieName,
  memberRecoveryHash,
  memberTokenHash,
} from "./memberSecurity";
import { randomToken } from "./security";
import { createContext } from "./_core/context";
import { appRouter } from "./routers";

// Registered inside the existing MySQL suite to share its serialized migrations and local-only guard.
export function memberAcceptanceCases(
  database: () => any,
  actorId: () => number
) {
  describe("independent visitor accounts", () => {
    const input = {
      name: "Visitor test",
      email: "visitor@example.com",
      password: "a long visitor test password",
    };
    beforeEach(async () => {
      const db = database();
      await db.delete(memberAccounts);
      await db.delete(memberOAuthFlows);
      await db.delete(memberAuthBuckets);
      vi.stubEnv("AUTH_PEPPER", "local-member-test-pepper");
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      vi.stubEnv("OAUTH_SERVER_URL", "");
    });
    it("registers a real account without exposing credentials or granting staff access, even for the staff email", async () => {
      const db = database();
      const [originalStaff] = await db
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      await db
        .update(users)
        .set({ email: input.email, role: "admin" })
        .where(eq(users.id, actorId()));
      const [before] = await db
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      const result = await registerMember(input);
      expect(result.member).toMatchObject({
        emailVerified: false,
        hasPassword: true,
        googleLinked: false,
      });
      expect(JSON.stringify(result.member)).not.toMatch(
        /passwordHash|tokenHash|recoveryCodeHash|role|googleSubject/
      );
      const [row] = await db.select().from(memberAccounts);
      const [session] = await db.select().from(memberSessions);
      expect(row.passwordHash).not.toContain(input.password);
      expect(row.recoveryCodeHash).toBe(
        memberRecoveryHash(result.recoveryCode)
      );
      expect(session.tokenHash).toBe(memberTokenHash("session", result.token));
      const req = {
        headers: {
          cookie: `${memberCookieName("session")}=${result.token}`,
          origin: "https://providerbeacon.com",
        },
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = { setHeader: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn() };
      const context = await createContext({ req, res } as any);
      expect(context.user).toBeNull();
      const caller = appRouter.createCaller(context);
      expect(await caller.auth.me()).toBeNull();
      expect((await caller.member.me()).member?.email).toBe(input.email);
      await expect(caller.admin.overview()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await expect(
        caller.member.register({ ...input, role: "admin" } as any)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await caller.member.logout({ all: false });
      expect(res.clearCookie).toHaveBeenCalledWith(
        memberCookieName("session"),
        expect.anything()
      );
      expect(await authenticateMemberSession(result.token)).toBeNull();
      const [after] = await db
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      expect(after).toEqual(before);
      await db
        .update(users)
        .set({ email: originalStaff.email, role: originalStaff.role })
        .where(eq(users.id, actorId()));
    });
    it("limits sessions, rejects wrong passwords and rotates all sessions after a password change", async () => {
      const result = await registerMember(input);
      await expect(registerMember(input)).rejects.toMatchObject({
        code: "account_exists",
      });
      await expect(loginMember(input.email, "wrong")).rejects.toMatchObject({
        code: "invalid_credentials",
      });
      let latest = result;
      for (let i = 0; i < 6; i++)
        latest = {
          ...latest,
          ...(await loginMember(input.email, input.password)),
        };
      expect(await database().select().from(memberSessions)).toHaveLength(5);
      expect(await authenticateMemberSession(result.token)).toBeNull();
      const auth = (await authenticateMemberSession(latest.token))!;
      const changed = await changeMemberPassword(
        auth,
        "a completely new test passphrase",
        input.password
      );
      expect(changed.token).not.toBe(latest.token);
      expect(await authenticateMemberSession(latest.token)).toBeNull();
      await expect(
        loginMember(input.email, input.password)
      ).rejects.toMatchObject({ code: "invalid_credentials" });
      await expect(
        changeMemberPassword(
          auth,
          "yet another long test passphrase",
          input.password
        )
      ).rejects.toMatchObject({ code: "reauthenticate" });
      expect(await authenticateMemberSession(changed.token)).not.toBeNull();
    });
    it("uses Google subject identity, rejects email-based takeover and binds explicit linking to the initiating session", async () => {
      const local = await registerMember(input);
      const identity = {
        subject: "google-subject-1",
        email: input.email,
        name: "Google member",
      };
      await expect(loginGoogleMember(identity)).rejects.toMatchObject({
        code: "account_exists",
      });
      const auth = (await authenticateMemberSession(local.token))!;
      const link = {
        memberId: auth.member.id,
        sessionHash: auth.session.tokenHash,
      };
      await expect(
        loginGoogleMember(identity, link, randomToken())
      ).rejects.toMatchObject({ code: "invalid_state" });
      await expect(
        loginGoogleMember(
          { ...identity, email: "different@example.com" },
          link,
          local.token
        )
      ).rejects.toMatchObject({ code: "link_conflict" });
      const linked = await loginGoogleMember(identity, link, local.token);
      expect(linked.member).toMatchObject({
        id: local.member.id,
        googleLinked: true,
        emailVerified: true,
      });
      const renamed = await loginGoogleMember({
        ...identity,
        email: "new-google-email@example.com",
      });
      expect(renamed.member.id).toBe(local.member.id);
      expect(renamed.member.emailVerified).toBe(false);
      await expect(
        loginGoogleMember({ ...identity, subject: "other-google-subject" })
      ).rejects.toMatchObject({ code: "account_exists" });
    });
    it("does not let an expired or revoked session finish Google linking", async () => {
      const result = await registerMember(input),
        auth = (await authenticateMemberSession(result.token))!;
      await logoutMember(result.token, true);
      await expect(
        loginGoogleMember(
          { subject: "subject", email: input.email, name: "Name" },
          { memberId: auth.member.id, sessionHash: auth.session.tokenHash },
          result.token
        )
      ).rejects.toMatchObject({ code: "invalid_state" });
    });
    it("requires fresh Google authentication for passwordless security changes", async () => {
      const result = await loginGoogleMember({
        subject: "subject",
        email: input.email,
        name: input.name,
      });
      const auth = (await authenticateMemberSession(result.token))!;
      await database()
        .update(memberSessions)
        .set({ createdAt: new Date(Date.now() - 660000) })
        .where(eq(memberSessions.id, auth.session.id));
      const old = (await authenticateMemberSession(result.token))!;
      await expect(
        changeMemberPassword(old, input.password)
      ).rejects.toMatchObject({ code: "reauthenticate" });
      const fresh = await loginGoogleMember({
        subject: "subject",
        email: input.email,
        name: input.name,
      });
      const changed = await changeMemberPassword(
        (await authenticateMemberSession(fresh.token))!,
        input.password
      );
      expect(changed.member.hasPassword).toBe(true);
      expect(changed.member.hasRecoveryCode).toBe(true);
    });
    it("consumes recovery codes once under concurrent use and revokes sessions and Google linking", async () => {
      const result = await registerMember(input),
        auth = (await authenticateMemberSession(result.token))!;
      await loginGoogleMember(
        { subject: "subject", email: input.email, name: input.name },
        { memberId: auth.member.id, sessionHash: auth.session.tokenHash },
        result.token
      );
      const attempts = await Promise.allSettled(
        [1, 2].map(() =>
          recoverMember({
            email: input.email,
            code: result.recoveryCode,
            newPassword: "a new recovery test password",
          })
        )
      );
      expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(await authenticateMemberSession(result.token)).toBeNull();
      const [member] = await database().select().from(memberAccounts);
      expect(member.googleSubjectHash).toBeNull();
      expect(member.recoveryCodeHash).not.toBe(
        memberRecoveryHash(result.recoveryCode)
      );
      await expect(
        recoverMember({
          email: input.email,
          code: result.recoveryCode,
          newPassword: input.password,
        })
      ).rejects.toMatchObject({ code: "invalid_recovery" });
    });
    it("encrypts OAuth state, binds it to the browser and permits one callback only", async () => {
      const state = randomToken(),
        browser = randomToken();
      const flow = {
        nonce: randomToken(),
        verifier: randomToken(48),
        next: "/account",
        locale: "ar",
      };
      await saveGoogleFlow(state, browser, flow);
      const [stored] = await database().select().from(memberOAuthFlows);
      expect(JSON.stringify(stored)).not.toContain(flow.verifier);
      expect(JSON.stringify(stored)).not.toContain(state);
      await expect(
        consumeGoogleFlow(state, randomToken())
      ).rejects.toMatchObject({ code: "invalid_state" });
      const attempts = await Promise.allSettled([
        consumeGoogleFlow(state, browser),
        consumeGoogleFlow(state, browser),
      ]);
      expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(attempts.find(r => r.status === "fulfilled")).toMatchObject({
        value: flow,
      });
      expect(await database().select().from(memberOAuthFlows)).toHaveLength(0);
      await saveGoogleFlow(state, browser, flow);
      await database()
        .update(memberOAuthFlows)
        .set({ expiresAt: new Date(Date.now() - 1000) });
      await expect(consumeGoogleFlow(state, browser)).rejects.toMatchObject({
        code: "invalid_state",
      });
    });
    it("reserves login budgets atomically and rolls back denied reservations", async () => {
      const now = Date.now(),
        buckets = [
          { key: "test:global", limit: 20, windowMs: 60000 },
          { key: "test:ip", limit: 2, windowMs: 60000 },
        ];
      const attempts = await Promise.allSettled(
        Array.from({ length: 8 }, () => reserveMemberRequests(buckets, now))
      );
      expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(2);
      const rows = await database().select().from(memberAuthBuckets);
      expect(rows.every((row: any) => row.used === 2)).toBe(true);
      await expect(
        reserveMemberRequests(buckets, now + 60000)
      ).resolves.toBeUndefined();
    });
    it("rejects suspended accounts and deletes only the visitor identity and its sessions", async () => {
      const result = await registerMember(input),
        db = database();
      const [staffBefore] = await db
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      await db
        .update(memberAccounts)
        .set({ status: "suspended" })
        .where(eq(memberAccounts.id, result.member.id));
      expect(await authenticateMemberSession(result.token)).toBeNull();
      await expect(
        loginMember(input.email, input.password)
      ).rejects.toMatchObject({ code: "invalid_credentials" });
      await db
        .update(memberAccounts)
        .set({ status: "active" })
        .where(eq(memberAccounts.id, result.member.id));
      const auth = (await authenticateMemberSession(result.token))!;
      await expect(deleteMember(auth, "wrong")).rejects.toMatchObject({
        code: "reauthenticate",
      });
      await deleteMember(auth, input.password);
      expect(await db.select().from(memberAccounts)).toHaveLength(0);
      expect(await db.select().from(memberSessions)).toHaveLength(0);
      const [staffAfter] = await db
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      expect(staffAfter).toEqual(staffBefore);
    });
  });
}
