import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { once } from "node:events";
import { customerEmailInput } from "../shared/email";
import { memberRegistration } from "../shared/memberAuth";
import {
  mailConfiguration,
  nextEmailStatus,
  unsubscribeToken,
  validEmailSignature,
} from "./emailDb";
import { renderEmail } from "./emailTemplates";
import { registerEmailRoutes, verifyEmailWebhook } from "./emailRoutes";
import { appRouter } from "./routers";
import { rolePermissions } from "./authorization";

beforeEach(() => {
  vi.stubEnv("AUTH_PEPPER", "email-unit-test-pepper");
  vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("branded email and opt-in boundaries", () => {
  it.each(["ar", "en", "es", "hi", "zh"])(
    "renders %s with safe HTML, readable text, absolute actions and no tracking",
    locale => {
      const value = renderEmail({
        kind: "welcome",
        locale,
        name: '<img src=x onerror="alert(1)">',
        url: "https://providerbeacon.com/services",
      });
      expect(value.html).toContain(`lang="${locale}"`);
      expect(value.html).toContain(`dir="${locale === "ar" ? "rtl" : "ltr"}"`);
      expect(value.html).toContain("&lt;img");
      expect(value.html).not.toMatch(/<img|<script|javascript:|<form/);
      expect(value.text).toContain("https://providerbeacon.com/services");
      expect(value.subject).not.toMatch(/[\r\n]/);
    }
  );
  it("escapes customer prose instead of accepting HTML and confines links to the site", () => {
    expect(() =>
      renderEmail({
        kind: "reset",
        name: "User",
        locale: "en",
        url: "https://attacker.example/",
      })
    ).toThrow();
    const mail = renderEmail({
      kind: "customer",
      name: "User",
      locale: "en",
      url: "https://providerbeacon.com/services",
      subject: "News",
      body: '<script>alert("x")</script>',
      unsubscribeUrl: "https://providerbeacon.com/unsubscribe#token=demo",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.text).toContain("Unsubscribe");
    expect(
      customerEmailInput.safeParse({
        memberId: 1,
        locale: "en",
        subject: "Hello\r\nBcc: x@example.com",
        body: "Safe message body",
        action: "/services",
      }).success
    ).toBe(false);
  });
  it("does not subscribe registrations by default or let request fields grant privileges", () => {
    const input = {
      name: "Example",
      email: "user@example.com",
      password: "a sufficiently long password",
    };
    expect(memberRegistration.parse(input).marketingOptIn).toBe(false);
    expect(
      memberRegistration.safeParse({ ...input, emailVerified: true }).success
    ).toBe(false);
    expect(rolePermissions.auditor).not.toContain("emails.read");
    expect(rolePermissions.operations_manager).not.toContain("emails.send");
  });
  it("requires all sender settings and explicit activation", () => {
    vi.stubEnv("MAIL_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(mailConfiguration().enabled).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "local-test");
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "local-test");
    expect(mailConfiguration().enabled).toBe(true);
    vi.stubEnv("MAIL_FROM", "Attacker <outside@example.com>");
    expect(mailConfiguration().enabled).toBe(false);
  });
  it("binds unsubscribe links to the account and email, with a separate signature purpose", () => {
    const token = unsubscribeToken({ id: 42, email: "member@example.com" });
    const [id, hash, signature] = token.split(".");
    expect(validEmailSignature(`${id}.${hash}`, "unsubscribe", signature)).toBe(
      true
    );
    expect(validEmailSignature(`43.${hash}`, "unsubscribe", signature)).toBe(
      false
    );
    expect(validEmailSignature(`${id}.${hash}`, "preview", signature)).toBe(
      false
    );
  });
  it("does not report acceptance as delivery or regress delivery after reordered events", () => {
    expect(nextEmailStatus("queued", "email.sent")).toBe("accepted");
    expect(nextEmailStatus("accepted", "email.delivered")).toBe("delivered");
    expect(nextEmailStatus("delivered", "email.sent")).toBe("delivered");
    expect(nextEmailStatus("bounced", "email.delivered")).toBe("bounced");
    expect(nextEmailStatus("delivered", "email.complained")).toBe("complained");
  });
  it("requires staff identity for customer access and same-origin POSTs for member email operations", async () => {
    const ctx = {
      user: null,
      req: { headers: { origin: "https://attacker.example" } },
      res: { setHeader: vi.fn() },
    } as any;
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.email.recipients({ q: "" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller.member.forgotPassword({ email: "member@example.com" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.member.verifyEmail({ token: "a".repeat(43) })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
describe("authenticated Resend events", () => {
  const key = Buffer.alloc(32, 19),
    secret = `whsec_${key.toString("base64")}`;
  const payload = Buffer.from(
    JSON.stringify({
      type: "email.delivered",
      data: { email_id: "test-provider-id" },
    })
  );
  const headers = (
    body = payload,
    timestamp = Math.floor(Date.now() / 1000).toString()
  ) => ({
    id: "msg_local_test",
    timestamp,
    signature: `v1,${createHmac("sha256", key).update(`msg_local_test.${timestamp}.${body.toString()}`).digest("base64")}`,
  });
  it("validates the raw body and rejects altered, unsigned and expired events", () => {
    expect(verifyEmailWebhook(payload, headers(), secret).type).toBe(
      "email.delivered"
    );
    expect(() =>
      verifyEmailWebhook(
        Buffer.from(payload.toString() + " "),
        headers(),
        secret
      )
    ).toThrow();
    expect(() =>
      verifyEmailWebhook(
        payload,
        { ...headers(), signature: "v1,invalid" },
        secret
      )
    ).toThrow();
    expect(() =>
      verifyEmailWebhook(
        payload,
        headers(payload, (Math.floor(Date.now() / 1000) - 601).toString()),
        secret
      )
    ).toThrow();
    expect(() =>
      verifyEmailWebhook(
        payload,
        headers(payload, (Math.floor(Date.now() / 1000) + 601).toString()),
        secret
      )
    ).toThrow();
  });
  it("does not unsubscribe on GET and marks token pages private", async () => {
    const app = express();
    registerEmailRoutes(app);
    app.get("/unsubscribe", (_req, res) => res.send("Confirm"));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const port = (server.address() as { port: number }).port;
      const get = await fetch(
        `http://127.0.0.1:${port}/api/email/unsubscribe?token=invalid`
      );
      expect(get.status).toBe(404);
      const page = await fetch(`http://127.0.0.1:${port}/unsubscribe`);
      expect(page.headers.get("referrer-policy")).toBe("no-referrer");
      expect(page.headers.get("x-robots-tag")).toContain("noindex");
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
