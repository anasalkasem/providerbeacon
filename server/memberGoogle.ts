import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Express, Request, Response } from "express";
import { memberEmail, safeMemberNext } from "../shared/memberAuth";
import {
  consumeGoogleFlow,
  loginGoogleMember,
  saveGoogleFlow,
  type GoogleFlow,
} from "./memberDb";
import {
  clearMemberCookie,
  MemberAuthError,
  MEMBER_OAUTH_MS,
  memberAuthOrigin,
  memberCookie,
  memberCookieName,
  memberCookieOptions,
  setMemberCookie,
} from "./memberSecurity";
import { randomToken } from "./security";

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: 5000 }
);
export const googleRedirectUri = () =>
  `${memberAuthOrigin()}/api/auth/google/callback`;
export function googleAvailable() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.VAULT_MASTER_KEY
  );
}
function config() {
  if (!googleAvailable()) throw new MemberAuthError("unavailable");
  return {
    clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
  };
}
export function googleAuthorizationUrl(input: {
  state: string;
  nonce: string;
  verifier: string;
}) {
  const { clientId } = config();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: input.state,
    nonce: input.nonce,
    code_challenge: createHash("sha256")
      .update(input.verifier)
      .digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}
export async function beginGoogle(
  res: Pick<Response, "cookie">,
  input: Pick<GoogleFlow, "next" | "locale" | "link">
) {
  config();
  const state = randomToken(),
    browser = randomToken(),
    nonce = randomToken(),
    verifier = randomToken(48);
  const authorizationUrl = googleAuthorizationUrl({ state, nonce, verifier });
  await saveGoogleFlow(state, browser, {
    ...input,
    next: safeMemberNext(input.next),
    nonce,
    verifier,
  });
  res.cookie(memberCookieName("oauth"), browser, {
    ...memberCookieOptions(),
    maxAge: MEMBER_OAUTH_MS,
  });
  return { authorizationUrl };
}
export async function verifyGoogleIdentity(
  idToken: string,
  nonce: string,
  clientId: string,
  key: CryptoKey | JWTVerifyGetKey = googleKeys
) {
  const { payload } = await jwtVerify(idToken, key as JWTVerifyGetKey, {
    algorithms: ["RS256"],
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
    maxTokenAge: "10m",
    clockTolerance: 30,
    requiredClaims: ["exp", "iat", "sub", "nonce", "email", "email_verified"],
  });
  if (
    payload.nonce !== nonce ||
    (payload.azp !== undefined && payload.azp !== clientId) ||
    (Array.isArray(payload.aud) &&
      payload.aud.length > 1 &&
      payload.azp !== clientId) ||
    typeof payload.sub !== "string" ||
    !/^[\x21-\x7e]{1,255}$/.test(payload.sub)
  )
    throw new MemberAuthError("google_failed");
  if (payload.email_verified !== true && payload.email_verified !== "true")
    throw new MemberAuthError("google_unverified");
  const email = memberEmail.safeParse(payload.email);
  if (!email.success) throw new MemberAuthError("google_failed");
  const name =
    typeof payload.name === "string"
      ? payload.name
          .replace(/[\u0000-\u001f\u007f]/g, "")
          .trim()
          .slice(0, 120)
      : "";
  return {
    subject: payload.sub,
    email: email.data,
    name: name || email.data.split("@")[0].slice(0, 120),
  };
}
export async function exchangeGoogleCode(code: string, flow: GoogleFlow) {
  const { clientId, clientSecret } = config();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
  });
  if (!response.ok || !response.body)
    throw new MemberAuthError("google_failed");
  const reader = response.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 32768) throw new MemberAuthError("google_failed");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (typeof body.id_token !== "string" || body.id_token.length > 16000)
    throw new MemberAuthError("google_failed");
  return verifyGoogleIdentity(body.id_token, flow.nonce, clientId);
}
export async function googleCallback(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  let locale = "en";
  try {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const flow = await consumeGoogleFlow(state, memberCookie(req, "oauth"));
    clearMemberCookie(res, "oauth");
    locale = ["ar", "es", "en", "hi", "zh"].includes(flow.locale)
      ? flow.locale
      : "en";
    if (req.query.error) throw new MemberAuthError("google_failed");
    const code =
      typeof req.query.code === "string" && req.query.code.length <= 4096
        ? req.query.code
        : "";
    if (!code) throw new MemberAuthError("google_failed");
    const identity = await exchangeGoogleCode(code, flow);
    const result = await loginGoogleMember(
      identity,
      flow.link,
      memberCookie(req, "session")
    );
    setMemberCookie(res, result.token);
    const next = new URL(safeMemberNext(flow.next), memberAuthOrigin());
    next.searchParams.set("lang", locale);
    res.redirect(303, next.toString());
  } catch (error) {
    const code =
      error instanceof MemberAuthError ? error.code : "google_failed";
    res.redirect(
      303,
      `${memberAuthOrigin()}/sign-in?lang=${locale}&error=${code}`
    );
  }
}
export function registerMemberRoutes(app: Express) {
  // Public session cookies stay on one canonical host. Existing staff URLs retain their host.
  app.use((req, res, next) => {
    if (
      ["GET", "HEAD"].includes(req.method) &&
      req.hostname === "www.providerbeacon.com" &&
      memberAuthOrigin() === "https://providerbeacon.com" &&
      (req.path === "/" ||
        /^\/(?:services|providers|compare|directory|sign-in|sign-up|account|recover-account|privacy)(?:\/|$)/.test(
          req.path
        ))
    ) {
      res.redirect(308, `${memberAuthOrigin()}${req.originalUrl}`);
      return;
    }
    next();
  });
  app.get("/api/auth/google/callback", (req, res) => {
    void googleCallback(req, res).catch(() => {
      if (!res.headersSent)
        res.status(503).send("Sign-in is temporarily unavailable.");
    });
  });
}
