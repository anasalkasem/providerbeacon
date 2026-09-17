import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memberRegistration, safeMemberNext } from "../shared/memberAuth";
import {
  assertMemberOrigin,
  checkMemberPassword,
  hashMemberPassword,
  memberAuthOrigin,
  memberClientKey,
  memberCookie,
  memberCookieName,
  memberCookieOptions,
  memberEmailKey,
  memberRecoveryHash,
  newMemberRecoveryCode,
  publicMemberError,
} from "./memberSecurity";
import { appRouter } from "./routers";
import { registerMemberRoutes } from "./memberGoogle";

describe("member authentication boundaries", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
    vi.stubEnv("AUTH_PEPPER", "unit-test-only-pepper");
    vi.stubEnv("RAILWAY_PROJECT_ID", "");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("accepts long Unicode passphrases, normalizes email and rejects role injection", () => {
    const value = {
      name: "  Anas  ",
      email: "  ANAS@example.com ",
      password: "كلمة مرور عربية طويلة وآمنة",
    };
    expect(memberRegistration.parse(value)).toMatchObject({
      name: "Anas",
      email: "anas@example.com",
    });
    expect(
      memberRegistration.safeParse({ ...value, role: "admin" }).success
    ).toBe(false);
    expect(
      memberRegistration.safeParse({ ...value, password: "Short123!" }).success
    ).toBe(false);
  });
  it("restricts return destinations to public pages", () => {
    for (const path of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/admin",
      "/login",
      "/account/../../admin",
      "/account\nLocation:evil",
      "javascript:alert(1)",
    ])
      expect(safeMemberNext(path)).toBe("/account");
    expect(
      safeMemberNext("/compare?services=service-1,service-2#ignored")
    ).toBe("/compare?services=service-1,service-2");
    expect(safeMemberNext("/services?q=views")).toBe("/services?q=views");
    expect(safeMemberNext("/groups")).toBe("/groups");
    expect(safeMemberNext("/account/groups")).toBe("/account/groups");
    expect(safeMemberNext("/providers/real-provider#visitor-ratings")).toBe(
      "/providers/real-provider#visitor-ratings"
    );
    expect(safeMemberNext("/providers/real-provider#untrusted")).toBe(
      "/providers/real-provider"
    );
    expect(safeMemberNext("/account#visitor-ratings")).toBe("/account");
  });
  it("requires the exact canonical origin for every mutation including anonymous login", async () => {
    for (const origin of [
      undefined,
      "null",
      "https://evil.example",
      "https://providerbeacon.com.evil.example",
      "https://www.providerbeacon.com",
    ]) {
      expect(() => assertMemberOrigin({ headers: { origin } })).toThrow(
        "member_origin"
      );
      const caller = appRouter.createCaller({
        user: null,
        req: { headers: { origin } } as any,
        res: { setHeader: vi.fn() } as any,
      });
      await expect(
        caller.member.login({
          email: "test@example.com",
          password: "irrelevant",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN", message: "member_origin" });
    }
    expect(() =>
      assertMemberOrigin({
        headers: {
          origin: "https://providerbeacon.com",
          "sec-fetch-site": "same-origin",
        },
      })
    ).not.toThrow();
  });
  it("uses an independent host-only secure HttpOnly cookie", () => {
    expect(memberCookieName("session")).toBe("__Host-pb_member_session");
    expect(memberCookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    expect(
      memberCookie(
        { headers: { cookie: "__Host-pb_staff_session=" + "x".repeat(43) } },
        "session"
      )
    ).toBeUndefined();
    expect(
      memberCookie(
        { headers: { cookie: "__Host-pb_member_session=invalid" } },
        "session"
      )
    ).toBeUndefined();
    vi.stubEnv("PUBLIC_APP_URL", "http://providerbeacon.com");
    expect(() => memberAuthOrigin()).toThrow();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PUBLIC_APP_URL", "http://localhost:3000");
    expect(memberCookieOptions().secure).toBe(false);
  });
  it("keeps public pages canonical without redirecting staff pages or module assets", () => {
    let middleware: any;
    registerMemberRoutes({
      use: (fn: any) => {
        middleware = fn;
      },
      get: vi.fn(),
    } as any);
    for (const path of ["/sign-in", "/account", "/services", "/compare"]) {
      const res = { redirect: vi.fn() },
        next = vi.fn();
      middleware(
        {
          method: "GET",
          hostname: "www.providerbeacon.com",
          path,
          originalUrl: path + "?lang=ar",
        },
        res,
        next
      );
      expect(res.redirect).toHaveBeenCalledWith(
        308,
        "https://providerbeacon.com" + path + "?lang=ar"
      );
      expect(next).not.toHaveBeenCalled();
    }
    for (const path of [
      "/login",
      "/admin",
      "/admin/security",
      "/assets/index.js",
      "/api/trpc/auth.me",
      "/health",
    ]) {
      const next = vi.fn();
      middleware(
        { method: "GET", hostname: "www.providerbeacon.com", path },
        { redirect: vi.fn() },
        next
      );
      expect(next).toHaveBeenCalledOnce();
    }
  });
  it("hashes rate-limit identifiers and ignores untrusted forwarding headers", () => {
    const req = (headers: any) =>
      ({ headers, socket: { remoteAddress: "127.0.0.1" } }) as any;
    const base = memberClientKey(req({}));
    expect(
      memberClientKey(
        req({ "x-real-ip": "8.8.8.8", "x-forwarded-for": "6.6.6.6" })
      )
    ).toBe(base);
    vi.stubEnv("RAILWAY_PROJECT_ID", "test-project");
    expect(memberClientKey(req({ "x-real-ip": "8.8.8.8" }))).not.toBe(base);
    expect(memberClientKey(req({ "x-real-ip": "8.8.8.8, 6.6.6.6" }))).toBe(
      base
    );
    expect(memberEmailKey("a@example.com")).toMatch(/^[a-f0-9]{64}$/);
  });
  it("stores salted hashes and makes missing accounts pay the password verification cost", async () => {
    const password = "a long test passphrase";
    const [a, b] = await Promise.all([
      hashMemberPassword(password),
      hashMemberPassword(password),
    ]);
    expect(a).not.toBe(b);
    expect(a).not.toContain(password);
    expect(await checkMemberPassword(password, a)).toBe(true);
    expect(await checkMemberPassword("wrong", a)).toBe(false);
    expect(await checkMemberPassword(password, null)).toBe(false);
  });
  it("creates high-entropy recovery codes and redacts unknown internal errors", () => {
    const code = newMemberRecoveryCode();
    expect(code).toMatch(/^[A-F0-9]{8}(?:-[A-F0-9]{8}){5}$/);
    expect(memberRecoveryHash(code)).toBe(
      memberRecoveryHash(code.toLowerCase().replace(/-/g, " "))
    );
    expect(memberRecoveryHash("invalid")).toBeNull();
    expect(publicMemberError(new Error("SQL password secret"))).toMatchObject({
      message: "member_unavailable",
      code: "SERVICE_UNAVAILABLE",
    });
  });
});
