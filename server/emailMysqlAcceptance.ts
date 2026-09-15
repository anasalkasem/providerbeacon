import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  emailEvents,
  emailOutbox,
  emailSuppressions,
  memberEmailTokens,
} from "../drizzle/emailSchema";
import { memberAccounts, memberAuthBuckets } from "../drizzle/memberSchema";
import { users } from "../drizzle/schema";
import {
  authenticateMemberSession,
  changeMemberPassword,
  loginGoogleMember,
  loginMember,
  registerMember,
} from "./memberDb";
import {
  consumeMemberEmailToken,
  requestPasswordEmail,
  updateMemberEmailPreferences,
} from "./memberEmail";
import {
  claimEmail,
  enqueueEmail,
  maintainEmailQueue,
  queueNewMemberEmail,
  recordEmailEvent,
  sendOneEmail,
  unsubscribeMember,
  unsubscribeToken,
} from "./emailDb";
import { decryptValue } from "./security";
import { appRouter } from "./routers";

export function emailAcceptanceCases(
  database: () => any,
  actorId: () => number
) {
  describe("customer email acceptance", () => {
    const input = {
      name: "Email test",
      email: "email-member@example.com",
      password: "long email acceptance password",
      locale: "ar",
      marketingOptIn: true,
    };
    beforeEach(async () => {
      const db = database();
      await db.delete(memberAccounts);
      await db.delete(emailEvents);
      await db.delete(emailSuppressions);
      await db.delete(memberAuthBuckets);
      vi.stubEnv("AUTH_PEPPER", "local-email-test-pepper");
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      vi.stubEnv("MAIL_ENABLED", "true");
      vi.stubEnv("RESEND_API_KEY", "local-test-no-network");
      vi.stubEnv("RESEND_WEBHOOK_SECRET", "local-test");
      vi.stubEnv("MAIL_FROM", "ProviderBeacon <soporte@providerbeacon.com>");
      vi.stubEnv("MAIL_REPLY_TO", "soporte@providerbeacon.com");
    });
    async function account(google = false) {
      const db = database();
      const result = google
        ? await loginGoogleMember(
            {
              subject: "email-test-google-id",
              email: input.email,
              name: input.name,
            },
            undefined,
            undefined,
            "es"
          )
        : await registerMember(input);
      const [member] = await db
        .select()
        .from(memberAccounts)
        .where(eq(memberAccounts.id, result.member.id));
      return { result, member };
    }
    async function outbox() {
      return database().select().from(emailOutbox).orderBy(emailOutbox.id);
    }
    function payload(row: any) {
      return JSON.parse(decryptValue(row.payload, "email-outbox"));
    }
    function token(row: any) {
      return payload(row).text.match(/#token=([A-Za-z0-9_-]{43})/)![1];
    }
    async function due() {
      await database()
        .update(emailOutbox)
        .set({ availableAt: new Date(Date.now() - 5000) });
    }
    async function staffCaller() {
      const [user] = await database()
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      return appRouter.createCaller({
        user: { ...user, role: "admin" },
        req: {
          headers: { origin: "https://providerbeacon.com" },
          socket: { remoteAddress: "127.0.0.1" },
        },
        res: { setHeader: vi.fn() },
      } as any);
    }
    it("creates exactly one localized welcome on signup without making an email network request", async () => {
      const { result, member } = await account();
      expect(result.member.locale).toBe("ar");
      expect(result.member.marketingOptIn).toBe(true);
      const rows = await outbox();
      expect(rows).toHaveLength(1);
      expect(rows[0].kind).toBe("verify");
      expect(payload(rows[0]).reply_to).toBe("soporte@providerbeacon.com");
      expect(payload(rows[0]).html).toContain('dir="rtl"');
      expect(JSON.stringify(rows[0].payload)).not.toContain(input.email);
      await database().transaction((tx: any) =>
        queueNewMemberEmail(tx, member)
      );
      await loginMember(input.email, input.password);
      expect(await outbox()).toHaveLength(1);
      expect(fetch).not.toHaveBeenCalled();
    });
    it("welcomes a new Google member once, verified and in the selected language without marketing opt-in", async () => {
      const { result } = await account(true);
      expect(result.member).toMatchObject({
        emailVerified: true,
        locale: "es",
        marketingOptIn: false,
      });
      await loginGoogleMember({
        subject: "email-test-google-id",
        email: input.email,
        name: input.name,
      });
      const rows = await outbox();
      expect(rows).toHaveLength(1);
      expect(rows[0].kind).toBe("welcome");
      expect(rows[0].locale).toBe("es");
    });
    it("consumes verification only once and rejects expired links", async () => {
      const { result } = await account();
      const [row] = await outbox(),
        secret = token(row);
      const outcomes = await Promise.allSettled([
        consumeMemberEmailToken(secret, "verify"),
        consumeMemberEmailToken(secret, "verify"),
      ]);
      expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(
        (await authenticateMemberSession(result.token))?.member.emailVerifiedAt
      ).not.toBeNull();
      await requestPasswordEmail(input.email);
      const reset = (await outbox()).find((r: any) => r.kind === "reset");
      await database()
        .update(memberEmailTokens)
        .set({ expiresAt: new Date(Date.now() - 5000) });
      await expect(
        consumeMemberEmailToken(
          token(reset),
          "reset",
          "replacement long password"
        )
      ).rejects.toMatchObject({ code: "invalid_recovery" });
    });
    it("email reset revokes all sessions and old recovery codes, proves the email and invalidates every pending reset", async () => {
      const { result } = await account();
      await requestPasswordEmail(input.email);
      await requestPasswordEmail(input.email);
      const resets = (await outbox()).filter((r: any) => r.kind === "reset");
      const first = token(resets[0]),
        second = token(resets[1]);
      const newPassword = "another long replacement password";
      await consumeMemberEmailToken(first, "reset", newPassword);
      expect(await authenticateMemberSession(result.token)).toBeNull();
      expect(
        (await loginMember(input.email, newPassword)).member
      ).toMatchObject({ emailVerified: true, hasRecoveryCode: false });
      await expect(
        consumeMemberEmailToken(second, "reset", newPassword)
      ).rejects.toMatchObject({ code: "invalid_recovery" });
      expect(
        (await outbox()).filter((r: any) => r.kind === "security")
      ).toHaveLength(1);
    });
    it("invalidates reset links when the signed-in member changes credentials", async () => {
      const { result } = await account();
      await requestPasswordEmail(input.email);
      const reset = (await outbox()).find((r: any) => r.kind === "reset"),
        secret = token(reset);
      const auth = (await authenticateMemberSession(result.token))!;
      await changeMemberPassword(
        auth,
        "new authenticated long password",
        input.password
      );
      await expect(
        consumeMemberEmailToken(
          secret,
          "reset",
          "attacker replacement password"
        )
      ).rejects.toMatchObject({ code: "invalid_recovery" });
    });
    it("does not reveal account existence in password email requests", async () => {
      await account();
      expect(await requestPasswordEmail(input.email)).toEqual(
        await requestPasswordEmail("absent@example.com")
      );
      expect(
        (await outbox()).filter((r: any) => r.kind === "reset")
      ).toHaveLength(1);
    });
    it("keeps signup available with sending disabled, and never claims delivery", async () => {
      vi.stubEnv("MAIL_ENABLED", "false");
      await account();
      await due();
      expect(await sendOneEmail()).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
      expect((await outbox())[0]).toMatchObject({
        status: "queued",
        attempts: 0,
      });
      await expect(requestPasswordEmail(input.email)).rejects.toMatchObject({
        code: "unavailable",
      });
    });
    it("leases one message to one worker under concurrent claims", async () => {
      await account(true);
      await due();
      const results = await Promise.all([
        claimEmail(),
        claimEmail(),
        claimEmail(),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect((await outbox())[0]).toMatchObject({
        status: "processing",
        attempts: 1,
      });
    });
    it("retries provider errors with identical content and idempotency key; only webhook delivery marks delivered", async () => {
      await account(true);
      await due();
      const mock = vi
        .fn()
        .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: "provider-message-1" }), {
            status: 200,
          })
        );
      vi.stubGlobal("fetch", mock);
      await sendOneEmail();
      expect((await outbox())[0]).toMatchObject({
        status: "queued",
        lastError: "provider_http_503",
      });
      await due();
      await sendOneEmail();
      expect(mock.mock.calls[0][1].body).toBe(mock.mock.calls[1][1].body);
      expect(mock.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
        mock.mock.calls[1][1].headers["Idempotency-Key"]
      );
      expect((await outbox())[0]).toMatchObject({
        status: "accepted",
        payload: null,
      });
      await recordEmailEvent("event-delivered", {
        type: "email.delivered",
        data: { email_id: "provider-message-1" },
      });
      await recordEmailEvent("event-delivered", {
        type: "email.delivered",
        data: { email_id: "provider-message-1" },
      });
      await recordEmailEvent("event-sent-late", {
        type: "email.sent",
        data: { email_id: "provider-message-1" },
      });
      expect((await outbox())[0].status).toBe("delivered");
      expect(await database().select().from(emailEvents)).toHaveLength(2);
    });
    it("stops retries after the provider idempotency window and never resends an ambiguous old request", async () => {
      await account(true);
      await due();
      await database()
        .update(emailOutbox)
        .set({
          attempts: 1,
          firstAttemptAt: new Date(Date.now() - 24 * 3600000),
        });
      await sendOneEmail();
      expect(fetch).not.toHaveBeenCalled();
      expect((await outbox())[0]).toMatchObject({
        status: "failed",
        lastError: "delivery_unknown",
        payload: null,
      });
    });
    it("reconciles webhooks arriving before provider acceptance and suppresses future mail after a bounce", async () => {
      await account(true);
      await due();
      await recordEmailEvent("early-bounce", {
        type: "email.bounced",
        data: { email_id: "provider-early" },
      });
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(JSON.stringify({ id: "provider-early" }), {
              status: 200,
            })
        )
      );
      await sendOneEmail();
      expect((await outbox())[0].status).toBe("bounced");
      await requestPasswordEmail(input.email);
      await due();
      await sendOneEmail();
      expect((await outbox()).find((r: any) => r.kind === "reset").status).toBe(
        "suppressed"
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    it("requires a reviewed, unchanged recipient/message before staff send and queues duplicate confirmations once", async () => {
      const { result } = await account(true);
      const auth = (await authenticateMemberSession(result.token))!;
      const caller = await staffCaller();
      const message = {
        memberId: result.member.id,
        locale: "es" as const,
        subject: "Novedades de ProviderBeacon",
        body: "Consulta nuestros servicios y compara las opciones disponibles.",
        action: "/services" as const,
      };
      await expect(caller.admin.email.preview(message)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      await updateMemberEmailPreferences(auth, {
        locale: "es",
        marketingOptIn: true,
      });
      const preview = await caller.admin.email.preview(message);
      await expect(
        caller.admin.email.send({
          message: { ...message, subject: "Changed after preview" },
          proof: preview.proof,
          confirm: true,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const a = await caller.admin.email.send({
        message,
        proof: preview.proof,
        confirm: true,
      });
      const b = await caller.admin.email.send({
        message,
        proof: preview.proof,
        confirm: true,
      });
      expect(a.id).toBe(b.id);
      const customer = (await outbox()).filter(
        (r: any) => r.kind === "customer"
      );
      expect(customer).toHaveLength(1);
      expect(payload(customer[0]).headers["List-Unsubscribe-Post"]).toBe(
        "List-Unsubscribe=One-Click"
      );
      const history = await caller.admin.email.history({});
      expect(JSON.stringify(history)).not.toContain("ciphertext");
      expect(JSON.stringify(history)).not.toContain("#token=");
    });
    it("unsubscribes without login and rechecks preferences before dispatch; account emails remain eligible", async () => {
      const { result } = await account(true),
        db = database();
      const auth = (await authenticateMemberSession(result.token))!;
      await updateMemberEmailPreferences(auth, {
        locale: "es",
        marketingOptIn: true,
      });
      const [member] = await db
        .select()
        .from(memberAccounts)
        .where(eq(memberAccounts.id, result.member.id));
      await db.transaction((tx: any) =>
        enqueueEmail(tx, member, {
          kind: "customer",
          key: "consent-test",
          subject: "Customer news",
          body: "A customer update for this test.",
          url: "https://providerbeacon.com/services",
        })
      );
      const unsub = unsubscribeToken(member);
      await unsubscribeMember(unsub);
      await unsubscribeMember(unsub);
      expect(
        (await outbox()).find((r: any) => r.kind === "customer").status
      ).toBe("cancelled");
      await db
        .update(emailOutbox)
        .set({ status: "queued" })
        .where(eq(emailOutbox.kind, "customer"));
      await db.delete(emailOutbox).where(eq(emailOutbox.kind, "welcome"));
      await due();
      await sendOneEmail();
      expect(fetch).not.toHaveBeenCalled();
      expect((await outbox())[0].status).toBe("cancelled");
      await requestPasswordEmail(input.email);
      expect((await outbox()).find((r: any) => r.kind === "reset").status).toBe(
        "queued"
      );
    });
    it("purges expired queued content while sending is off, and deletes member email data with the account", async () => {
      const { result } = await account();
      vi.stubEnv("MAIL_ENABLED", "false");
      await database()
        .update(emailOutbox)
        .set({ expiresAt: new Date(Date.now() - 10000) });
      await database()
        .update(memberEmailTokens)
        .set({ expiresAt: new Date(Date.now() - 10000) });
      await maintainEmailQueue();
      expect((await outbox())[0]).toMatchObject({
        payload: null,
        status: "cancelled",
      });
      expect(await database().select().from(memberEmailTokens)).toHaveLength(0);
      await database()
        .delete(memberAccounts)
        .where(eq(memberAccounts.id, result.member.id));
      expect(await outbox()).toHaveLength(0);
    });
  });
}
