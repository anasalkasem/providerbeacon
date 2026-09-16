import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  staff: vi.fn(),
  budget: vi.fn(),
  verify: vi.fn(),
  disable: vi.fn(),
}));
vi.mock("./memberDb", () => ({
  loginMember: mocks.member,
  reserveMemberRequests: mocks.budget,
}));
vi.mock("./authDb", () => ({
  loginWithPassword: mocks.staff,
  verifyMfaSession: mocks.verify,
  disableMfa: mocks.disable,
}));
import { authRouter } from "./routers/auth";
import { MemberAuthError, MEMBER_SESSION_MS } from "./memberSecurity";
import {
  PENDING_MFA_MINUTES,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_HOURS,
} from "./security";
import { safeStaffNext } from "../shared/signIn";

const credentials = {
  email: "person@example.com",
  password: "existing password",
};
function caller(
  overrides: Record<string, unknown> = {},
  origin = "https://providerbeacon.com"
) {
  const res = { cookie: vi.fn(), clearCookie: vi.fn(), setHeader: vi.fn() };
  const req = {
    protocol: "https",
    headers: { origin },
    socket: { remoteAddress: "127.0.0.1" },
  };
  return {
    res,
    api: authRouter.createCaller({ req, res, user: null, ...overrides } as any),
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_PEPPER", "local-sign-in-test-pepper");
  vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
  mocks.member.mockRejectedValue(new MemberAuthError("invalid_credentials"));
  mocks.staff.mockResolvedValue({ token: "staff-secret", mfaRequired: false });
});
afterEach(() => vi.unstubAllEnvs());

describe("public password sign-in", () => {
  it("accepts existing staff credentials and returns only the staff session cookie", async () => {
    const { api, res } = caller();
    expect(
      await api.signIn({ ...credentials, email: "  PERSON@example.com " })
    ).toEqual({ kind: "staff", mfaRequired: false });
    expect(mocks.staff).toHaveBeenCalledWith(
      expect.objectContaining(credentials)
    );
    expect(res.cookie).toHaveBeenCalledOnce();
    expect(res.cookie).toHaveBeenCalledWith(
      STAFF_SESSION_COOKIE,
      "staff-secret",
      expect.objectContaining({
        maxAge: STAFF_SESSION_HOURS * 3600000,
        httpOnly: true,
        secure: true,
      })
    );
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("keeps valid member credentials separate without incrementing a same-email staff lockout", async () => {
    const member = { id: 3, name: "Member", email: credentials.email };
    mocks.member.mockResolvedValue({ token: "member-secret", member });
    const { api, res } = caller();
    expect(await api.signIn(credentials)).toEqual({ kind: "member", member });
    expect(mocks.staff).not.toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledOnce();
    expect(res.cookie).toHaveBeenCalledWith(
      "__Host-pb_member_session",
      "member-secret",
      expect.objectContaining({ maxAge: MEMBER_SESSION_MS })
    );
  });
  it("issues a short pending cookie and requires the existing MFA verification path", async () => {
    mocks.staff.mockResolvedValue({
      token: "pending-secret",
      mfaRequired: true,
    });
    const { api, res } = caller();
    expect(await api.signIn(credentials)).toEqual({
      kind: "staff",
      mfaRequired: true,
    });
    expect(res.cookie).toHaveBeenCalledWith(
      STAFF_SESSION_COOKIE,
      "pending-secret",
      expect.objectContaining({ maxAge: PENDING_MFA_MINUTES * 60000 })
    );
    const pending = caller({ staffSessionToken: "pending-secret" });
    mocks.verify.mockRejectedValueOnce(
      new Error("Verification code is invalid")
    );
    await expect(
      pending.api.verifyMfa({ code: "123456" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(pending.res.cookie).not.toHaveBeenCalled();
    mocks.verify.mockResolvedValue({ success: true });
    await pending.api.verifyMfa({ code: "654321" });
    expect(pending.res.cookie).toHaveBeenCalledWith(
      STAFF_SESSION_COOKIE,
      "pending-secret",
      expect.objectContaining({ maxAge: STAFF_SESSION_HOURS * 3600000 })
    );
  });
  it.each(["Email or password is incorrect", "Account access is suspended"])(
    "does not expose staff identity on failure: %s",
    async message => {
      mocks.staff.mockRejectedValue(new Error(message));
      const { api, res } = caller();
      await expect(api.signIn(credentials)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "member_invalid_credentials",
      });
      expect(res.cookie).not.toHaveBeenCalled();
    }
  );
  it("preserves locked accounts and shared request limits", async () => {
    mocks.staff.mockRejectedValue(
      new Error("Account temporarily locked. Try again later")
    );
    await expect(caller().api.signIn(credentials)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    mocks.budget.mockRejectedValue(new MemberAuthError("rate_limited"));
    mocks.staff.mockClear();
    mocks.member.mockClear();
    await expect(caller().api.signIn(credentials)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    expect(mocks.member).not.toHaveBeenCalled();
    expect(mocks.staff).not.toHaveBeenCalled();
  });
  it("fails closed on an infrastructure error instead of trying another identity system", async () => {
    mocks.member.mockRejectedValue(new Error("private database details"));
    await expect(caller().api.signIn(credentials)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "member_unavailable",
    });
    expect(mocks.staff).not.toHaveBeenCalled();
  });
  it("checks origin and input boundaries before trying either password", async () => {
    for (const origin of ["https://evil.example", "null", ""]) {
      const { api } = caller({}, origin);
      await expect(api.signIn(credentials)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(api.login(credentials)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    await expect(
      caller().api.signIn({ ...credentials, role: "owner" } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.member).not.toHaveBeenCalled();
    expect(mocks.staff).not.toHaveBeenCalled();
  });
});

describe("turning off the authenticator", () => {
  const input = {
    currentPassword: "current password",
    code: "123456",
    confirm: true as const,
  };
  const staff = {
    user: { id: 7 },
    authMode: "staff",
    staffSessionToken: "active-staff-session",
  };
  it("requires a staff session, explicit confirmation and proof", async () => {
    await expect(caller().api.security.disableMfa(input)).rejects.toMatchObject(
      { code: "UNAUTHORIZED" }
    );
    await expect(
      caller({ user: { id: 7 }, authMode: "oauth" }).api.security.disableMfa(
        input
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(staff).api.security.disableMfa({ ...input, confirm: false } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(staff).api.security.disableMfa({ ...input, userId: 9 } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.disable).not.toHaveBeenCalled();
    mocks.disable.mockResolvedValue({ success: true });
    await caller(staff).api.security.disableMfa(input);
    expect(mocks.disable).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        currentSessionToken: "active-staff-session",
        currentPassword: input.currentPassword,
        code: input.code,
      })
    );
  });
  it("checks origin and throttles factor guesses before changing security", async () => {
    await expect(
      caller(staff, "https://evil.example").api.security.disableMfa(input)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    mocks.budget.mockRejectedValue(new MemberAuthError("rate_limited"));
    await expect(
      caller(staff).api.security.disableMfa(input)
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(mocks.disable).not.toHaveBeenCalled();
  });
});

it("keeps staff return paths local and avoids member-account and sign-in loops", () => {
  for (const path of [
    undefined,
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/admin/../../sign-in",
    "/account",
    "/account/provider",
    "/login",
    "/admin\nanything",
  ])
    expect(safeStaffNext(path)).toBe("/admin");
  expect(safeStaffNext("/admin/security?tab=mfa")).toBe(
    "/admin/security?tab=mfa"
  );
  expect(safeStaffNext("/providers?q=real")).toBe("/providers?q=real");
});
