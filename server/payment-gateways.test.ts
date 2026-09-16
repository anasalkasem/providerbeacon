import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  checkoutInput,
  paymentQuote,
  nextPaidMonth,
} from "../shared/providerPayments";
import {
  exactUsd,
  inspectNowPayment,
  inspectPaypalOrder,
  sufficientCryptoPayment,
  verifyNowSignature,
  verifyPaypalWebhook,
  safeCheckoutUrl,
  checkPaypal,
  createGatewayCheckout,
  validateGatewayConfig,
  type GatewayConfig,
} from "./paymentGateways";
import type { ProviderPayment } from "../drizzle/paymentSchema";

const id = "7995ad2f-4b76-4e8f-a948-afc5032ad11e";
const config: GatewayConfig = {
  id: "config",
  environment: "live",
  secrets: {
    gateway: "paypal",
    clientId: "client-identifier",
    clientSecret: "private-secret-value",
    webhookId: "WHWEBHOOK123",
    merchantId: "MERCHANTID1234",
  },
};
const payment = {
  id,
  gateway: "paypal",
  gatewayOrderId: "ORDER1234567890",
  amountCents: 1900,
  currency: "USD",
  providerId: 1,
  environment: "live",
} as ProviderPayment;
const order = () => ({
  id: payment.gatewayOrderId,
  status: "COMPLETED",
  purchase_units: [
    {
      custom_id: id,
      payee: { merchant_id: "MERCHANTID1234" },
      amount: { currency_code: "USD", value: "19.00" },
      payments: {
        captures: [
          {
            id: "CAPTURE123456789",
            status: "COMPLETED",
            amount: { currency_code: "USD", value: "19.00" },
          },
        ],
      },
    },
  ],
});
const crypto = {
  ...payment,
  gateway: "nowpayments",
  gatewayOrderId: "123456",
} as ProviderPayment;
const cryptoRemote = () => ({
  payment_id: 7654321,
  order_id: id,
  invoice_id: 123456,
  price_currency: "usd",
  price_amount: 19,
  pay_amount: "0.00019",
  actually_paid: "0.00019",
  payment_status: "finished",
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("payment verification and monthly checkout", () => {
  it("prices a prepaid fourth month at 29 and preserves month-end anniversaries", () => {
    const first = new Date("2026-01-31T12:00:00Z");
    expect(
      nextPaidMonth(new Date("2026-02-28T12:00:00Z"), first).toISOString()
    ).toBe("2026-03-31T12:00:00.000Z");
    const quote = paymentQuote(
      {
        status: "active",
        firstActivatedAt: first,
        endsAt: new Date("2026-04-30T12:00:00Z"),
      },
      new Date("2026-03-12T00:00:00Z")
    );
    expect(quote.amountCents).toBe(2900);
    expect(quote.endsAt.toISOString()).toBe("2026-05-31T12:00:00.000Z");
    expect(
      paymentQuote({ status: "inactive", firstActivatedAt: null, endsAt: null })
        .amountCents
    ).toBe(1900);
  });
  it("rejects user-supplied price, currency and ownership fields", () => {
    for (const added of [
      { amountCents: 1 },
      { currency: "EUR" },
      { memberId: 9 },
      { firstActivatedAt: new Date() },
    ])
      expect(
        checkoutInput.safeParse({ providerId: 1, gateway: "paypal", ...added })
          .success
      ).toBe(false);
  });
  it("compares exact minor units and crypto amounts without rounding underpayments up", () => {
    expect(exactUsd("19.000", 1900)).toBe(true);
    expect(exactUsd("18.999999999999", 1900)).toBe(false);
    expect(sufficientCryptoPayment("0.000189999999999999", "0.00019")).toBe(
      false
    );
    expect(sufficientCryptoPayment("1e-8", "0.00000001")).toBe(true);
    for (const value of [null, -1, "-1", Infinity, "NaN", "1e9999", 0])
      expect(sufficientCryptoPayment(value, 1)).toBe(false);
  });
  it("accepts only completed PayPal captures bound to the order, merchant, USD amount and invoice", () => {
    expect(inspectPaypalOrder(order(), payment, config)).toMatchObject({
      state: "paid",
      transactionId: "CAPTURE123456789",
    });
    for (const change of [
      (o: any) => (o.id = "OTHERORDER1234"),
      (o: any) => (o.purchase_units[0].custom_id = "another-invoice"),
      (o: any) => (o.purchase_units[0].payee.merchant_id = "OTHERSELLER1234"),
      (o: any) => (o.purchase_units[0].amount.value = "18.99"),
      (o: any) =>
        (o.purchase_units[0].payments.captures[0].amount.currency_code = "EUR"),
      (o: any) =>
        o.purchase_units[0].payments.captures.push(
          o.purchase_units[0].payments.captures[0]
        ),
    ]) {
      const o = order();
      change(o);
      expect(inspectPaypalOrder(o, payment, config).state).toBe("review");
    }
    const pending = order();
    pending.purchase_units[0].payments.captures[0].status = "PENDING";
    expect(inspectPaypalOrder(pending, payment, config).state).toBe("pending");
    const approved = {
      ...order(),
      status: "APPROVED",
      purchase_units: [{ ...order().purchase_units[0], payments: undefined }],
    };
    expect(inspectPaypalOrder(approved, payment, config).state).toBe("pending");
  });
  it("keeps crypto waiting, partly paid and confirming payments inactive", () => {
    expect(inspectNowPayment(cryptoRemote(), crypto, "7654321").state).toBe(
      "paid"
    );
    for (const payment_status of [
      "waiting",
      "confirming",
      "confirmed",
      "sending",
      "partially_paid",
    ])
      expect(
        inspectNowPayment(
          { ...cryptoRemote(), payment_status },
          crypto,
          "7654321"
        ).state
      ).toBe("pending");
    expect(
      inspectNowPayment(
        { ...cryptoRemote(), actually_paid: "0.00018" },
        crypto,
        "7654321"
      )
    ).toMatchObject({ state: "review", reason: "underpaid" });
    for (const changed of [
      { order_id: "other" },
      { invoice_id: 123457 },
      { payment_id: 1 },
      { price_amount: 18.99 },
      { price_currency: "eur" },
    ])
      expect(
        inspectNowPayment({ ...cryptoRemote(), ...changed }, crypto, "7654321")
          .state
      ).toBe("review");
  });
  it("verifies NOWPayments SHA-512 signatures using deep canonical keys", () => {
    const body = { z: [{ b: 2, a: 1 }], payment_id: 1, a: { z: 3, c: 2 } };
    const canonical = '{"a":{"c":2,"z":3},"payment_id":1,"z":[{"a":1,"b":2}]}';
    const signature = createHmac("sha512", "ipn-secret-for-local-tests")
      .update(canonical)
      .digest("hex");
    expect(
      verifyNowSignature(body, signature, "ipn-secret-for-local-tests")
    ).toBe(true);
    expect(
      verifyNowSignature(
        { ...body, payment_id: 2 },
        signature,
        "ipn-secret-for-local-tests"
      )
    ).toBe(false);
    expect(verifyNowSignature(body, signature, "wrong-secret")).toBe(false);
    for (const bad of [null, "", "gg".repeat(64), "aa".repeat(63)])
      expect(verifyNowSignature(body, bad, "secret")).toBe(false);
  });
  it("sends PayPal webhook headers for server verification and rejects a negative response", async () => {
    const fetcher = vi.fn(async (url: string) =>
      json(
        url.endsWith("/token")
          ? { access_token: "token" }
          : { verification_status: "FAILURE" }
      )
    );
    vi.stubGlobal("fetch", fetcher);
    const headers = {
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.paypal.com/cert",
      "paypal-transmission-id": "transmission-id",
      "paypal-transmission-sig": "signature",
      "paypal-transmission-time": "2026-09-15T00:00:00Z",
    };
    expect(await verifyPaypalWebhook(config, headers, { id: "event" })).toBe(
      false
    );
    expect(JSON.parse((fetcher.mock.calls[1] as any)[1].body)).toMatchObject({
      webhook_id: "WHWEBHOOK123",
      webhook_event: { id: "event" },
      transmission_sig: "signature",
    });
    expect(await verifyPaypalWebhook(config, {}, {})).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("recovers a capture timeout by reading the existing order without creating a second order", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    let reads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        if (url.endsWith("/token")) return json({ access_token: "token" });
        if (url.endsWith("/capture"))
          throw new Error("Connection dropped after successful capture");
        if (++reads === 1) {
          const o: any = order();
          o.status = "APPROVED";
          delete o.purchase_units[0].payments;
          return json(o);
        }
        return json(order());
      })
    );
    expect((await checkPaypal(payment, config, true)).state).toBe("paid");
    expect(calls.filter(c => c.url.endsWith("/capture"))).toHaveLength(1);
    expect(
      calls.some(c => c.url.endsWith("/orders") && c.init.method === "POST")
    ).toBe(false);
    expect(
      (calls.find(c => c.url.endsWith("/capture"))!.init.headers as any)[
        "PayPal-Request-Id"
      ]
    ).toBeTruthy();
  });
  it("creates a one-month USD checkout with server-owned return URLs and recipient", async () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
    const fetcher = vi.fn(async (url: string) =>
      json(
        url.endsWith("/token")
          ? { access_token: "token" }
          : {
              id: "ORDER1234567890",
              links: [
                {
                  rel: "payer-action",
                  href: "https://www.paypal.com/checkoutnow?token=ORDER1234567890",
                },
              ],
            }
      )
    );
    vi.stubGlobal("fetch", fetcher);
    expect((await createGatewayCheckout(payment, config)).gatewayOrderId).toBe(
      payment.gatewayOrderId
    );
    const body = JSON.parse((fetcher.mock.calls[1] as any)[1].body);
    expect(body.purchase_units[0]).toMatchObject({
      custom_id: id,
      amount: { currency_code: "USD", value: "19.00" },
      payee: { merchant_id: "MERCHANTID1234" },
    });
    expect(body.payment_source.paypal.experience_context.return_url).toBe(
      `https://providerbeacon.com/account/provider?payment=${id}&provider=1`
    );
  });
  it.each([1900, 2900])(
    "starts a %i-cent hosted invoice in USDT BEP20 with the USD quote and verified return paths",
    async amountCents => {
      vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
      const fetcher = vi.fn(async (_url: string, _init: RequestInit) =>
        json({
          id: 123456,
          invoice_url: "https://nowpayments.io/payment/?iid=123456",
        })
      );
      vi.stubGlobal("fetch", fetcher);
      const result = await createGatewayCheckout(
        { ...crypto, amountCents },
        {
          id: "crypto-config",
          environment: "live",
          secrets: {
            gateway: "nowpayments",
            apiKey: "test-api-key-value",
            ipnSecret: "test-ipn-secret-value",
          },
        }
      );
      expect(result).toEqual({
        gatewayOrderId: "123456",
        checkoutUrl: "https://nowpayments.io/payment/?iid=123456",
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      const [url, request] = fetcher.mock.calls[0];
      expect(url).toBe("https://api.nowpayments.io/v1/invoice");
      expect(request.method).toBe("POST");
      expect(JSON.parse(request.body as string)).toEqual({
        price_amount: amountCents / 100,
        price_currency: "usd",
        pay_currency: "usdtbsc",
        order_id: id,
        order_description:
          "ProviderBeacon provider package — one calendar month",
        ipn_callback_url:
          "https://providerbeacon.com/api/payments/nowpayments/webhook",
        success_url: `https://providerbeacon.com/account/provider?payment=${id}&provider=1`,
        cancel_url: `https://providerbeacon.com/account/provider?payment=${id}&provider=1&cancelled=1`,
        is_fixed_rate: true,
        is_fee_paid_by_user: false,
      });
    }
  );
  it("rejects unsafe redirects, wrong environments and misleading gateway errors", async () => {
    for (const url of [
      "http://www.paypal.com",
      "https://paypal.com.evil.test/",
      "https://www.paypal.com@evil.test/",
      "https://127.0.0.1/",
      "https://www.sandbox.paypal.com/",
    ])
      expect(() => safeCheckoutUrl("paypal", "live", url)).toThrow();
    expect(() =>
      safeCheckoutUrl("nowpayments", "live", "https://evil.test/invoice")
    ).toThrow();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ secret: "do-not-display-this-key" }, 401))
    );
    await expect(checkPaypal(payment, config, false)).rejects.toThrow(
      "payment_gateway_unavailable"
    );
  });
  it("refuses enabling PayPal without the correct webhook destination and event subscriptions", async () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        json(
          url.endsWith("/token")
            ? { access_token: "token" }
            : { url: "https://other.test/hook", event_types: [{ name: "*" }] }
        )
      )
    );
    await expect(validateGatewayConfig(config)).rejects.toThrow(
      "payment_webhook_configuration"
    );
  });
});
