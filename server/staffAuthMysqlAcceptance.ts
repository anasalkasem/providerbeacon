import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as OTPAuth from "otpauth";
import {
  auditEntries,
  staffAccounts,
  staffSessions,
  teamMembers,
} from "../drizzle/schema";
import { memberAccounts, memberAuthBuckets } from "../drizzle/memberSchema";
import {
  authenticateStaffSession,
  beginMfaSetup,
  confirmMfaSetup,
  disableMfa,
  loginWithPassword,
  verifyMfaSession,
} from "./authDb";
import { registerMember } from "./memberDb";
import {
  encryptValue,
  hashPassword,
  hashRecoveryCode,
  STAFF_SESSION_COOKIE,
} from "./security";
import { createContext } from "./_core/context";
import { appRouter } from "./routers";

export function staffAuthAcceptanceCases(
  database: () => any,
  actorId: () => number
) {
  describe("shared sign-in and authenticator controls", () => {
    const email = "staff-entry@example.com",
      password = "Owner-Password-2026!fixture",
      secret = "JBSWY3DPEHPK3PXP";
    const recovery = "A1B2-C3D4-E5F6";
    const code = (value = secret) =>
      new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(value),
        algorithm: "SHA1",
        digits: 6,
        period: 30,
      }).generate();
    const req = (token?: string) =>
      ({
        protocol: "https",
        headers: {
          origin: "https://providerbeacon.com",
          ...(token ? { cookie: `${STAFF_SESSION_COOKIE}=${token}` } : {}),
        },
        socket: { remoteAddress: "127.0.0.1" },
      }) as any;
    async function caller(token?: string) {
      const res = { cookie: vi.fn(), clearCookie: vi.fn(), setHeader: vi.fn() };
      const ctx = await createContext({ req: req(token), res } as any);
      return { api: appRouter.createCaller(ctx), res, ctx };
    }
    async function activeSession() {
      const result = await loginWithPassword({ email, password, req: req() });
      await verifyMfaSession({ token: result.token, code: code(), req: req() });
      return result.token;
    }
    beforeEach(async () => {
      vi.stubEnv("AUTH_PEPPER", "local-staff-entry-test-pepper");
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      vi.stubEnv("OAUTH_SERVER_URL", "");
      const db = database();
      await db.delete(memberAccounts);
      await db.delete(memberAuthBuckets);
      await db.delete(staffSessions).where(eq(staffSessions.userId, actorId()));
      await db.delete(staffAccounts).where(eq(staffAccounts.userId, actorId()));
      const [{ id }] = await db
        .insert(staffAccounts)
        .values({
          userId: actorId(),
          email,
          passwordHash: await hashPassword(password),
        })
        .$returningId();
      const encrypted = encryptValue(secret, `mfa:${id}`);
      await db
        .update(staffAccounts)
        .set({
          mfaEnabled: true,
          mfaSecretCiphertext: encrypted.ciphertext,
          mfaSecretIv: encrypted.iv,
          mfaSecretTag: encrypted.tag,
          recoveryCodeHashes: [hashRecoveryCode(recovery)],
        })
        .where(eq(staffAccounts.id, id));
    });
    afterEach(async () => {
      await database()
        .delete(staffSessions)
        .where(eq(staffSessions.userId, actorId()));
      await database()
        .delete(staffAccounts)
        .where(eq(staffAccounts.userId, actorId()));
    });
    it("accepts the existing staff password at the public entry but grants no access before MFA", async () => {
      const { api, res } = await caller();
      expect(await api.auth.signIn({ email, password })).toEqual({
        kind: "staff",
        mfaRequired: true,
      });
      const token = res.cookie.mock.calls[0][1];
      expect(await authenticateStaffSession(token)).toBeNull();
      const pending = await caller(token);
      await expect(pending.api.admin.overview()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await pending.api.auth.verifyMfa({ code: code() });
      expect((await caller(token)).ctx.user?.id).toBe(actorId());
      expect((await database().select().from(memberAccounts)).length).toBe(0);
    });
    it("keeps a same-email member password separate and still accepts the staff password", async () => {
      const memberPassword = "a separate member passphrase";
      await registerMember({ name: "Member", email, password: memberPassword });
      const member = await caller();
      expect(
        await member.api.auth.signIn({ email, password: memberPassword })
      ).toMatchObject({ kind: "member" });
      expect(member.res.cookie.mock.calls[0][0]).toBe(
        "__Host-pb_member_session"
      );
      const [account] = await database()
        .select()
        .from(staffAccounts)
        .where(eq(staffAccounts.userId, actorId()));
      expect(account.failedLoginAttempts).toBe(0);
      expect(
        await (await caller()).api.auth.signIn({ email, password })
      ).toEqual({ kind: "staff", mfaRequired: true });
    });
    it.each(["password", "code"])(
      "keeps MFA, recovery codes and sessions unchanged after wrong %s",
      async wrong => {
        const token = await activeSession();
        const db = database();
        const before = await db
          .select()
          .from(staffAccounts)
          .where(eq(staffAccounts.userId, actorId()));
        await expect(
          disableMfa({
            userId: actorId(),
            currentPassword: wrong === "password" ? "wrong" : password,
            code: wrong === "code" ? "invalid-code" : code(),
            currentSessionToken: token,
            req: req(),
          })
        ).rejects.toThrow("auth_mfa_invalid_proof");
        expect(
          await db
            .select()
            .from(staffAccounts)
            .where(eq(staffAccounts.userId, actorId()))
        ).toEqual(before);
        expect(await authenticateStaffSession(token)).not.toBeNull();
      }
    );
    it.each(["totp", "recovery"])(
      "turns off MFA using %s, clears its secrets and revokes other sessions",
      async method => {
        const token = await activeSession(),
          other = await activeSession();
        const { api } = await caller(token);
        expect(
          await api.auth.security.disableMfa({
            currentPassword: password,
            code: method === "totp" ? code() : recovery,
            confirm: true,
          })
        ).toEqual({ success: true });
        const [account] = await database()
          .select()
          .from(staffAccounts)
          .where(eq(staffAccounts.userId, actorId()));
        expect(account).toMatchObject({
          mfaEnabled: false,
          mfaSecretCiphertext: null,
          mfaSecretIv: null,
          mfaSecretTag: null,
          recoveryCodeHashes: null,
        });
        expect(await authenticateStaffSession(token)).not.toBeNull();
        expect(await authenticateStaffSession(other)).toBeNull();
        expect(
          (await loginWithPassword({ email, password, req: req() })).mfaRequired
        ).toBe(false);
        const audit = await database()
          .select()
          .from(auditEntries)
          .where(eq(auditEntries.action, "auth.mfa.disable"));
        expect(audit).toHaveLength(1);
        expect(JSON.stringify(audit)).not.toContain(password);
      }
    );
    it("rejects stale or pending sessions and a suspended account", async () => {
      const pending = await loginWithPassword({ email, password, req: req() });
      const args = {
        userId: actorId(),
        currentPassword: password,
        code: code(),
        req: req(),
      };
      await expect(
        disableMfa({ ...args, currentSessionToken: pending.token })
      ).rejects.toThrow("auth_mfa_session_required");
      const token = await activeSession();
      await database()
        .delete(staffSessions)
        .where(eq(staffSessions.userId, actorId()));
      await expect(
        disableMfa({ ...args, currentSessionToken: token })
      ).rejects.toThrow("auth_mfa_session_required");
      const active = await activeSession();
      await database()
        .update(teamMembers)
        .set({ status: "suspended" })
        .where(eq(teamMembers.userId, actorId()));
      await expect(
        disableMfa({ ...args, currentSessionToken: active })
      ).rejects.toThrow("auth_mfa_session_required");
    });
    it("can enable a fresh authenticator after turning the old one off", async () => {
      const token = await activeSession();
      await disableMfa({
        userId: actorId(),
        currentPassword: password,
        code: code(),
        currentSessionToken: token,
        req: req(),
      });
      const setup = await beginMfaSetup(actorId());
      expect(setup.secret).not.toBe(secret);
      await confirmMfaSetup({
        userId: actorId(),
        code: code(setup.secret),
        currentSessionToken: token,
      });
      expect(
        (await loginWithPassword({ email, password, req: req() })).mfaRequired
      ).toBe(true);
    });
    it("serializes duplicate disable requests and writes one audit event", async () => {
      const token = await activeSession();
      const input = {
        userId: actorId(),
        currentPassword: password,
        code: recovery,
        currentSessionToken: token,
        req: req(),
      };
      const results = await Promise.allSettled([
        disableMfa(input),
        disableMfa(input),
      ]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(
        await database()
          .select()
          .from(auditEntries)
          .where(eq(auditEntries.action, "auth.mfa.disable"))
      ).toHaveLength(1);
    });
  });
}
