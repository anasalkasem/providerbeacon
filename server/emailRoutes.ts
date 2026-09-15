import express, { type Express } from "express";
import { Resend } from "resend";
import { z } from "zod";
import { recordEmailEvent, unsubscribeMember } from "./emailDb";

const webhookEvent = z.object({
  type: z.enum([
    "email.sent",
    "email.delivered",
    "email.delivery_delayed",
    "email.failed",
    "email.bounced",
    "email.complained",
    "email.suppressed",
  ]),
  data: z.object({ email_id: z.string().min(1).max(100) }),
});
export function verifyEmailWebhook(
  body: Buffer,
  headers: { id: string; timestamp: string; signature: string },
  secret: string
) {
  if (!headers.id || headers.id.length > 160 || !Buffer.isBuffer(body))
    throw new Error("Invalid webhook");
  return webhookEvent.parse(
    new Resend("webhook-verification-only").webhooks.verify({
      payload: body.toString("utf8"),
      headers,
      webhookSecret: secret,
    })
  );
}
// Must be registered before express.json: signatures authenticate the exact raw body.
export function registerEmailRoutes(app: Express) {
  app.use(
    ["/verify-email", "/reset-password", "/forgot-password", "/unsubscribe"],
    (_req, res, next) => {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      next();
    }
  );
  app.post(
    "/api/webhooks/resend",
    express.raw({ type: "application/json", limit: "128kb" }),
    async (req, res) => {
      const secret = process.env.RESEND_WEBHOOK_SECRET;
      if (!secret) return res.status(503).json({ ok: false });
      let event;
      try {
        event = verifyEmailWebhook(
          req.body,
          {
            id: req.get("svix-id") ?? "",
            timestamp: req.get("svix-timestamp") ?? "",
            signature: req.get("svix-signature") ?? "",
          },
          secret
        );
      } catch {
        return res.status(400).json({ ok: false });
      }
      try {
        await recordEmailEvent(req.get("svix-id")!, event);
        return res.json({ ok: true });
      } catch {
        return res.status(503).json({ ok: false });
      }
    }
  );
  // RFC 8058 one-click POST; GET never changes preferences (mail scanners visit links).
  app.post(
    "/api/email/unsubscribe",
    express.urlencoded({ extended: false, limit: "2kb" }),
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (token.length > 160 || req.body?.["List-Unsubscribe"] !== "One-Click")
        return res.status(400).send("Invalid request");
      try {
        await unsubscribeMember(token);
        return res.status(200).send("Unsubscribed");
      } catch {
        return res.status(400).send("Invalid request");
      }
    }
  );
}
