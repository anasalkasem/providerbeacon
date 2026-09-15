import { COOKIE_NAME } from "../shared/const";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import express, { type Express, type Request } from "express";
import { parse } from "cookie";
import { analyticsDate, providerEventInput } from "../shared/providerAnalytics";
import { memberAuthOrigin } from "./memberSecurity";
import { STAFF_SESSION_COOKIE } from "./security";
import { recordProviderEvent } from "./providerAnalyticsDb";

export function analyticsRequestKeys(
  req: Pick<Request, "headers" | "socket">,
  visitorId: string,
  now = Date.now()
) {
  const secret = process.env.AUTH_PEPPER;
  const origin = req.headers.origin;
  const canonical = memberAuthOrigin();
  const allowed = [canonical];
  if (
    ["https://providerbeacon.com", "https://www.providerbeacon.com"].includes(
      canonical
    )
  )
    allowed.push(
      "https://providerbeacon.com",
      "https://www.providerbeacon.com"
    );
  if (
    !secret ||
    !origin ||
    !allowed.includes(origin) ||
    req.headers["sec-fetch-site"] === "cross-site"
  )
    return null;
  if (
    req.headers.dnt === "1" ||
    req.headers["sec-gpc"] === "1" ||
    /prefetch|prerender/i.test(
      `${req.headers["sec-purpose"] ?? ""} ${req.headers.purpose ?? ""}`
    )
  )
    return null;
  const cookies = parse(req.headers.cookie ?? "");
  if (
    cookies[STAFF_SESSION_COOKIE] ||
    (process.env.OAUTH_SERVER_URL && cookies[COOKIE_NAME])
  )
    return null;
  const agent = req.headers["user-agent"] ?? "";
  if (
    !agent ||
    agent.length > 1000 ||
    /bot|crawler|spider|headless|preview|facebookexternalhit|curl|wget|python|lighthouse|pagespeed|selenium|playwright|puppeteer|monitor|uptime/i.test(
      agent
    )
  )
    return null;
  // Match the application's trusted Railway edge policy; never trust arbitrary X-Forwarded-For.
  const edge = process.env.RAILWAY_PROJECT_ID
    ? req.headers["x-real-ip"]
    : undefined;
  const address =
    typeof edge === "string" && isIP(edge.trim())
      ? edge.trim()
      : req.socket?.remoteAddress;
  if (!address || !isIP(address)) return null;
  const digest = (kind: string, value: string) =>
    createHmac("sha256", secret)
      .update(`provider-analytics:v1:${analyticsDate(now)}:${kind}:${value}`)
      .digest("hex");
  return {
    visitorKey: digest("visitor", visitorId),
    clientKey: digest("limit", address),
  };
}

export function registerProviderAnalyticsRoutes(app: Express) {
  // Register before the application's large upload parser. Never reflect event payloads.
  app.post(
    "/api/provider-analytics",
    express.json({ limit: "1kb" }),
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      try {
        const input = providerEventInput.safeParse(req.body);
        if (input.success) {
          const now = Date.now();
          const keys = analyticsRequestKeys(req, input.data.visitorId, now);
          if (keys) await recordProviderEvent(input.data, keys, now);
        }
      } catch {
        // Analytics is best effort; it must never break a provider page or outbound navigation.
        console.warn("[Provider analytics] Event could not be recorded");
      }
      res.status(204).end();
    }
  );
}
