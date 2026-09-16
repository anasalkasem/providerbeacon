import { createHmac, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { IncomingHttpHeaders } from "node:http";
import { z } from "zod";
import type { ProviderPayment } from "../drizzle/paymentSchema";
import {
  nowpaymentsCheckoutAsset,
  type PaymentGateway,
} from "../shared/providerPayments";
import { memberAuthOrigin } from "./memberSecurity";

export const gatewaySecrets = z.discriminatedUnion("gateway", [
  z
    .object({
      gateway: z.literal("paypal"),
      clientId: z.string().min(10),
      clientSecret: z.string().min(10),
      webhookId: z.string().regex(/^[A-Za-z0-9]{5,100}$/),
      merchantId: z.string().regex(/^[A-Z0-9]{8,32}$/),
    })
    .strict(),
  z
    .object({
      gateway: z.literal("nowpayments"),
      apiKey: z.string().min(10),
      ipnSecret: z.string().min(16),
    })
    .strict(),
]);
export type GatewayConfig = {
  id: string;
  environment: "live" | "sandbox";
  secrets: z.infer<typeof gatewaySecrets>;
};
export function paymentFail(
  reason: string,
  code:
    | "BAD_REQUEST"
    | "FORBIDDEN"
    | "CONFLICT"
    | "NOT_FOUND"
    | "SERVICE_UNAVAILABLE" = "BAD_REQUEST"
): never {
  throw new TRPCError({ code, message: `payment_${reason}` });
}
async function jsonRequest(url: string, init: RequestInit) {
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) paymentFail("gateway_unavailable", "SERVICE_UNAVAILABLE");
    const text = await response.text();
    if (text.length > 256_000)
      paymentFail("gateway_unavailable", "SERVICE_UNAVAILABLE");
    return JSON.parse(text) as Record<string, any>;
  } catch {
    // Never expose an upstream body, Authorization header, key or payer details.
    paymentFail("gateway_unavailable", "SERVICE_UNAVAILABLE");
  }
}
const paypalBase = (config: GatewayConfig) =>
  config.environment === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
async function paypalRequest(
  config: GatewayConfig,
  path: string,
  method = "GET",
  body?: unknown,
  requestId?: string
) {
  if (config.secrets.gateway !== "paypal") paymentFail("configuration");
  const token = await jsonRequest(`${paypalBase(config)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.secrets.clientId}:${config.secrets.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (typeof token.access_token !== "string")
    paymentFail("gateway_unavailable", "SERVICE_UNAVAILABLE");
  return jsonRequest(`${paypalBase(config)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function nowRequest(config: GatewayConfig, path: string, body?: unknown) {
  if (config.secrets.gateway !== "nowpayments" || config.environment !== "live")
    paymentFail("configuration");
  return jsonRequest(`https://api.nowpayments.io/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "x-api-key": config.secrets.apiKey,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
export function safeCheckoutUrl(
  gateway: PaymentGateway,
  environment: "live" | "sandbox",
  raw: unknown
) {
  if (typeof raw !== "string" || raw.length > 1000)
    paymentFail("gateway_unavailable", "SERVICE_UNAVAILABLE");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    paymentFail("gateway_unavailable", "SERVICE_UNAVAILABLE");
  }
  const hosts =
    gateway === "paypal"
      ? environment === "live"
        ? ["www.paypal.com", "paypal.com"]
        : ["www.sandbox.paypal.com", "sandbox.paypal.com"]
      : ["nowpayments.io", "www.nowpayments.io"];
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !hosts.includes(url.hostname)
  )
    paymentFail("gateway_unavailable", "SERVICE_UNAVAILABLE");
  return url.href;
}
export async function createGatewayCheckout(
  payment: ProviderPayment,
  config: GatewayConfig
) {
  const origin = memberAuthOrigin();
  const returned = `${origin}/account/provider?payment=${payment.id}&provider=${payment.providerId}`;
  const description = "ProviderBeacon provider package — one calendar month";
  if (payment.gateway === "paypal") {
    if (config.secrets.gateway !== "paypal") paymentFail("configuration");
    const order = await paypalRequest(
      config,
      "/v2/checkout/orders",
      "POST",
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: payment.id,
            custom_id: payment.id,
            invoice_id: payment.id,
            payee: { merchant_id: config.secrets.merchantId },
            description,
            amount: {
              currency_code: "USD",
              value: (payment.amountCents / 100).toFixed(2),
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "ProviderBeacon",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              return_url: returned,
              cancel_url: `${returned}&cancelled=1`,
            },
          },
        },
      },
      payment.id
    );
    if (typeof order.id !== "string" || !/^[A-Z0-9]{8,64}$/.test(order.id))
      paymentFail("gateway_unavailable", "SERVICE_UNAVAILABLE");
    const link = Array.isArray(order.links)
      ? order.links.find(
          (l: any) => l.rel === "payer-action" || l.rel === "approve"
        )
      : null;
    return {
      gatewayOrderId: order.id,
      checkoutUrl: safeCheckoutUrl("paypal", config.environment, link?.href),
    };
  }
  const invoice = await nowRequest(config, "/invoice", {
    price_amount: payment.amountCents / 100,
    price_currency: "usd",
    pay_currency: nowpaymentsCheckoutAsset.code,
    order_id: payment.id,
    order_description: description,
    ipn_callback_url: `${origin}/api/payments/nowpayments/webhook`,
    success_url: returned,
    cancel_url: `${returned}&cancelled=1`,
    is_fixed_rate: true,
    is_fee_paid_by_user: false,
  });
  const id = String(invoice.id ?? "");
  if (!/^\d{1,40}$/.test(id))
    paymentFail("gateway_unavailable", "SERVICE_UNAVAILABLE");
  return {
    gatewayOrderId: id,
    checkoutUrl: safeCheckoutUrl("nowpayments", "live", invoice.invoice_url),
  };
}
export async function validateGatewayConfig(config: GatewayConfig) {
  if (config.secrets.gateway === "paypal") {
    const webhook = await paypalRequest(
      config,
      `/v1/notifications/webhooks/${config.secrets.webhookId}`
    );
    const events = Array.isArray(webhook.event_types)
      ? webhook.event_types.map((e: any) => e.name)
      : [];
    if (
      webhook.url !== `${memberAuthOrigin()}/api/payments/paypal/webhook` ||
      ![
        "CHECKOUT.ORDER.APPROVED",
        "PAYMENT.CAPTURE.COMPLETED",
        "PAYMENT.CAPTURE.REFUNDED",
        "PAYMENT.CAPTURE.REVERSED",
      ].every(e => events.includes(e) || events.includes("*"))
    )
      paymentFail("webhook_configuration");
  } else {
    // Read-only authenticated call; never create a payment to test a key.
    await nowRequest(config, "/merchant/coins");
  }
}

function decimalParts(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = String(value).match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match || match[1].length + (match[2]?.length ?? 0) > 60) return null;
  const exponent = Number(match[3] ?? 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 30) return null;
  return {
    units: BigInt(match[1] + (match[2] ?? "")),
    scale: (match[2]?.length ?? 0) - exponent,
  };
}
export function sufficientCryptoPayment(actual: unknown, expected: unknown) {
  const a = decimalParts(actual),
    b = decimalParts(expected);
  if (!a || !b || a.units <= BigInt(0) || b.units <= BigInt(0)) return false;
  const scale = Math.max(a.scale, b.scale);
  return (
    a.units * BigInt("1" + "0".repeat(scale - a.scale)) >=
    b.units * BigInt("1" + "0".repeat(scale - b.scale))
  );
}
export function exactUsd(value: unknown, cents: number) {
  const n = decimalParts(value);
  if (!n) return false;
  const scale = Math.max(n.scale, 2);
  return (
    n.units * BigInt("1" + "0".repeat(scale - n.scale)) ===
    BigInt(cents) * BigInt("1" + "0".repeat(scale - 2))
  );
}
export type VerifiedPayment = {
  state: "pending" | "paid" | "failed" | "review" | "refunded";
  gatewayStatus: string;
  transactionId?: string;
  reason?: string;
};
export function inspectPaypalOrder(
  order: any,
  payment: ProviderPayment,
  config: GatewayConfig
): VerifiedPayment {
  if (config.secrets.gateway !== "paypal") paymentFail("configuration");
  const unit = order.purchase_units?.[0];
  if (
    order.id !== payment.gatewayOrderId ||
    order.purchase_units?.length !== 1 ||
    unit?.custom_id !== payment.id ||
    unit?.payee?.merchant_id !== config.secrets.merchantId ||
    unit?.amount?.currency_code !== "USD" ||
    !exactUsd(unit?.amount?.value, payment.amountCents)
  )
    return {
      state: "review",
      gatewayStatus: "mismatch",
      reason: "payment_mismatch",
    };
  const captures = unit.payments?.captures;
  if (!captures?.length)
    return {
      state: "pending",
      gatewayStatus: String(order.status ?? "pending").slice(0, 40),
    };
  if (captures.length !== 1)
    return {
      state: "review",
      gatewayStatus: "multiple_captures",
      reason: "payment_mismatch",
    };
  const capture = captures[0];
  if (
    !/^[A-Z0-9]{8,64}$/.test(capture.id ?? "") ||
    capture.amount?.currency_code !== "USD" ||
    !exactUsd(capture.amount?.value, payment.amountCents)
  )
    return {
      state: "review",
      gatewayStatus: "mismatch",
      reason: "payment_mismatch",
    };
  if (["REFUNDED", "PARTIALLY_REFUNDED"].includes(capture.status))
    return {
      state: "refunded",
      gatewayStatus: capture.status,
      transactionId: capture.id,
    };
  return {
    state:
      capture.status === "COMPLETED" && order.status === "COMPLETED"
        ? "paid"
        : capture.status === "DECLINED" || capture.status === "FAILED"
          ? "failed"
          : "pending",
    gatewayStatus: String(capture.status).slice(0, 40),
    transactionId: capture.id,
  };
}
export async function checkPaypal(
  payment: ProviderPayment,
  config: GatewayConfig,
  captureApproved: boolean
) {
  if (
    !payment.gatewayOrderId ||
    !/^[A-Z0-9]{8,64}$/.test(payment.gatewayOrderId)
  )
    paymentFail("not_ready");
  let order = await paypalRequest(
    config,
    `/v2/checkout/orders/${payment.gatewayOrderId}`
  );
  const before = inspectPaypalOrder(order, payment, config);
  if (before.state === "review") return before;
  if (order.status === "APPROVED" && captureApproved) {
    try {
      order = await paypalRequest(
        config,
        `/v2/checkout/orders/${payment.gatewayOrderId}/capture`,
        "POST",
        {},
        payment.id.replace(/-/g, "")
      );
    } catch {
      // A timeout can follow a successful capture. Recover using the same order;
      // never create a replacement charge in response to an uncertain result.
      order = await paypalRequest(
        config,
        `/v2/checkout/orders/${payment.gatewayOrderId}`
      );
    }
  }
  return inspectPaypalOrder(order, payment, config);
}
export async function verifyPaypalWebhook(
  config: GatewayConfig,
  headers: IncomingHttpHeaders,
  event: unknown
) {
  if (config.secrets.gateway !== "paypal") return false;
  const names = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ] as const;
  if (
    names.some(
      n => typeof headers[n] !== "string" || String(headers[n]).length > 1000
    )
  )
    return false;
  const result = await paypalRequest(
    config,
    "/v1/notifications/verify-webhook-signature",
    "POST",
    {
      auth_algo: headers[names[0]],
      cert_url: headers[names[1]],
      transmission_id: headers[names[2]],
      transmission_sig: headers[names[3]],
      transmission_time: headers[names[4]],
      webhook_id: config.secrets.webhookId,
      webhook_event: event,
    }
  );
  return result.verification_status === "SUCCESS";
}
export function sortedJson(value: unknown): string {
  function sorted(v: any): any {
    if (Array.isArray(v)) return v.map(sorted);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map(k => [k, sorted(v[k])])
      );
    return v;
  }
  return JSON.stringify(sorted(value));
}
export function verifyNowSignature(
  body: unknown,
  signature: unknown,
  secret: string
) {
  if (typeof signature !== "string" || !/^[a-f0-9]{128}$/i.test(signature))
    return false;
  const expected = createHmac("sha512", secret)
    .update(sortedJson(body))
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function inspectNowPayment(
  remote: any,
  payment: ProviderPayment,
  paymentId: string
): VerifiedPayment {
  if (
    String(remote.payment_id) !== paymentId ||
    remote.order_id !== payment.id ||
    String(remote.invoice_id) !== payment.gatewayOrderId ||
    String(remote.price_currency).toUpperCase() !== "USD" ||
    !exactUsd(remote.price_amount, payment.amountCents)
  )
    return {
      state: "review",
      gatewayStatus: "mismatch",
      reason: "payment_mismatch",
    };
  const gatewayStatus = String(remote.payment_status ?? "unknown").slice(0, 40);
  if (gatewayStatus === "finished") {
    if (!sufficientCryptoPayment(remote.actually_paid, remote.pay_amount))
      return { state: "review", gatewayStatus, reason: "underpaid" };
    return { state: "paid", gatewayStatus, transactionId: paymentId };
  }
  return {
    state:
      gatewayStatus === "refunded"
        ? "refunded"
        : ["failed", "expired"].includes(gatewayStatus)
          ? "failed"
          : "pending",
    gatewayStatus,
    transactionId: paymentId,
  };
}
export async function checkNowPayment(
  payment: ProviderPayment,
  config: GatewayConfig,
  paymentId: string
) {
  if (!/^\d{1,40}$/.test(paymentId)) paymentFail("invalid_notification");
  return inspectNowPayment(
    await nowRequest(config, `/payment/${paymentId}`),
    payment,
    paymentId
  );
}
