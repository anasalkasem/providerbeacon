import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { memberAccounts, memberAuthBuckets } from "../drizzle/memberSchema";
import { memberWatches } from "../drizzle/workspaceSchema";
import { emailOutbox, emailSuppressions } from "../drizzle/emailSchema";
import { providerRecords, serviceRecords } from "../drizzle/schema";
import { authenticateMemberSession, registerMember } from "./memberDb";
import { memberCookieName, memberEmailKey } from "./memberSecurity";
import {
  readWorkspace,
  removeWorkspaceItem,
  saveWatch,
  setWatchTarget,
} from "./buyerWorkspace";
import { evaluateOnePriceAlert } from "./priceAlerts";
import {
  priceUnsubscribeToken,
  sendOneEmail,
  unsubscribeMember,
  unsubscribeToken,
} from "./emailDb";
import { decryptValue } from "./security";
import { invalidateCatalogueCaches } from "./catalogueCache";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";

export function priceAlertAcceptanceCases(
  database: () => any,
  providerId: () => number
) {
  describe("automatic price email acceptance", () => {
    beforeEach(async () => {
      await database().delete(memberAccounts);
      await database().delete(memberAuthBuckets);
      await database().delete(emailSuppressions);
      vi.stubEnv("AUTH_PEPPER", "local-price-alert-tests");
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      vi.stubEnv("MAIL_ENABLED", "true");
      vi.stubEnv("RESEND_API_KEY", "local-test-no-network");
      vi.stubEnv("RESEND_WEBHOOK_SECRET", "local-test");
    });
    async function account(email = "price-alert@example.com", verified = true) {
      const result = await registerMember({
        name: "Price test",
        email,
        password: "long local price alert test password",
        locale: "ar",
        marketingOptIn: false,
      });
      if (verified)
        await database()
          .update(memberAccounts)
          .set({ emailVerifiedAt: new Date() })
          .where(eq(memberAccounts.id, result.member.id));
      const auth = (await authenticateMemberSession(result.token))!;
      await database().delete(emailOutbox); // Isolated test: only price mail is dispatched.
      return { auth, result };
    }
    async function offer() {
      const [row] = await database()
        .insert(serviceRecords)
        .values({
          providerId: providerId(),
          externalId: "price-test",
          slug: `price-offer-${Math.random()}`,
          name: "TikTok Views",
          platform: "TikTok",
          category: "Views",
          countryCode: "WW",
          priceAmount: "2.6000",
          minOrder: 1,
          maxOrder: 10000,
          status: "active",
          reviewStatus: "approved",
          incomplete: false,
          normalizationVersion: 1,
          pricingConfirmed: true,
          priceCurrency: "USD",
          priceUnit: "per_1000",
          policyReviewed: true,
          evidenceUrl: "https://provider.example/prices",
          priceCheckedAt: new Date(),
          sourceUpdatedAt: new Date(),
        })
        .$returningId();
      invalidateCatalogueCaches();
      return row.id as number;
    }
    async function fixture() {
      const { auth, result } = await account();
      const serviceId = await offer();
      const watch = await saveWatch(auth, {
        serviceId: `service-${serviceId}`,
        quantity: 5000,
      });
      return { auth, result, serviceId, id: watch.id };
    }
    async function due() {
      await database()
        .update(memberWatches)
        .set({ emailAlertNextCheckAt: new Date(Date.now() - 5000) });
      await database()
        .update(emailOutbox)
        .set({ availableAt: new Date(Date.now() - 5000) });
    }
    const outbox = () =>
      database().select().from(emailOutbox).orderBy(emailOutbox.id);
    async function reduce(serviceId: number) {
      await database()
        .update(serviceRecords)
        .set({ priceAmount: "2.4000", priceCheckedAt: new Date() })
        .where(eq(serviceRecords.id, serviceId));
      // Intentionally leave the public cache untouched: evaluator must read fresh SQL.
      await due();
    }
    it("requires explicit verified opt-in and never retroactively emails saved targets", async () => {
      const f = await fixture();
      await setWatchTarget(f.auth, { id: f.id, target: "12" });
      await reduce(f.serviceId);
      expect(await evaluateOnePriceAlert()).toBe(false);
      expect(await outbox()).toHaveLength(0);
      await database()
        .update(memberAccounts)
        .set({ emailVerifiedAt: null })
        .where(eq(memberAccounts.id, f.auth.member.id));
      await expect(
        setWatchTarget(f.auth, { id: f.id, target: "12", emailAlert: true })
      ).rejects.toThrow("price_alert_verification_required");
      expect(fetch).not.toHaveBeenCalled();
    });
    it("serializes concurrent evaluators and sends exact original-currency totals once without marketing consent", async () => {
      const f = await fixture();
      await setWatchTarget(f.auth, {
        id: f.id,
        target: "12",
        emailAlert: true,
      });
      await due();
      expect(await evaluateOnePriceAlert()).toBe(false);
      await reduce(f.serviceId);
      await Promise.all([
        evaluateOnePriceAlert(),
        evaluateOnePriceAlert(),
        evaluateOnePriceAlert(),
      ]);
      const rows = await outbox();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "price_target", status: "queued" });
      const payload = JSON.parse(decryptValue(rows[0].payload, "email-outbox"));
      expect(payload.text).toContain("USD 13.00");
      expect(payload.text).toContain("USD 12.00");
      expect(payload.text).toContain("quantity=5000&currency=USD");
      expect(payload.html).toContain('dir="rtl"');
      expect(payload.headers["List-Unsubscribe"]).toContain("token=prices.");
      expect(payload.headers["List-Unsubscribe-Post"]).toBe(
        "List-Unsubscribe=One-Click"
      );
      await setWatchTarget(f.auth, {
        id: f.id,
        target: "12.00",
        emailAlert: true,
      });
      await due();
      await evaluateOnePriceAlert();
      expect(await outbox()).toHaveLength(1);
      const mock = vi
        .fn()
        .mockResolvedValueOnce(new Response("retry", { status: 503 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: "price-message-1" }), {
            status: 200,
          })
        );
      vi.stubGlobal("fetch", mock);
      await sendOneEmail();
      await due();
      await sendOneEmail();
      expect(mock).toHaveBeenCalledTimes(2);
      expect(mock.mock.calls[0][1].body).toBe(mock.mock.calls[1][1].body);
      expect(mock.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
        mock.mock.calls[1][1].headers["Idempotency-Key"]
      );
      expect((await outbox())[0]).toMatchObject({
        status: "accepted",
        payload: null,
      });
      await due();
      await evaluateOnePriceAlert();
      await sendOneEmail();
      expect(mock).toHaveBeenCalledTimes(2);
    });
    it.each(["hidden", "currency", "stale", "higher", "deleted"])(
      "cancels queued email if the offer becomes %s before dispatch",
      async reason => {
        const f = await fixture();
        await setWatchTarget(f.auth, {
          id: f.id,
          target: "12",
          emailAlert: true,
        });
        await reduce(f.serviceId);
        await evaluateOnePriceAlert();
        await due();
        if (reason === "hidden")
          await database()
            .update(providerRecords)
            .set({ status: "suspended" })
            .where(eq(providerRecords.id, providerId()));
        else if (reason === "deleted")
          await database()
            .delete(serviceRecords)
            .where(eq(serviceRecords.id, f.serviceId));
        else
          await database()
            .update(serviceRecords)
            .set(
              reason === "currency"
                ? { priceCurrency: "INR" }
                : reason === "higher"
                  ? { priceAmount: "2.5000" }
                  : {
                      priceCheckedAt: new Date(Date.now() - 2 * 86400000),
                      sourceUpdatedAt: new Date(Date.now() - 2 * 86400000),
                    }
            )
            .where(eq(serviceRecords.id, f.serviceId));
        await sendOneEmail();
        expect(fetch).not.toHaveBeenCalled();
        expect((await outbox())[0]).toMatchObject({
          status: "cancelled",
          payload: null,
        });
      }
    );
    it("keeps price unsubscribe separate, cancels retries, and rejects tampered or old-address tokens", async () => {
      const f = await fixture();
      await database()
        .update(memberAccounts)
        .set({ marketingOptIn: true })
        .where(eq(memberAccounts.id, f.auth.member.id));
      await setWatchTarget(f.auth, {
        id: f.id,
        target: "12",
        emailAlert: true,
      });
      await reduce(f.serviceId);
      await evaluateOnePriceAlert();
      await due();
      await unsubscribeMember(unsubscribeToken(f.auth.member));
      expect(
        (await database().select().from(memberWatches))[0].emailAlertEnabled
      ).toBe(true);
      await database()
        .update(memberAccounts)
        .set({ marketingOptIn: true })
        .where(eq(memberAccounts.id, f.auth.member.id));
      const token = priceUnsubscribeToken(f.auth.member);
      await expect(
        unsubscribeMember(
          token.slice(0, -1) + (token.endsWith("A") ? "B" : "A")
        )
      ).rejects.toThrow();
      await unsubscribeMember(
        priceUnsubscribeToken({ ...f.auth.member, email: "old@example.com" })
      );
      expect(
        (await database().select().from(memberWatches))[0].emailAlertEnabled
      ).toBe(true);
      await unsubscribeMember(token);
      await unsubscribeMember(token); // Replayed one-click requests remain harmless.
      expect(
        (await database().select().from(memberAccounts))[0].marketingOptIn
      ).toBe(true);
      expect(
        (await database().select().from(memberWatches))[0].emailAlertEnabled
      ).toBe(false);
      await sendOneEmail();
      expect(fetch).not.toHaveBeenCalled();
      expect((await outbox())[0]).toMatchObject({
        status: "cancelled",
        payload: null,
      });
    });
    it("prevents cross-account and cross-origin preference changes, and deletes pending alerts with a watch", async () => {
      const f = await fixture();
      const other = await account("other-price@example.com");
      await expect(
        setWatchTarget(other.auth, { id: f.id, target: "12", emailAlert: true })
      ).rejects.toThrow("workspace_missing");
      const res = { setHeader: vi.fn(), cookie: vi.fn(), clearCookie: vi.fn() };
      const caller = appRouter.createCaller(
        await createContext({
          req: {
            headers: {
              cookie: `${memberCookieName("session")}=${f.result.token}`,
              origin: "https://evil.example",
            },
            socket: { remoteAddress: "127.0.0.1" },
          },
          res,
        } as any)
      );
      await expect(
        caller.workspace.target({ id: f.id, target: "12", emailAlert: true })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await setWatchTarget(f.auth, {
        id: f.id,
        target: "12",
        emailAlert: true,
      });
      await reduce(f.serviceId);
      await evaluateOnePriceAlert();
      await removeWorkspaceItem(other.auth, f.id, "watch");
      expect((await outbox())[0].status).toBe("queued");
      await removeWorkspaceItem(f.auth, f.id, "watch");
      expect((await outbox())[0].status).toBe("cancelled");
    });
    it("pauses stale or changed terms, respects sending disablement and suppression, and replaces a target atomically", async () => {
      const f = await fixture();
      await setWatchTarget(f.auth, {
        id: f.id,
        target: "12",
        emailAlert: true,
      });
      await reduce(f.serviceId);
      vi.stubEnv("MAIL_ENABLED", "false");
      expect(await evaluateOnePriceAlert()).toBe(false);
      vi.stubEnv("MAIL_ENABLED", "true");
      await database()
        .insert(emailSuppressions)
        .values({
          recipientHash: memberEmailKey(f.auth.member.email),
          reason: "bounced",
        });
      expect(await evaluateOnePriceAlert()).toBe(false);
      await database().delete(emailSuppressions);
      await due();
      await evaluateOnePriceAlert();
      await setWatchTarget(f.auth, {
        id: f.id,
        target: "11",
        emailAlert: true,
      });
      expect((await outbox())[0].status).toBe("cancelled");
      await due();
      expect(await evaluateOnePriceAlert()).toBe(false);
      await database()
        .update(serviceRecords)
        .set({ priceCurrency: "INR" })
        .where(eq(serviceRecords.id, f.serviceId));
      await due();
      expect(await evaluateOnePriceAlert()).toBe(false);
      invalidateCatalogueCaches();
      expect((await readWorkspace(f.auth)).watches[0].emailAlert.status).toBe(
        "paused"
      );
      await setWatchTarget(f.auth, {
        id: f.id,
        target: null,
        emailAlert: false,
      });
      expect(
        (await database().select().from(memberWatches))[0].emailAlertEnabled
      ).toBe(false);
    });
  });
}
