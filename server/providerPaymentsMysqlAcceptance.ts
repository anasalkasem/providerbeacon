import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { request } from "node:http";
import express from "express";
import { memberAccounts } from "../drizzle/memberSchema";
import { providerBusinessAccounts as accounts } from "../drizzle/businessSchema";
import {
  paymentCredentials,
  paymentGatewaySettings,
  providerPayments,
} from "../drizzle/paymentSchema";
import { auditEntries, providerRecords, users } from "../drizzle/schema";
import { nextPaidMonth } from "../shared/providerPayments";
import { providerMonthAnniversary } from "../shared/providerBusinessPricing";
import {
  registerMember,
  authenticateMemberSession,
  logoutMember,
} from "./memberDb";
import { memberCookieName } from "./memberSecurity";
import { appRouter } from "./routers";
import {
  gatewaySettings,
  publicPaymentMethods,
  saveGatewaySettings,
  startProviderCheckout,
  paymentById,
  ownerPayments,
  ownerPayment,
  recheckProviderPayment,
  cancelProviderCheckout,
  closeReviewedPayment,
  recordVerifiedPayment,
  applyReviewedPayment,
  paymentConfig,
  adminPayments,
} from "./providerPaymentsDb";
import { registerPaymentRoutes } from "./paymentRoutes";

export function providerPaymentsAcceptanceCases(
  database: () => any,
  actorId: () => number,
  providerId: () => number
) {
  describe("provider payment collection against MySQL", () => {
    let paypal: Map<string, any>;
    let now: Map<string, any>;
    let created: number;
    let signatureValid: boolean;
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    beforeEach(async () => {
      await database().delete(providerPayments);
      await database()
        .update(paymentGatewaySettings)
        .set({ enabled: false, credentialId: null, revision: 0 });
      await database().delete(paymentCredentials);
      await database().delete(memberAccounts);
      await database()
        .update(providerRecords)
        .set({ websiteUrl: "https://provider.example/" })
        .where(eq(providerRecords.id, providerId()));
      vi.stubEnv("AUTH_PEPPER", "payment-local-test-pepper");
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      vi.stubEnv("MAIL_ENABLED", "false");
      vi.stubEnv("OAUTH_SERVER_URL", "");
      paypal = new Map();
      now = new Map();
      created = 0;
      signatureValid = true;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (raw: string, init: RequestInit) => {
          const url = new URL(raw),
            path = url.pathname;
          if (path.endsWith("/token"))
            return json({ access_token: "local-test-token" });
          if (path.includes("verify-webhook-signature"))
            return json({
              verification_status: signatureValid ? "SUCCESS" : "FAILURE",
            });
          if (path.includes("/notifications/webhooks/"))
            return json({
              url: "https://providerbeacon.com/api/payments/paypal/webhook",
              event_types: [{ name: "*" }],
            });
          if (path === "/v1/merchant/coins")
            return json({ selectedCurrencies: ["btc", "usdttrc20"] });
          if (path === "/v2/checkout/orders") {
            const body = JSON.parse(String(init.body));
            const id = `ORDER${String(++created).padStart(12, "0")}`;
            paypal.set(id, {
              id,
              status: "CREATED",
              purchase_units: body.purchase_units,
            });
            return json({
              id,
              links: [
                {
                  rel: "payer-action",
                  href: `https://www.paypal.com/checkoutnow?token=${id}`,
                },
              ],
            });
          }
          if (path.startsWith("/v2/checkout/orders/")) {
            const id = path.split("/")[4],
              order = paypal.get(id);
            if (!order) throw new Error("Unknown local order");
            if (path.endsWith("/capture")) {
              if (order.status !== "COMPLETED") {
                order.status = "COMPLETED";
                order.purchase_units[0].payments = {
                  captures: [
                    {
                      id: `CAPTURE${id.slice(5)}`,
                      status: "COMPLETED",
                      amount: order.purchase_units[0].amount,
                    },
                  ],
                };
              }
            }
            return json(order);
          }
          if (path === "/v1/invoice") {
            const id = String(++created + 100000);
            return json({
              id,
              invoice_url: `https://nowpayments.io/payment/?iid=${id}`,
            });
          }
          if (path.startsWith("/v1/payment/"))
            return json(now.get(path.split("/")[3]));
          throw new Error(`Unexpected local gateway request: ${path}`);
        })
      );
    });
    async function owner() {
      const result = await registerMember({
        name: "Local payment owner",
        email: "payment-owner@example.com",
        password: "long local payment owner password",
      });
      await database()
        .update(memberAccounts)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(memberAccounts.id, result.member.id));
      const auth = (await authenticateMemberSession(result.token))!;
      await database()
        .insert(accounts)
        .values({
          providerId: providerId(),
          ownerMemberId: result.member.id,
          ownerHost: "provider.example",
          ownershipVerifiedAt: new Date(),
        });
      return { auth, result };
    }
    async function setup(
      gateway: "paypal" | "nowpayments" = "paypal",
      environment: "live" | "sandbox" = "live"
    ) {
      return saveGatewaySettings(actorId(), {
        gateway,
        revision: 0,
        environment,
        enabled: true,
        ...(gateway === "paypal"
          ? {
              clientId: "local-client-identifier",
              clientSecret: "local-client-secret-value",
              merchantId: "MERCHANTID1234",
              webhookId: "WEBHOOKID1234",
            }
          : {
              apiKey: "local-crypto-api-key",
              ipnSecret: "local-crypto-ipn-secret",
            }),
      });
    }
    async function account() {
      return (
        await database()
          .select()
          .from(accounts)
          .where(eq(accounts.providerId, providerId()))
      )[0];
    }
    async function webhook(
      gateway: "paypal" | "nowpayments",
      body: unknown,
      headers: Record<string, string> = {}
    ) {
      const app = express();
      registerPaymentRoutes(app);
      const server = app.listen(0, "127.0.0.1");
      await new Promise<void>(resolve => server.once("listening", resolve));
      try {
        const port = (server.address() as any).port;
        return await new Promise<number>((resolve, reject) => {
          const req = request(
            {
              hostname: "127.0.0.1",
              port,
              path: `/api/payments/${gateway}/webhook`,
              method: "POST",
              headers: { "content-type": "application/json", ...headers },
            },
            res => {
              res.resume();
              res.on("end", () => resolve(res.statusCode!));
            }
          );
          req.on("error", reject);
          req.end(JSON.stringify(body));
        });
      } finally {
        await new Promise<void>(resolve => server.close(() => resolve()));
      }
    }
    const paypalHeaders = {
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.paypal.com/cert",
      "paypal-transmission-id": "local-transmission",
      "paypal-transmission-sig": "local-signature",
      "paypal-transmission-time": "2026-09-15T00:00:00Z",
    };
    async function cryptoNotify(
      payment: any,
      status: string,
      actual = "0.00019",
      valid = true
    ) {
      const remote = {
        payment_id: "99887766",
        invoice_id: payment.gatewayOrderId,
        order_id: payment.id,
        price_amount: 19,
        price_currency: "usd",
        pay_amount: "0.00019",
        actually_paid: actual,
        payment_status: status,
      };
      now.set(remote.payment_id, remote);
      const canonical = JSON.stringify(
        Object.fromEntries(
          Object.entries(remote).sort(([a], [b]) => a.localeCompare(b))
        )
      );
      const sig = createHmac(
        "sha512",
        valid ? "local-crypto-ipn-secret" : "wrong-test-secret"
      )
        .update(canonical)
        .digest("hex");
      return webhook("nowpayments", remote, { "x-nowpayments-sig": sig });
    }
    it("encrypts credentials, returns no secrets, and retains the old verifier after rotation", async () => {
      await setup();
      const original = (
        await database()
          .select()
          .from(paymentGatewaySettings)
          .where(eq(paymentGatewaySettings.gateway, "paypal"))
      )[0];
      expect(JSON.stringify(await gatewaySettings())).not.toContain(
        "local-client-secret"
      );
      expect(
        JSON.stringify(await database().select().from(paymentCredentials))
      ).not.toContain("local-client-secret");
      await saveGatewaySettings(actorId(), {
        gateway: "paypal",
        revision: 1,
        enabled: false,
        environment: "live",
        clientSecret: "rotated-client-secret-value",
      });
      expect(
        (await paymentConfig(original.credentialId)).secrets
      ).toMatchObject({ clientSecret: "local-client-secret-value" });
      expect(
        JSON.stringify(await database().select().from(auditEntries))
      ).not.toContain("local-client-secret");
      await expect(
        saveGatewaySettings(actorId(), {
          gateway: "paypal",
          revision: 1,
          enabled: false,
          environment: "live",
        })
      ).rejects.toThrow("payment_changed");
    });
    it("keeps sandbox and unconfigured gateways unavailable to members", async () => {
      const member = await owner();
      await expect(
        startProviderCheckout(member.auth, providerId(), "paypal")
      ).rejects.toThrow("payment_unavailable");
      await setup("paypal", "sandbox");
      expect(await publicPaymentMethods()).toEqual([
        { gateway: "paypal", available: false },
        { gateway: "nowpayments", available: false },
      ]);
      await expect(
        startProviderCheckout(member.auth, providerId(), "paypal")
      ).rejects.toThrow("payment_unavailable");
      expect(created).toBe(0);
    });
    it("collects a PayPal approval webhook and activates exactly one month after capture", async () => {
      const member = await owner();
      await setup();
      const checkout = await startProviderCheckout(
        member.auth,
        providerId(),
        "paypal"
      );
      const row = (await paymentById(checkout.id))!;
      expect(row.amountCents).toBe(1900);
      expect((await account()).status).toBe("inactive");
      paypal.get(row.gatewayOrderId!).status = "APPROVED";
      const event = {
        event_type: "CHECKOUT.ORDER.APPROVED",
        resource: { id: row.gatewayOrderId },
      };
      signatureValid = false;
      expect(await webhook("paypal", event, paypalHeaders)).toBe(401);
      expect((await account()).status).toBe("inactive");
      signatureValid = true;
      expect(await webhook("paypal", event, paypalHeaders)).toBe(200);
      const active = await account();
      expect(active.status).toBe("active");
      expect(active.endsAt.getTime()).toBe(
        nextPaidMonth(active.startsAt, active.firstActivatedAt).getTime()
      );
      await webhook("paypal", event, paypalHeaders);
      expect((await account()).endsAt.getTime()).toBe(active.endsAt.getTime());
      expect((await ownerPayment(member.auth, row.id)).state).toBe("paid");
    });
    it("serializes parallel checkout requests and duplicate settlement across database connections", async () => {
      const member = await owner();
      await setup();
      const checkouts = await Promise.all(
        Array.from({ length: 4 }, () =>
          startProviderCheckout(member.auth, providerId(), "paypal")
        )
      );
      expect(new Set(checkouts.map(p => p.id)).size).toBe(1);
      expect(created).toBe(1);
      const id = checkouts[0].id;
      await Promise.all(
        Array.from({ length: 4 }, () =>
          recordVerifiedPayment(id, {
            state: "paid",
            gatewayStatus: "COMPLETED",
            transactionId: "CAPTURE123456789",
          })
        )
      );
      const active = await account();
      expect(active.endsAt.getTime()).toBe(
        nextPaidMonth(active.startsAt, active.firstActivatedAt).getTime()
      );
      expect(
        await database()
          .select()
          .from(auditEntries)
          .where(
            and(
              eq(auditEntries.entityId, id),
              eq(auditEntries.action, "payments.applied")
            )
          )
      ).toHaveLength(1);
    });
    it("quotes month four at 29 and adds renewal after the existing paid end", async () => {
      const member = await owner();
      await setup();
      const first = new Date();
      first.setUTCMonth(first.getUTCMonth() - 2);
      first.setUTCDate(10);
      const end = providerMonthAnniversary(first, 3);
      await database()
        .update(accounts)
        .set({
          status: "active",
          startsAt: first,
          firstActivatedAt: first,
          endsAt: end,
        })
        .where(eq(accounts.providerId, providerId()));
      const checkout = await startProviderCheckout(
        member.auth,
        providerId(),
        "paypal"
      );
      expect(checkout.amountCents).toBe(2900);
      const row = (await paymentById(checkout.id))!;
      paypal.get(row.gatewayOrderId!).status = "APPROVED";
      await recheckProviderPayment(member.auth, row.id);
      const after = await account();
      expect(after.startsAt.getTime()).toBe(first.getTime());
      expect(after.firstActivatedAt.getTime()).toBe(first.getTime());
      expect(after.endsAt.getTime()).toBe(
        providerMonthAnniversary(first, 4).getTime()
      );
    });
    it("does not collect an approved checkout after suspension and holds already received funds for review", async () => {
      const member = await owner();
      await setup();
      const checkout = await startProviderCheckout(
        member.auth,
        providerId(),
        "paypal"
      );
      const row = (await paymentById(checkout.id))!;
      paypal.get(row.gatewayOrderId!).status = "APPROVED";
      await database()
        .update(accounts)
        .set({ status: "suspended", revision: 2 })
        .where(eq(accounts.providerId, providerId()));
      await recheckProviderPayment(member.auth, row.id);
      expect(paypal.get(row.gatewayOrderId!).status).toBe("APPROVED");
      await recordVerifiedPayment(row.id, {
        state: "paid",
        gatewayStatus: "COMPLETED",
        transactionId: "CAPTURE123456789",
      });
      expect((await paymentById(row.id))?.state).toBe("review");
      expect((await account()).status).toBe("suspended");
      await expect(
        startProviderCheckout(member.auth, providerId(), "paypal")
      ).rejects.toThrow("payment_suspended");
    });
    it("verifies crypto signatures and full amounts before granting access", async () => {
      const member = await owner();
      await setup("nowpayments");
      const checkout = await startProviderCheckout(
        member.auth,
        providerId(),
        "nowpayments"
      );
      const row = (await paymentById(checkout.id))!;
      expect(await cryptoNotify(row, "finished", "0.00019", false)).toBe(401);
      expect((await account()).status).toBe("inactive");
      expect(await cryptoNotify(row, "partially_paid", "0.00010")).toBe(200);
      expect((await account()).status).toBe("inactive");
      expect((await paymentById(row.id))?.state).toBe("pending");
      expect(await cryptoNotify(row, "finished")).toBe(200);
      expect((await account()).status).toBe("active");
      const end = (await account()).endsAt.getTime();
      await cryptoNotify(row, "finished");
      expect((await account()).endsAt.getTime()).toBe(end);
    });
    it("keeps a finished but underpaid crypto invoice in review and blocks manual grant", async () => {
      const member = await owner();
      await setup("nowpayments");
      const checkout = await startProviderCheckout(
        member.auth,
        providerId(),
        "nowpayments"
      );
      const row = (await paymentById(checkout.id))!;
      await cryptoNotify(row, "finished", "0.00018");
      expect((await paymentById(row.id))?.state).toBe("review");
      expect((await account()).status).toBe("inactive");
      await expect(
        applyReviewedPayment(
          actorId(),
          row.id,
          "Reviewed insufficient local test payment"
        )
      ).rejects.toThrow("payment_not_verified");
      await closeReviewedPayment(
        actorId(),
        row.id,
        "Resolved local fixture with payer; no refund executed by this action"
      );
      expect((await paymentById(row.id))?.state).toBe("expired");
      expect((await account()).status).toBe("inactive");
      expect(
        (await startProviderCheckout(member.auth, providerId(), "nowpayments"))
          .id
      ).not.toBe(row.id);
    });
    it("holds cancelled late payments and applies an operator-reviewed full payment only once", async () => {
      const member = await owner();
      await setup("nowpayments");
      const checkout = await startProviderCheckout(
        member.auth,
        providerId(),
        "nowpayments"
      );
      await cancelProviderCheckout(member.auth, checkout.id);
      const row = (await paymentById(checkout.id))!;
      await cryptoNotify(row, "finished");
      expect((await paymentById(row.id))?.state).toBe("review");
      expect((await account()).status).toBe("inactive");
      const applied = await Promise.allSettled([
        applyReviewedPayment(
          actorId(),
          row.id,
          "Verified full local payment after a cancelled checkout"
        ),
        applyReviewedPayment(
          actorId(),
          row.id,
          "Concurrent local review must not duplicate access"
        ),
      ]);
      expect(applied.filter(r => r.status === "fulfilled")).toHaveLength(1);
      const active = await account();
      expect(active.endsAt.getTime()).toBe(
        nextPaidMonth(active.startsAt, active.firstActivatedAt).getTime()
      );
    });
    it("does not restore ownership or paid access after a provider-domain change", async () => {
      const member = await owner();
      await setup("nowpayments");
      const checkout = await startProviderCheckout(
        member.auth,
        providerId(),
        "nowpayments"
      );
      const row = (await paymentById(checkout.id))!;
      await database()
        .update(providerRecords)
        .set({ websiteUrl: "https://different.example/" })
        .where(eq(providerRecords.id, providerId()));
      await cryptoNotify(row, "finished");
      expect((await paymentById(row.id))?.reviewReason).toBe(
        "ownership_changed"
      );
      expect((await account()).status).toBe("inactive");
    });
    it("suspends access for a signed PayPal refund and ignores replayed completion notifications", async () => {
      const member = await owner();
      await setup();
      const checkout = await startProviderCheckout(
        member.auth,
        providerId(),
        "paypal"
      );
      const row = (await paymentById(checkout.id))!;
      paypal.get(row.gatewayOrderId!).status = "APPROVED";
      await recheckProviderPayment(member.auth, row.id);
      const paid = (await paymentById(row.id))!;
      expect(
        await webhook(
          "paypal",
          {
            event_type: "PAYMENT.CAPTURE.REFUNDED",
            resource: {
              id: "REFUND123456789",
              links: [
                {
                  rel: "up",
                  href: `https://api.paypal.com/v2/payments/captures/${paid.transactionId}`,
                },
              ],
            },
          },
          paypalHeaders
        )
      ).toBe(200);
      expect((await paymentById(row.id))?.state).toBe("refunded");
      expect((await account()).status).toBe("suspended");
      await recordVerifiedPayment(row.id, {
        state: "paid",
        gatewayStatus: "COMPLETED",
        transactionId: paid.transactionId!,
      });
      expect((await account()).status).toBe("suspended");
    });
    it("enforces session, owner, Origin and staff boundaries on payment endpoints", async () => {
      const member = await owner();
      await setup();
      const caller = (
        token?: string,
        origin = "https://providerbeacon.com",
        user: any = null
      ) =>
        appRouter.createCaller({
          req: {
            headers: {
              origin,
              ...(token
                ? { cookie: `${memberCookieName("session")}=${token}` }
                : {}),
            },
          },
          res: { setHeader: vi.fn() },
          user,
        } as any);
      await expect(
        caller().business.payments.checkout({
          providerId: providerId(),
          gateway: "paypal",
        })
      ).rejects.toThrow("member_sign_in_required");
      await expect(
        caller(
          member.result.token,
          "https://attacker.example"
        ).business.payments.checkout({
          providerId: providerId(),
          gateway: "paypal",
        })
      ).rejects.toThrow("member_origin");
      await expect(
        caller(member.result.token).business.payments.list({
          accountId: member.auth.member.id + 1,
          providerId: providerId(),
        })
      ).rejects.toThrow("business_owner_required");
      await expect(
        caller(member.result.token).admin.business.payments.settings()
      ).rejects.toThrow();
      const checkout = await startProviderCheckout(
        member.auth,
        providerId(),
        "paypal"
      );
      const other = await registerMember({
        name: "Other member",
        email: "other-payments@example.com",
        password: "another long local test password",
      });
      await expect(
        caller(other.token).business.payments.status({
          accountId: other.member.id,
          paymentId: checkout.id,
        })
      ).rejects.toThrow("payment_missing");
      const [staff] = await database()
        .select()
        .from(users)
        .where(eq(users.id, actorId()));
      expect(
        JSON.stringify(
          await caller(
            undefined,
            "https://providerbeacon.com",
            staff
          ).admin.business.payments.settings()
        )
      ).not.toContain("local-client-secret");
      await logoutMember(member.result.token);
      await expect(ownerPayments(member.auth, providerId())).rejects.toThrow();
    });
    it("paginates equal-timestamp payment records without skipping any receipts", async () => {
      const member = await owner();
      await setup();
      const checkout = await startProviderCheckout(
        member.auth,
        providerId(),
        "paypal"
      );
      const row = (await paymentById(checkout.id))!;
      const { randomUUID } = await import("node:crypto");
      await database()
        .insert(providerPayments)
        .values(
          Array.from({ length: 31 }, () => ({
            ...row,
            id: randomUUID(),
            gatewayOrderId: null,
            transactionId: null,
            checkoutUrl: null,
          }))
        );
      const first = await adminPayments();
      const second = await adminPayments(first.nextCursor!);
      expect(first.items).toHaveLength(30);
      expect(second.items).toHaveLength(2);
      expect(
        new Set([...first.items, ...second.items].map(p => p.id)).size
      ).toBe(32);
    });
  });
}
