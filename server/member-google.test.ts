import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import {
  exchangeGoogleCode,
  googleAuthorizationUrl,
  googleAvailable,
  googleCallback,
  verifyGoogleIdentity,
} from "./memberGoogle";

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
beforeAll(async () => {
  keys = await generateKeyPair("RS256");
});
beforeEach(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
  vi.stubEnv("VAULT_MASTER_KEY", Buffer.alloc(32, 11).toString("base64url"));
  vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function token(
  overrides: Record<string, unknown> = {},
  omit: string[] = []
) {
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = {
    iss: "https://accounts.google.com",
    aud: "test-client",
    sub: "Google-CaseSensitive-ID",
    nonce: "nonce-value",
    email: "Member@example.com",
    email_verified: true,
    name: "Member Name",
    iat: now,
    exp: now + 300,
    ...overrides,
  };
  for (const key of omit) delete claims[key];
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256" })
    .sign(keys.privateKey);
}
describe("Google OpenID Connect verification", () => {
  it("verifies signed identity and normalizes email without using it as the identity key", async () => {
    expect(
      await verifyGoogleIdentity(
        await token(),
        "nonce-value",
        "test-client",
        keys.publicKey
      )
    ).toEqual({
      subject: "Google-CaseSensitive-ID",
      email: "member@example.com",
      name: "Member Name",
    });
  });
  it.each([
    { iss: "https://evil.example" },
    { aud: "other-client" },
    { nonce: "wrong" },
    { exp: 1 },
    { iat: 1 },
    { email_verified: false },
    { email_verified: "false" },
    { email: "not-email" },
    { azp: "other-client" },
    { aud: ["test-client", "other-client"] },
    { sub: "" },
  ])("rejects invalid claims %j", async claims => {
    await expect(
      verifyGoogleIdentity(
        await token(claims),
        "nonce-value",
        "test-client",
        keys.publicKey
      )
    ).rejects.toThrow();
  });
  it("requires expiry and rejects a signature from a different key", async () => {
    await expect(
      verifyGoogleIdentity(
        await token({}, ["exp"]),
        "nonce-value",
        "test-client",
        keys.publicKey
      )
    ).rejects.toThrow();
    const other = await generateKeyPair("RS256");
    await expect(
      verifyGoogleIdentity(
        await token(),
        "nonce-value",
        "test-client",
        other.publicKey
      )
    ).rejects.toThrow();
  });
  it("uses PKCE, state, nonce and only identity scopes with an exact callback", () => {
    const url = new URL(
      googleAuthorizationUrl({
        state: "state-value",
        nonce: "nonce-value",
        verifier: "long-random-verifier",
      })
    );
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://providerbeacon.com/api/auth/google/callback"
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toHaveLength(43);
    expect(url.searchParams.get("nonce")).toBe("nonce-value");
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(url.searchParams.has("access_type")).toBe(false);
  });
  it("reports missing configuration honestly", () => {
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(googleAvailable()).toBe(false);
    expect(() =>
      googleAuthorizationUrl({ state: "s", nonce: "n", verifier: "v" })
    ).toThrow("unavailable");
  });
  it("rejects missing state without exchanging a code or leaking the query", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const res = { setHeader: vi.fn(), redirect: vi.fn(), clearCookie: vi.fn() };
    await googleCallback(
      { query: { code: "sensitive-code" }, headers: {} } as any,
      res as any
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      303,
      "https://providerbeacon.com/sign-in?lang=en&error=invalid_state"
    );
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("bounds token responses and disallows token-endpoint redirects", async () => {
    const fetcher = vi.fn(async () => new Response("x".repeat(33000)));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      exchangeGoogleCode("authorization-code", {
        nonce: "n",
        verifier: "v",
        next: "/account",
        locale: "en",
      })
    ).rejects.toThrow("google_failed");
    expect(fetcher).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST", redirect: "error" })
    );
    const request = (fetcher.mock.calls[0] as any)[1];
    expect(request.body.get("code_verifier")).toBe("v");
    expect(request.body.get("client_secret")).toBe("test-secret");
  });
});
