import { and, eq, gt, ne, sql } from "drizzle-orm";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { auditEntries, staffAccounts, staffSessions, teamMembers, users, type User } from "../drizzle/schema";
import { getDb } from "./db";
import {
  PENDING_MFA_MINUTES,
  STAFF_SESSION_HOURS,
  constantTimeTokenMatch,
  decryptValue,
  encryptValue,
  generateRecoveryCodes,
  hashPassword,
  hashRecoveryCode,
  hashToken,
  normalizeEmail,
  randomToken,
  verifyPassword,
} from "./security";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
let dummyHashPromise: Promise<string> | null = null;

function dummyHash() {
  dummyHashPromise ??= hashPassword("ProviderBeacon!TimingOnly2026");
  return dummyHashPromise;
}

function clientIp(req: { headers: Record<string, unknown>; ip?: string }) {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : typeof forwarded === "string" ? forwarded.split(",")[0] : req.ip;
  return value?.trim().slice(0, 64) || null;
}

function accountMfaValue(account: typeof staffAccounts.$inferSelect) {
  if (!account.mfaSecretCiphertext || !account.mfaSecretIv || !account.mfaSecretTag) return null;
  return decryptValue({
    ciphertext: account.mfaSecretCiphertext,
    iv: account.mfaSecretIv,
    tag: account.mfaSecretTag,
    version: account.mfaSecretVersion,
  }, `mfa:${account.id}`);
}

function totpFor(email: string, secretBase32: string) {
  return new OTPAuth.TOTP({
    issuer: "ProviderBeacon",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

async function createSession(input: { userId: number; mfaVerified: boolean; req: { headers: Record<string, unknown>; ip?: string } }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const token = randomToken();
  const expiresAt = new Date(Date.now() + (input.mfaVerified ? STAFF_SESSION_HOURS * 60 : PENDING_MFA_MINUTES) * 60_000);
  await db.insert(staffSessions).values({
    userId: input.userId,
    tokenHash: hashToken(token),
    mfaVerified: input.mfaVerified,
    ipAddress: clientIp(input.req),
    userAgent: String(input.req.headers["user-agent"] ?? "").slice(0, 500) || null,
    expiresAt,
  });
  return { token, expiresAt };
}

async function createLocalIdentity(input: { email: string; name: string; password: string; role: "owner" | "administrator" | "operations_manager" | "provider_reviewer" | "catalogue_editor" | "translation_manager" | "auditor"; invitedByUserId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const existing = await db.select({ id: staffAccounts.id }).from(staffAccounts).where(eq(staffAccounts.email, email)).limit(1);
  if (existing.length) throw new Error("A staff account already exists for this email");
  return db.transaction(async tx => {
    const [{ id: userId }] = await tx.insert(users).values({
      openId: `local:${randomToken(18)}`,
      name: input.name.trim().slice(0, 160),
      email,
      loginMethod: "local",
      role: input.role === "owner" || input.role === "administrator" ? "admin" : "user",
      lastSignedIn: new Date(),
    }).$returningId();
    const [{ id: accountId }] = await tx.insert(staffAccounts).values({ userId, email, passwordHash }).$returningId();
    await tx.insert(teamMembers).values({
      userId,
      email,
      role: input.role,
      status: "active",
      invitedByUserId: input.invitedByUserId,
    }).onDuplicateKeyUpdate({ set: { userId, role: input.role, status: "active", invitationTokenHash: null, invitationExpiresAt: null } });
    return { userId, accountId, email };
  });
}

export async function getBootstrapStatus() {
  const db = await getDb();
  if (!db) return { available: false, configured: false };
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(staffAccounts);
  return { available: Number(row?.count ?? 0) === 0, configured: Boolean(process.env.AUTH_BOOTSTRAP_TOKEN) };
}

export async function bootstrapOwner(input: { token: string; email: string; name: string; password: string; req: { headers: Record<string, unknown>; ip?: string } }) {
  const expected = process.env.AUTH_BOOTSTRAP_TOKEN ?? "";
  if (!expected || !constantTimeTokenMatch(input.token, expected)) throw new Error("Invalid setup token");
  const status = await getBootstrapStatus();
  if (!status.available) throw new Error("The owner account has already been created");
  const identity = await createLocalIdentity({ ...input, role: "owner" });
  const session = await createSession({ userId: identity.userId, mfaVerified: true, req: input.req });
  await writeAuthAudit({ actorUserId: identity.userId, action: "auth.owner.bootstrap", summary: "Created the initial independent owner account", req: input.req });
  return { ...session, userId: identity.userId, email: identity.email };
}

export async function recoverBootstrapOwner(input: { token: string; email: string; password: string; req: { headers: Record<string, unknown>; ip?: string } }) {
  const expected = process.env.AUTH_BOOTSTRAP_TOKEN ?? "";
  if (!expected || !constantTimeTokenMatch(input.token, expected)) throw new Error("Invalid setup token");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [owner] = await db.select({ user: users, account: staffAccounts })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .innerJoin(staffAccounts, eq(staffAccounts.userId, users.id))
    .where(and(eq(teamMembers.role, "owner"), eq(teamMembers.status, "active")))
    .limit(1);
  if (!owner) throw new Error("Owner account not found");
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async tx => {
    await tx.update(users).set({ email, name: owner.user.name || "ProviderBeacon Owner" }).where(eq(users.id, owner.user.id));
    await tx.update(staffAccounts).set({
      email,
      passwordHash,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecretCiphertext: null,
      mfaSecretIv: null,
      mfaSecretTag: null,
      recoveryCodeHashes: null,
    }).where(eq(staffAccounts.id, owner.account.id));
    await tx.update(teamMembers).set({ email }).where(eq(teamMembers.userId, owner.user.id));
    await tx.delete(staffSessions).where(eq(staffSessions.userId, owner.user.id));
  });
  await writeAuthAudit({ actorUserId: owner.user.id, action: "auth.owner.recover", summary: "Recovered the independent owner account with the bootstrap token", req: input.req });
  const session = await createSession({ userId: owner.user.id, mfaVerified: true, req: input.req });
  return { ...session, userId: owner.user.id, email };
}

export async function registerInvitedAccount(input: { token: string; email: string; name: string; password: string; req: { headers: Record<string, unknown>; ip?: string } }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const email = normalizeEmail(input.email);
  const invitationTokenHash = hashToken(input.token);
  const [invite] = await db.select().from(teamMembers).where(and(
    eq(teamMembers.invitationTokenHash, invitationTokenHash),
    eq(teamMembers.email, email),
    eq(teamMembers.status, "invited"),
    gt(teamMembers.invitationExpiresAt, new Date()),
  )).limit(1);
  if (!invite) throw new Error("Invitation is invalid, expired, or belongs to another email");
  const identity = await createLocalIdentity({ email, name: input.name, password: input.password, role: invite.role, invitedByUserId: invite.invitedByUserId ?? undefined });
  const session = await createSession({ userId: identity.userId, mfaVerified: true, req: input.req });
  await writeAuthAudit({ actorUserId: identity.userId, action: "auth.invite.register", summary: `Registered an invited ${invite.role} account`, req: input.req });
  return { ...session, userId: identity.userId, email };
}

export async function loginWithPassword(input: { email: string; password: string; req: { headers: Record<string, unknown>; ip?: string } }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const email = normalizeEmail(input.email);
  const [row] = await db.select({ account: staffAccounts, user: users }).from(staffAccounts).innerJoin(users, eq(staffAccounts.userId, users.id)).where(eq(staffAccounts.email, email)).limit(1);
  if (!row) {
    await verifyPassword(input.password, await dummyHash());
    throw new Error("Email or password is incorrect");
  }
  const passwordValid = await verifyPassword(input.password, row.account.passwordHash);
  if (row.account.lockedUntil && row.account.lockedUntil > new Date()) throw new Error("Account temporarily locked. Try again later");
  if (!passwordValid) {
    const attempts = row.account.failedLoginAttempts + 1;
    await db.update(staffAccounts).set({
      failedLoginAttempts: attempts >= MAX_FAILED_ATTEMPTS ? 0 : attempts,
      lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
    }).where(eq(staffAccounts.id, row.account.id));
    await writeAuthAudit({ actorUserId: row.user.id, action: "auth.login.failed", summary: "Rejected an invalid password", req: input.req });
    throw new Error("Email or password is incorrect");
  }
  await db.update(staffAccounts).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(staffAccounts.id, row.account.id));
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, row.user.id));
  const session = await createSession({ userId: row.user.id, mfaVerified: !row.account.mfaEnabled, req: input.req });
  await writeAuthAudit({ actorUserId: row.user.id, action: "auth.login.password", summary: row.account.mfaEnabled ? "Password accepted; MFA required" : "Signed in with independent account", req: input.req });
  return { ...session, mfaRequired: row.account.mfaEnabled };
}

export async function verifyMfaSession(input: { token: string; code: string; req: { headers: Record<string, unknown>; ip?: string } }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [row] = await db.select({ session: staffSessions, account: staffAccounts }).from(staffSessions)
    .innerJoin(staffAccounts, eq(staffSessions.userId, staffAccounts.userId))
    .where(and(eq(staffSessions.tokenHash, hashToken(input.token)), gt(staffSessions.expiresAt, new Date()))).limit(1);
  if (!row || !row.account.mfaEnabled) throw new Error("MFA session is invalid or expired");
  const secret = accountMfaValue(row.account);
  if (!secret) throw new Error("MFA configuration is incomplete");
  let valid = totpFor(row.account.email, secret).validate({ token: input.code.replace(/\s/g, ""), window: 1 }) != null;
  const recoveryHash = hashRecoveryCode(input.code);
  const recoveryCodes = row.account.recoveryCodeHashes ?? [];
  if (!valid && recoveryCodes.includes(recoveryHash)) {
    valid = true;
    await db.update(staffAccounts).set({ recoveryCodeHashes: recoveryCodes.filter(code => code !== recoveryHash) }).where(eq(staffAccounts.id, row.account.id));
  }
  if (!valid) {
    await writeAuthAudit({ actorUserId: row.session.userId, action: "auth.mfa.failed", summary: "Rejected an invalid MFA code", req: input.req });
    throw new Error("Verification code is invalid");
  }
  const expiresAt = new Date(Date.now() + STAFF_SESSION_HOURS * 60 * 60_000);
  await db.update(staffSessions).set({ mfaVerified: true, expiresAt, lastSeenAt: new Date() }).where(eq(staffSessions.id, row.session.id));
  await writeAuthAudit({ actorUserId: row.session.userId, action: "auth.mfa.verified", summary: "Completed MFA verification", req: input.req });
  return { success: true, expiresAt };
}

export async function authenticateStaffSession(token: string): Promise<User | null> {
  const db = await getDb();
  if (!db || !token) return null;
  const [row] = await db.select({ session: staffSessions, user: users }).from(staffSessions)
    .innerJoin(users, eq(staffSessions.userId, users.id))
    .where(and(eq(staffSessions.tokenHash, hashToken(token)), eq(staffSessions.mfaVerified, true), gt(staffSessions.expiresAt, new Date()))).limit(1);
  if (!row) return null;
  const stale = Date.now() - row.session.lastSeenAt.getTime() > 5 * 60_000;
  if (stale) await db.update(staffSessions).set({ lastSeenAt: new Date() }).where(eq(staffSessions.id, row.session.id));
  return row.user;
}

export async function destroyStaffSession(token: string | undefined, actorUserId?: number) {
  const db = await getDb();
  if (!db || !token) return;
  await db.delete(staffSessions).where(eq(staffSessions.tokenHash, hashToken(token)));
  if (actorUserId) await writeAuthAudit({ actorUserId, action: "auth.logout", summary: "Signed out of the independent account" });
}

export async function getSecuritySummary(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [account] = await db.select().from(staffAccounts).where(eq(staffAccounts.userId, userId)).limit(1);
  if (!account) return { localAccount: false, mfaEnabled: false, activeSessions: 0, passwordChangedAt: null };
  const [sessions] = await db.select({ count: sql<number>`count(*)` }).from(staffSessions).where(and(eq(staffSessions.userId, userId), gt(staffSessions.expiresAt, new Date())));
  return { localAccount: true, mfaEnabled: account.mfaEnabled, activeSessions: Number(sessions?.count ?? 0), passwordChangedAt: account.passwordChangedAt };
}

export async function changePassword(input: { userId: number; currentPassword: string; newPassword: string; currentSessionToken?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [account] = await db.select().from(staffAccounts).where(eq(staffAccounts.userId, input.userId)).limit(1);
  if (!account || !await verifyPassword(input.currentPassword, account.passwordHash)) throw new Error("Current password is incorrect");
  const passwordHash = await hashPassword(input.newPassword);
  await db.update(staffAccounts).set({ passwordHash, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null }).where(eq(staffAccounts.id, account.id));
  if (input.currentSessionToken) await db.delete(staffSessions).where(and(eq(staffSessions.userId, input.userId), ne(staffSessions.tokenHash, hashToken(input.currentSessionToken))));
  else await db.delete(staffSessions).where(eq(staffSessions.userId, input.userId));
  await writeAuthAudit({ actorUserId: input.userId, action: "auth.password.change", summary: "Changed account password and revoked other sessions" });
  return { success: true };
}

export async function beginMfaSetup(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [account] = await db.select().from(staffAccounts).where(eq(staffAccounts.userId, userId)).limit(1);
  if (!account) throw new Error("Independent staff account required");
  if (account.mfaEnabled) throw new Error("MFA is already enabled for this account");
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const encrypted = encryptValue(secret, `mfa:${account.id}`);
  await db.update(staffAccounts).set({
    mfaEnabled: false,
    mfaSecretCiphertext: encrypted.ciphertext,
    mfaSecretIv: encrypted.iv,
    mfaSecretTag: encrypted.tag,
    mfaSecretVersion: encrypted.version,
    recoveryCodeHashes: null,
  }).where(eq(staffAccounts.id, account.id));
  const uri = totpFor(account.email, secret).toString();
  return { secret, uri, qrDataUrl: await QRCode.toDataURL(uri, { width: 220, margin: 1, errorCorrectionLevel: "M" }) };
}

export async function confirmMfaSetup(input: { userId: number; code: string; currentSessionToken?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [account] = await db.select().from(staffAccounts).where(eq(staffAccounts.userId, input.userId)).limit(1);
  if (!account) throw new Error("Independent staff account required");
  const secret = accountMfaValue(account);
  if (!secret || totpFor(account.email, secret).validate({ token: input.code.replace(/\s/g, ""), window: 1 }) == null) throw new Error("Verification code is invalid");
  const recoveryCodes = generateRecoveryCodes();
  await db.update(staffAccounts).set({ mfaEnabled: true, recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode) }).where(eq(staffAccounts.id, account.id));
  if (input.currentSessionToken) await db.update(staffSessions).set({ mfaVerified: true }).where(eq(staffSessions.tokenHash, hashToken(input.currentSessionToken)));
  await writeAuthAudit({ actorUserId: input.userId, action: "auth.mfa.enable", summary: "Enabled TOTP multi-factor authentication" });
  return { success: true, recoveryCodes };
}

export async function revokeOtherSessions(input: { userId: number; currentSessionToken?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (input.currentSessionToken) await db.delete(staffSessions).where(and(eq(staffSessions.userId, input.userId), ne(staffSessions.tokenHash, hashToken(input.currentSessionToken))));
  else await db.delete(staffSessions).where(eq(staffSessions.userId, input.userId));
  await writeAuthAudit({ actorUserId: input.userId, action: "auth.sessions.revoke", summary: "Revoked other staff sessions" });
  return { success: true };
}

async function writeAuthAudit(input: { actorUserId?: number; action: string; summary: string; req?: { headers: Record<string, unknown>; ip?: string } }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditEntries).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "staff_auth",
    entityId: input.actorUserId ? String(input.actorUserId) : "anonymous",
    summary: input.summary,
    ipAddress: input.req ? clientIp(input.req) : undefined,
  });
}
