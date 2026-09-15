import express, { type Express } from "express";
import { z } from "zod";
import { reserveMemberRequests } from "./memberDb";
import { memberClientKey } from "./memberSecurity";
import {
  checkNowPayment,
  checkPaypal,
  verifyNowSignature,
  verifyPaypalWebhook,
} from "./paymentGateways";
import {
  paymentById,
  paymentByGatewayOrder,
  paymentByTransaction,
  paymentConfig,
  recordVerifiedPayment,
  paypalCaptureAllowed,
} from "./providerPaymentsDb";

function refundCaptureId(resource: any) {
  const explicit =
    resource?.supplementary_data?.related_ids?.capture_id ??
    resource?.capture_id;
  if (typeof explicit === "string" && /^[A-Z0-9]{8,64}$/.test(explicit))
    return explicit;
  // Extract an identifier only. Never request a URL supplied by a webhook.
  const up = Array.isArray(resource?.links)
    ? resource.links.find((l: any) => l.rel === "up")?.href
    : null;
  return typeof up === "string"
    ? up.match(
        /^https:\/\/api(?:-m)?\.paypal\.com\/v2\/payments\/captures\/([A-Z0-9]{8,64})$/
      )?.[1]
    : undefined;
}
export function registerPaymentRoutes(app: Express) {
  for (const gateway of ["paypal", "nowpayments"] as const) {
    app.post(
      `/api/payments/${gateway}/webhook`,
      express.json({ limit: "64kb" }),
      async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        try {
          if (
            !req.is("application/json") ||
            !req.body ||
            Array.isArray(req.body)
          )
            return res.status(400).json({ ok: false });
          await reserveMemberRequests([
            {
              key: `payment-webhook:${gateway}:${memberClientKey(req)}`,
              limit: 120,
              windowMs: 60_000,
            },
          ]);
          if (gateway === "nowpayments") {
            const id = z.string().uuid().safeParse(req.body.order_id);
            const external = String(req.body.payment_id ?? "");
            if (!id.success || !/^\d{1,40}$/.test(external))
              return res.status(400).json({ ok: false });
            const payment = await paymentById(id.data);
            if (
              !payment ||
              payment.gateway !== "nowpayments" ||
              payment.environment !== "live"
            )
              return res.status(200).json({ ok: true });
            const config = await paymentConfig(payment.credentialId);
            if (
              config.secrets.gateway !== "nowpayments" ||
              !verifyNowSignature(
                req.body,
                req.headers["x-nowpayments-sig"],
                config.secrets.ipnSecret
              )
            )
              return res.status(401).json({ ok: false });
            if (!payment.gatewayOrderId)
              return res.status(503).json({ ok: false });
            await recordVerifiedPayment(
              payment.id,
              await checkNowPayment(payment, config, external)
            );
          } else {
            const event = req.body;
            if (typeof event.event_type !== "string")
              return res.status(400).json({ ok: false });
            const supported = [
              "CHECKOUT.ORDER.APPROVED",
              "PAYMENT.CAPTURE.COMPLETED",
              "PAYMENT.CAPTURE.PENDING",
              "PAYMENT.CAPTURE.DENIED",
              "PAYMENT.CAPTURE.REFUNDED",
              "PAYMENT.CAPTURE.REVERSED",
            ];
            if (!supported.includes(event.event_type))
              return res.status(200).json({ ok: true });
            const orderId =
              event.event_type === "CHECKOUT.ORDER.APPROVED"
                ? event.resource?.id
                : event.resource?.supplementary_data?.related_ids?.order_id;
            const captureId =
              event.event_type === "PAYMENT.CAPTURE.REFUNDED"
                ? refundCaptureId(event.resource)
                : event.resource?.id;
            const payment =
              typeof orderId === "string" && /^[A-Z0-9]{8,64}$/.test(orderId)
                ? await paymentByGatewayOrder("paypal", orderId)
                : typeof captureId === "string" &&
                    /^[A-Z0-9]{8,64}$/.test(captureId)
                  ? await paymentByTransaction("paypal", captureId)
                  : null;
            if (!payment) return res.status(200).json({ ok: true });
            const config = await paymentConfig(payment.credentialId);
            if (!(await verifyPaypalWebhook(config, req.headers, event)))
              return res.status(401).json({ ok: false });
            if (
              ["PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"].includes(
                event.event_type
              )
            ) {
              if (captureId === payment.transactionId)
                await recordVerifiedPayment(payment.id, {
                  state: "refunded",
                  gatewayStatus: event.event_type.endsWith("REVERSED")
                    ? "REVERSED"
                    : "REFUNDED",
                  transactionId: captureId,
                });
            } else {
              await recordVerifiedPayment(
                payment.id,
                await checkPaypal(
                  payment,
                  config,
                  await paypalCaptureAllowed(payment)
                )
              );
            }
          }
          return res.status(200).json({ ok: true });
        } catch {
          // A retryable response preserves recovery; no payer data or raw bodies in logs.
          return res.status(503).json({ ok: false });
        }
      }
    );
  }
}
