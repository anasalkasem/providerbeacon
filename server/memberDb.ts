import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import {
  memberAccounts,
  memberAuthBuckets,
  memberOAuthFlows,
  memberSessions,
} from "../drizzle/memberSchema";
import type { MemberProfile } from "../shared/memberAuth";
import { getDb } from "./db";
import { decryptValue, encryptValue, randomToken } from "./security";
import {
  checkMemberPassword,
  googleSubjectHash,
  hashMemberPassword,
  MemberAuthError,
  MEMBER_OAUTH_MS,
  MEMBER_SESSION_MS,
  memberRecoveryHash,
  memberTokenHash,
  newMemberRecoveryCode,
} from "./memberSecurity";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Member = typeof memberAccounts.$inferSelect;
export type MemberAuth = {
  member: Member;
  session: typeof memberSessions.$inferSelect;
};
export type GoogleIdentity = { subject: string; email: string; name: string };
export type GoogleFlow = {
  nonce: string;
  verifier: string;
  next: string;
  locale: string;
  link?: { memberId: number; sessionHash: string };
};
async function database() {
  const db = await getDb();
  if (!db) throw new MemberAuthError("unavailable");
  return db;
}
function duplicate(error: unknown): boolean {
  const e = error as { code?: string; cause?: unknown };
  return e?.code === "ER_DUP_ENTRY" || Boolean(e?.cause && duplicate(e.cause));
}
export function memberProfile(member: Member): MemberProfile {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    emailVerified: Boolean(member.emailVerifiedAt),
    hasPassword: Boolean(member.passwordHash),
    googleLinked: Boolean(member.googleSubjectHash),
    hasRecoveryCode: Boolean(member.recoveryCodeHash),
    createdAt: member.createdAt,
  };
}
export async function authenticateMemberSession(
  token?: string
): Promise<MemberAuth | null> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const db = await database();
  const [result] = await db
    .select({ member: memberAccounts, session: memberSessions })
    .from(memberSessions)
    .innerJoin(memberAccounts, eq(memberAccounts.id, memberSessions.memberId))
    .where(
      and(
        eq(memberSessions.tokenHash, memberTokenHash("session", token)),
        gt(memberSessions.expiresAt, new Date()),
        eq(memberAccounts.status, "active")
      )
    )
    .limit(1);
  return result ?? null;
}
async function lockedMember(tx: Transaction, id: number) {
  const [member] = await tx
    .select()
    .from(memberAccounts)
    .where(eq(memberAccounts.id, id))
    .for("update");
  if (!member || member.status !== "active")
    throw new MemberAuthError("invalid_credentials");
  return member;
}
async function lockedAuth(tx: Transaction, auth: MemberAuth) {
  const member = await lockedMember(tx, auth.member.id);
  const [session] = await tx
    .select()
    .from(memberSessions)
    .where(
      and(
        eq(memberSessions.tokenHash, auth.session.tokenHash),
        eq(memberSessions.memberId, member.id),
        gt(memberSessions.expiresAt, new Date())
      )
    )
    .limit(1);
  if (!session || member.passwordHash !== auth.member.passwordHash)
    throw new MemberAuthError("reauthenticate");
  return member;
}
// Call only while holding the account row lock; concurrent logins cannot bypass the session cap.
async function issueSession(
  tx: Transaction,
  member: Member,
  method: "password" | "google" | "recovery"
) {
  await tx
    .delete(memberSessions)
    .where(
      and(
        eq(memberSessions.memberId, member.id),
        lt(memberSessions.expiresAt, new Date())
      )
    );
  const rows = await tx
    .select({ id: memberSessions.id })
    .from(memberSessions)
    .where(eq(memberSessions.memberId, member.id))
    .orderBy(desc(memberSessions.id));
  const old = rows.slice(4).map(row => row.id);
  if (old.length)
    await tx.delete(memberSessions).where(inArray(memberSessions.id, old));
  const token = randomToken();
  await tx
    .insert(memberSessions)
    .values({
      memberId: member.id,
      tokenHash: memberTokenHash("session", token),
      method,
      expiresAt: new Date(Date.now() + MEMBER_SESSION_MS),
    });
  return { member: memberProfile(member), token };
}
export async function registerMember(input: {
  name: string;
  email: string;
  password: string;
}) {
  const passwordHash = await hashMemberPassword(input.password);
  const recoveryCode = newMemberRecoveryCode();
  const db = await database();
  try {
    return await db.transaction(async tx => {
      const [created] = await tx
        .insert(memberAccounts)
        .values({
          name: input.name,
          email: input.email,
          passwordHash,
          recoveryCodeHash: memberRecoveryHash(recoveryCode),
        })
        .$returningId();
      const member = await lockedMember(tx, created.id);
      return { ...(await issueSession(tx, member, "password")), recoveryCode };
    });
  } catch (error) {
    if (duplicate(error)) throw new MemberAuthError("account_exists");
    throw error;
  }
}
export async function loginMember(email: string, password: string) {
  const db = await database();
  const [snapshot] = await db
    .select()
    .from(memberAccounts)
    .where(eq(memberAccounts.email, email))
    .limit(1);
  if (
    !(await checkMemberPassword(password, snapshot?.passwordHash)) ||
    snapshot?.status !== "active"
  )
    throw new MemberAuthError("invalid_credentials");
  return db.transaction(async tx => {
    const member = await lockedMember(tx, snapshot.id);
    if (member.passwordHash !== snapshot.passwordHash)
      throw new MemberAuthError("invalid_credentials");
    return issueSession(tx, member, "password");
  });
}
export async function requireMemberProof(auth: MemberAuth, password?: string) {
  if (auth.member.passwordHash) {
    if (!(await checkMemberPassword(password ?? "", auth.member.passwordHash)))
      throw new MemberAuthError("reauthenticate");
  } else if (
    auth.session.method !== "google" ||
    Date.now() - auth.session.createdAt.getTime() > MEMBER_OAUTH_MS
  )
    throw new MemberAuthError("reauthenticate");
}
export async function updateMemberName(auth: MemberAuth, name: string) {
  const db = await database();
  return db.transaction(async tx => {
    const member = await lockedAuth(tx, auth);
    await tx
      .update(memberAccounts)
      .set({ name })
      .where(eq(memberAccounts.id, member.id));
    return memberProfile({ ...member, name });
  });
}
export async function changeMemberPassword(
  auth: MemberAuth,
  password: string,
  currentPassword?: string
) {
  await requireMemberProof(auth, currentPassword);
  const passwordHash = await hashMemberPassword(password);
  const recoveryCode = newMemberRecoveryCode();
  const db = await database();
  return db.transaction(async tx => {
    const member = await lockedAuth(tx, auth);
    await tx
      .update(memberAccounts)
      .set({ passwordHash, recoveryCodeHash: memberRecoveryHash(recoveryCode) })
      .where(eq(memberAccounts.id, member.id));
    await tx
      .delete(memberSessions)
      .where(eq(memberSessions.memberId, member.id));
    return {
      ...(await issueSession(
        tx,
        {
          ...member,
          passwordHash,
          recoveryCodeHash: memberRecoveryHash(recoveryCode),
        },
        "password"
      )),
      recoveryCode,
    };
  });
}
export async function rotateMemberRecovery(
  auth: MemberAuth,
  currentPassword?: string
) {
  await requireMemberProof(auth, currentPassword);
  const db = await database();
  return db.transaction(async tx => {
    const member = await lockedAuth(tx, auth);
    const recoveryCode = newMemberRecoveryCode();
    await tx
      .update(memberAccounts)
      .set({ recoveryCodeHash: memberRecoveryHash(recoveryCode) })
      .where(eq(memberAccounts.id, member.id));
    return { recoveryCode };
  });
}
export async function recoverMember(input: {
  email: string;
  code: string;
  newPassword: string;
}) {
  const db = await database();
  const codeHash = memberRecoveryHash(input.code);
  const [snapshot] = await db
    .select()
    .from(memberAccounts)
    .where(eq(memberAccounts.email, input.email))
    .limit(1);
  if (
    !snapshot ||
    !codeHash ||
    snapshot.recoveryCodeHash !== codeHash ||
    snapshot.status !== "active"
  )
    throw new MemberAuthError("invalid_recovery");
  const passwordHash = await hashMemberPassword(input.newPassword);
  const recoveryCode = newMemberRecoveryCode();
  return db.transaction(async tx => {
    const member = await lockedMember(tx, snapshot.id);
    if (member.recoveryCodeHash !== codeHash)
      throw new MemberAuthError("invalid_recovery");
    const recoveryCodeHash = memberRecoveryHash(recoveryCode);
    await tx
      .update(memberAccounts)
      .set({ passwordHash, recoveryCodeHash, googleSubjectHash: null })
      .where(eq(memberAccounts.id, member.id));
    await tx
      .delete(memberSessions)
      .where(eq(memberSessions.memberId, member.id));
    return {
      ...(await issueSession(
        tx,
        { ...member, passwordHash, recoveryCodeHash, googleSubjectHash: null },
        "recovery"
      )),
      recoveryCode,
    };
  });
}
export async function logoutMember(token?: string, all = false) {
  const auth = await authenticateMemberSession(token);
  if (!auth) return;
  const db = await database();
  await db.transaction(async tx => {
    await lockedAuth(tx, auth);
    await tx
      .delete(memberSessions)
      .where(
        all
          ? eq(memberSessions.memberId, auth.member.id)
          : eq(memberSessions.tokenHash, auth.session.tokenHash)
      );
  });
}
export async function deleteMember(auth: MemberAuth, currentPassword?: string) {
  await requireMemberProof(auth, currentPassword);
  const db = await database();
  await db.transaction(async tx => {
    await lockedAuth(tx, auth);
    await tx
      .delete(memberAccounts)
      .where(eq(memberAccounts.id, auth.member.id));
  });
}
export async function loginGoogleMember(
  identity: GoogleIdentity,
  link?: GoogleFlow["link"],
  browserSession?: string
) {
  const db = await database();
  const subjectHash = googleSubjectHash(identity.subject);
  const auth = link ? await authenticateMemberSession(browserSession) : null;
  if (
    link &&
    (!auth ||
      auth.member.id !== link.memberId ||
      auth.session.tokenHash !== link.sessionHash)
  )
    throw new MemberAuthError("invalid_state");
  try {
    return await db.transaction(async tx => {
      if (link && auth) {
        const member = await lockedAuth(tx, auth);
        if (
          member.email !== identity.email ||
          (member.googleSubjectHash && member.googleSubjectHash !== subjectHash)
        )
          throw new MemberAuthError("link_conflict");
        await tx
          .update(memberAccounts)
          .set({ googleSubjectHash: subjectHash, emailVerifiedAt: new Date() })
          .where(eq(memberAccounts.id, member.id));
        return issueSession(
          tx,
          {
            ...member,
            googleSubjectHash: subjectHash,
            emailVerifiedAt: new Date(),
          },
          "google"
        );
      }
      const [known] = await tx
        .select()
        .from(memberAccounts)
        .where(eq(memberAccounts.googleSubjectHash, subjectHash))
        .limit(1);
      if (known) {
        const member = await lockedMember(tx, known.id);
        // A recovery may have removed this credential between the lookup and lock.
        if (member.googleSubjectHash !== subjectHash)
          throw new MemberAuthError("invalid_credentials");
        if (member.email !== identity.email) {
          await tx
            .update(memberAccounts)
            .set({ emailVerifiedAt: null })
            .where(eq(memberAccounts.id, member.id));
          member.emailVerifiedAt = null;
        }
        return issueSession(tx, member, "google");
      }
      const [created] = await tx
        .insert(memberAccounts)
        .values({
          name: identity.name,
          email: identity.email,
          googleSubjectHash: subjectHash,
          emailVerifiedAt: new Date(),
        })
        .$returningId();
      return issueSession(tx, await lockedMember(tx, created.id), "google");
    });
  } catch (error) {
    if (duplicate(error))
      throw new MemberAuthError(link ? "link_conflict" : "account_exists");
    throw error;
  }
}
export async function saveGoogleFlow(
  state: string,
  browser: string,
  payload: GoogleFlow
) {
  const db = await database();
  const stateHash = memberTokenHash("state", state);
  await db
    .insert(memberOAuthFlows)
    .values({
      stateHash,
      browserHash: memberTokenHash("browser", browser),
      payload: encryptValue(
        JSON.stringify(payload),
        `member-oauth:${stateHash}`
      ),
      expiresAt: new Date(Date.now() + MEMBER_OAUTH_MS),
    });
}
export async function consumeGoogleFlow(
  state: string,
  browser?: string
): Promise<GoogleFlow> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(state) || !browser)
    throw new MemberAuthError("invalid_state");
  const db = await database();
  const stateHash = memberTokenHash("state", state);
  return db.transaction(async tx => {
    const [flow] = await tx
      .select()
      .from(memberOAuthFlows)
      .where(eq(memberOAuthFlows.stateHash, stateHash))
      .for("update");
    if (
      !flow ||
      flow.expiresAt.getTime() <= Date.now() ||
      flow.browserHash !== memberTokenHash("browser", browser)
    )
      throw new MemberAuthError("invalid_state");
    await tx
      .delete(memberOAuthFlows)
      .where(eq(memberOAuthFlows.stateHash, stateHash));
    return JSON.parse(
      decryptValue(flow.payload, `member-oauth:${stateHash}`)
    ) as GoogleFlow;
  });
}

let cleanupAfter = 0;
export async function reserveMemberRequests(
  buckets: { key: string; limit: number; windowMs: number }[],
  now = Date.now()
) {
  const db = await database();
  if (now > cleanupAfter) {
    cleanupAfter = now + 300000;
    for (const table of [memberAuthBuckets, memberOAuthFlows, memberSessions])
      await db
        .delete(table)
        .where(lt(table.expiresAt, new Date(now)))
        .limit(1000);
  }
  await db.transaction(async tx => {
    for (const bucket of [...buckets].sort((a, b) =>
      a.key.localeCompare(b.key)
    )) {
      const start = Math.floor(now / bucket.windowMs) * bucket.windowMs;
      const key = `${bucket.key}:${start}`;
      await tx
        .insert(memberAuthBuckets)
        .values({ key, used: 0, expiresAt: new Date(start + bucket.windowMs) })
        .onDuplicateKeyUpdate({ set: { key } });
      const result = await tx
        .update(memberAuthBuckets)
        .set({ used: sql`${memberAuthBuckets.used} + 1` })
        .where(
          and(
            eq(memberAuthBuckets.key, key),
            lt(memberAuthBuckets.used, bucket.limit)
          )
        );
      if (!result[0].affectedRows) throw new MemberAuthError("rate_limited");
    }
  });
}
