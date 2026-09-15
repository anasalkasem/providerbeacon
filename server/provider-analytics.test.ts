import { once } from "node:events";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ record: vi.fn(async () => "counted") }));
vi.mock("./providerAnalyticsDb", () => ({ recordProviderEvent: state.record }));
import {
  analyticsRequestKeys,
  registerProviderAnalyticsRoutes,
} from "./providerAnalyticsRoutes";
import {
  analyticsPeriod,
  providerAnalyticsInput,
  providerEventInput,
} from "../shared/providerAnalytics";
import { STAFF_SESSION_COOKIE } from "./security";

const visitor = "8c20ce60-ae70-4710-9409-02d9e23f03f1";
const now = Date.parse("2026-09-15T12:00:00Z");
const request = (headers: Record<string, string> = {}) =>
  ({
    headers: {
      origin: "https://providerbeacon.com",
      "user-agent":
        "Mozilla/5.0 AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1",
      ...headers,
    },
    socket: { remoteAddress: "203.0.113.5" },
  }) as any;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_PEPPER", "analytics-test-secret");
  vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
  vi.stubEnv("RAILWAY_PROJECT_ID", "");
  vi.stubEnv("OAUTH_SERVER_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("provider analytics boundaries", () => {
  it("accepts only bounded event and report fields; UTC periods include today", () => {
    const input = { providerId: 1, kind: "view", visitorId: visitor };
    expect(providerEventInput.parse(input)).toEqual(input);
    for (const patch of [
      { url: "https://evil.example" },
      { count: 100 },
      { kind: "sale" },
      { providerId: -1 },
      { providerId: 2_147_483_648 },
      { visitorId: "email@example.com" },
    ])
      expect(providerEventInput.safeParse({ ...input, ...patch }).success).toBe(
        false
      );
    expect(providerAnalyticsInput.safeParse({ days: 365 }).success).toBe(false);
    expect(
      providerAnalyticsInput.safeParse({ days: 7, page: 10001 }).success
    ).toBe(false);
    expect(
      analyticsPeriod(7, Date.parse("2024-03-01T00:00:00Z"))
    ).toMatchObject({
      start: "2024-02-24",
      end: "2024-03-01",
      dates: expect.arrayContaining(["2024-02-29"]),
    });
    expect(analyticsPeriod(90, now).dates).toHaveLength(90);
  });
  it("uses daily scoped, secret digests and ignores spoofed forwarding headers", () => {
    const keys = analyticsRequestKeys(request(), visitor, now)!;
    expect(keys.visitorKey).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(keys)).not.toMatch(/203\.0\.113|8c20ce60|Mozilla/);
    expect(
      analyticsRequestKeys(
        request({ "x-forwarded-for": "192.0.2.3", "x-real-ip": "192.0.2.4" }),
        visitor,
        now
      )
    ).toEqual(keys);
    expect(
      analyticsRequestKeys(request(), visitor, now + 86_400_000)
    ).not.toEqual(keys);
    vi.stubEnv("RAILWAY_PROJECT_ID", "test-edge");
    const edge = analyticsRequestKeys(
      request({ "x-real-ip": "192.0.2.4" }),
      visitor,
      now
    )!;
    expect(edge.visitorKey).toBe(keys.visitorKey);
    expect(edge.clientKey).not.toBe(keys.clientKey);
    expect(
      analyticsRequestKeys(
        request({ "x-real-ip": "spoof, 192.0.2.4" }),
        visitor,
        now
      )
    ).toEqual(keys);
  });
  it("filters foreign origins, staff, privacy preferences, bots and prefetches before storage", () => {
    expect(analyticsRequestKeys(request(), visitor, now)).not.toBeNull();
    expect(
      analyticsRequestKeys(
        request({ origin: "https://www.providerbeacon.com" }),
        visitor,
        now
      )
    ).not.toBeNull();
    for (const headers of [
      { origin: "https://evil.example" },
      { origin: "" },
      { "sec-fetch-site": "cross-site" },
      { dnt: "1" },
      { "sec-gpc": "1" },
      { cookie: `${STAFF_SESSION_COOKIE}=test-staff-session` },
      { purpose: "prefetch" },
      { "sec-purpose": "prefetch;prerender" },
      { "user-agent": "Googlebot" },
      { "user-agent": "TelegramBot" },
      { "user-agent": "HeadlessChrome" },
      { "user-agent": "curl/8.0" },
      { "user-agent": "" },
    ])
      expect(
        analyticsRequestKeys(request(headers), visitor, now),
        JSON.stringify(headers)
      ).toBeNull();
    vi.stubEnv("OAUTH_SERVER_URL", "https://staff.example");
    expect(
      analyticsRequestKeys(
        request({ cookie: "app_session_id=test" }),
        visitor,
        now
      )
    ).toBeNull();
    vi.stubEnv("AUTH_PEPPER", "");
    expect(analyticsRequestKeys(request(), visitor, now)).toBeNull();
  });
  it("records POSTs only, bounds the body, and keeps failures non-blocking without returning visitor data", async () => {
    const app = express();
    registerProviderAnalyticsRoutes(app);
    app.use((error: any, _req: any, res: any, _next: any) =>
      res.status(error.status ?? 500).end()
    );
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const url = `http://127.0.0.1:${(server.address() as any).port}/api/provider-analytics`;
    const send = (body: object) =>
      fetch(url, {
        method: "POST",
        headers: { ...request().headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    try {
      const event = { providerId: 1, kind: "website", visitorId: visitor };
      expect((await fetch(url)).status).toBe(404);
      expect(
        (await send({ ...event, url: "https://evil.example" })).status
      ).toBe(204);
      expect(state.record).not.toHaveBeenCalled();
      const response = await send(event);
      expect(response.status).toBe(204);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).toBe("");
      expect(state.record).toHaveBeenCalledTimes(1);
      expect(state.record.mock.calls[0][0]).toEqual(event);
      expect((await send({ ...event, excess: "x".repeat(2000) })).status).toBe(
        413
      );
      expect(state.record).toHaveBeenCalledTimes(1);
      vi.spyOn(console, "warn").mockImplementation(() => {});
      state.record.mockRejectedValueOnce(new Error("private database detail"));
      expect((await send(event)).status).toBe(204);
      expect(console.warn).toHaveBeenCalledWith(
        "[Provider analytics] Event could not be recorded"
      );
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
