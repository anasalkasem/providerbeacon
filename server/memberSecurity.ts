import { createHash, createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { parse } from "cookie";
import type { CookieOptions, Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import { memberPassword } from "../shared/memberAuth";
import { encodePassword, verifyPassword } from "./security";

export const MEMBER_SESSION_MS = 30 * 86400000;
export const MEMBER_OAUTH_MS = 10 * 60000;

export class MemberAuthError extends Error {
  constructor(
    public code:
      | "invalid_credentials"
      | "account_exists"
      | "unavailable"
      | "invalid_state"
      | "google_failed"
      | "google_unverified"
      | "link_conflict"
      | "reauthenticate"
      | "invalid_recovery"
      | "rate_limited"
      | "busy"
  ) {
    super(code);
  }
}

export function memberAuthOrigin() {
  const url = new URL(
    process.env.PUBLIC_APP_URL?.trim() || "https://providerbeacon.com"
  );
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new MemberAuthError("unavailable");
  return url.origin;
}
export function memberCookieName(kind: "session" | "oauth") {
  return `${memberAuthOrigin().startsWith("https:") ? "__Host-" : ""}pb_member_${kind}`;
}
export function memberCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: memberAuthOrigin().startsWith("https:"),
    sameSite: "lax",
    path: "/",
  };
}
export function memberCookie(
  req: Pick<Request, "headers">,
  kind: "session" | "oauth"
) {
  const token = parse(req.headers.cookie ?? "")[memberCookieName(kind)];
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
export function setMemberCookie(res: Pick<Response, "cookie">, token: string) {
  res.cookie(memberCookieName("session"), token, {
    ...memberCookieOptions(),
    maxAge: MEMBER_SESSION_MS,
  });
}
export function clearMemberCookie(
  res: Pick<Response, "clearCookie">,
  kind: "session" | "oauth" = "session"
) {
  res.clearCookie(memberCookieName(kind), memberCookieOptions());
}
export function assertMemberOrigin(req: Pick<Request, "headers">) {
  if (
    req.headers.origin !== memberAuthOrigin() ||
    req.headers["sec-fetch-site"] === "cross-site"
  )
    throw new TRPCError({ code: "FORBIDDEN", message: "member_origin" });
}
export function memberClientKey(req: Pick<Request, "headers" | "socket">) {
  const secret = process.env.AUTH_PEPPER;
  if (!secret) throw new MemberAuthError("unavailable");
  const forwarded = process.env.RAILWAY_PROJECT_ID
    ? req.headers["x-real-ip"]
    : undefined;
  const address =
    typeof forwarded === "string" && isIP(forwarded.trim())
      ? forwarded.trim()
      : (req.socket?.remoteAddress ?? "unknown");
  return createHmac("sha256", secret)
    .update(`member-client:${address}`)
    .digest("hex");
}
export function memberEmailKey(email: string) {
  const secret = process.env.AUTH_PEPPER;
  if (!secret) throw new MemberAuthError("unavailable");
  return createHmac("sha256", secret)
    .update(`member-email:${email}`)
    .digest("hex");
}
export const memberTokenHash = (kind: string, value: string) =>
  createHash("sha256").update(`member:${kind}:${value}`).digest("hex");
export const googleSubjectHash = (subject: string) =>
  memberTokenHash("google-subject", subject);
export function newMemberRecoveryCode() {
  return randomBytes(24)
    .toString("hex")
    .toUpperCase()
    .match(/.{8}/g)!
    .join("-");
}
export function memberRecoveryHash(value: string) {
  const code = value.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-F0-9]{48}$/.test(code) ? memberTokenHash("recovery", code) : null;
}

let passwordWork = 0;
export async function withMemberPasswordWork<T>(work: () => Promise<T>) {
  if (passwordWork >= 2) throw new MemberAuthError("busy");
  passwordWork++;
  try {
    return await work();
  } finally {
    passwordWork--;
  }
}
export const hashMemberPassword = (password: string) =>
  withMemberPasswordWork(() => encodePassword(memberPassword.parse(password)));
export const verifyMemberPassword = (password: string, hash: string) =>
  withMemberPasswordWork(() => verifyPassword(password, hash));

// A missing/passwordless account pays the same scrypt cost as an invalid password.
const dummyHash = `scrypt$32768$8$1$${Buffer.alloc(16, 47).toString("base64url")}$${Buffer.alloc(64, 29).toString("base64url")}`;
export async function checkMemberPassword(
  password: string,
  hash: string | null | undefined
) {
  const valid = await verifyMemberPassword(password, hash ?? dummyHash);
  return Boolean(hash) && valid;
}

export function publicMemberError(error: unknown) {
  if (error instanceof TRPCError) return error;
  const code = error instanceof MemberAuthError ? error.code : "unavailable";
  return new TRPCError({
    code:
      code === "rate_limited" || code === "busy"
        ? "TOO_MANY_REQUESTS"
        : code === "unavailable"
          ? "SERVICE_UNAVAILABLE"
          : code === "invalid_credentials" || code === "reauthenticate"
            ? "UNAUTHORIZED"
            : "BAD_REQUEST",
    message: `member_${code}`,
  });
}
