import { and, eq, gt } from "drizzle-orm";
import { memberAccounts, memberSessions } from "../drizzle/memberSchema";
import { memberEmailTokens, emailOutbox } from "../drizzle/emailSchema";
import { MAIL_CONSENT_VERSION } from "../shared/email";
import { lockedAuth, memberProfile, type MemberAuth } from "./memberDb";
import {
  createMemberEmailToken,
  credentialFingerprint,
  emailTokenHash,
  mailConfiguration,
  mailDatabase,
  queueSecurityEmail,
} from "./emailDb";
import { hashMemberPassword, MemberAuthError } from "./memberSecurity";

export async function updateMemberEmailPreferences(
  auth: MemberAuth,
  input: { locale: string; marketingOptIn: boolean }
) {
  const db = await mailDatabase();
  return db.transaction(async tx => {
    const member = await lockedAuth(tx, auth);
    const changes = {
      locale: input.locale,
      marketingOptIn: input.marketingOptIn,
      ...(input.marketingOptIn && !member.marketingOptIn
        ? {
            marketingConsentAt: new Date(),
            marketingConsentVersion: MAIL_CONSENT_VERSION,
          }
        : {}),
    };
    await tx
      .update(memberAccounts)
      .set(changes)
      .where(eq(memberAccounts.id, member.id));
    if (!input.marketingOptIn)
      await tx
        .update(emailOutbox)
        .set({ status: "cancelled", payload: null, lastError: "unsubscribed" })
        .where(
          and(
            eq(emailOutbox.memberId, member.id),
            eq(emailOutbox.kind, "customer"),
            eq(emailOutbox.status, "queued")
          )
        );
    return memberProfile({ ...member, ...changes });
  });
}
export async function requestEmailVerification(auth: MemberAuth) {
  if (!mailConfiguration().enabled) throw new MemberAuthError("unavailable");
  const db = await mailDatabase();
  await db.transaction(async tx => {
    const member = await lockedAuth(tx, auth);
    if (!member.emailVerifiedAt)
      await createMemberEmailToken(tx, member, "verify");
  });
  return { ok: true };
}
export async function requestPasswordEmail(email: string) {
  if (!mailConfiguration().enabled) throw new MemberAuthError("unavailable");
  const db = await mailDatabase();
  await db.transaction(async tx => {
    const [member] = await tx
      .select()
      .from(memberAccounts)
      .where(
        and(
          eq(memberAccounts.email, email),
          eq(memberAccounts.status, "active")
        )
      )
      .for("update");
    if (member) await createMemberEmailToken(tx, member, "reset");
  });
  // Identical public result whether the email exists or not.
  return { ok: true };
}
export async function consumeMemberEmailToken(
  token: string,
  kind: "verify" | "reset",
  newPassword?: string
) {
  const db = await mailDatabase(),
    tokenHash = emailTokenHash(token);
  const [snapshot] = await db
    .select()
    .from(memberEmailTokens)
    .where(
      and(
        eq(memberEmailTokens.tokenHash, tokenHash),
        eq(memberEmailTokens.kind, kind),
        gt(memberEmailTokens.expiresAt, new Date())
      )
    )
    .limit(1);
  if (!snapshot) throw new MemberAuthError("invalid_recovery");
  const passwordHash =
    kind === "reset" ? await hashMemberPassword(newPassword!) : undefined;
  await db.transaction(async tx => {
    // All credential changes serialize on the same account row, including recovery.
    const [member] = await tx
      .select()
      .from(memberAccounts)
      .where(eq(memberAccounts.id, snapshot.memberId))
      .for("update");
    const [stored] = await tx
      .select()
      .from(memberEmailTokens)
      .where(
        and(
          eq(memberEmailTokens.tokenHash, tokenHash),
          eq(memberEmailTokens.kind, kind),
          gt(memberEmailTokens.expiresAt, new Date())
        )
      )
      .limit(1);
    if (
      !member ||
      !stored ||
      member.status !== "active" ||
      member.email !== stored.email ||
      credentialFingerprint(member) !== stored.credentialHash
    )
      throw new MemberAuthError("invalid_recovery");
    await tx
      .update(memberAccounts)
      .set({
        emailVerifiedAt: new Date(),
        ...(passwordHash ? { passwordHash, recoveryCodeHash: null } : {}),
      })
      .where(eq(memberAccounts.id, member.id));
    await tx
      .delete(memberEmailTokens)
      .where(
        and(
          eq(memberEmailTokens.memberId, member.id),
          eq(memberEmailTokens.kind, kind)
        )
      );
    if (passwordHash) {
      await tx
        .delete(memberSessions)
        .where(eq(memberSessions.memberId, member.id));
      await queueSecurityEmail(tx, { ...member, emailVerifiedAt: new Date() });
    }
  });
  return { ok: true };
}
