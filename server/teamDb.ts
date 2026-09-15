import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  teamMembers,
  users,
  staffAccounts,
  staffSessions,
  type TeamMember,
  type TeamRole,
} from "../drizzle/schema";
import { emailOutbox, emailSuppressions } from "../drizzle/emailSchema";
import { ENV } from "./_core/env";
import {
  mailConfiguration,
  mailDatabase,
  type MailTransaction,
  type MailPayload,
} from "./emailDb";
import { emailLocale, renderEmail } from "./emailTemplates";
import { memberAuthOrigin, memberEmailKey } from "./memberSecurity";
import {
  encryptValue,
  hashToken,
  normalizeEmail,
  randomToken,
} from "./security";
import { writeAudit } from "./marketplaceDb";

const fail = (
  message: string,
  code: "BAD_REQUEST" | "CONFLICT" | "FORBIDDEN" | "NOT_FOUND" = "BAD_REQUEST"
): never => {
  throw new TRPCError({ code, message });
};
type Change = { id: number; revision: number; actorUserId: number };

async function ownerLock(tx: MailTransaction, actorUserId: number) {
  const [actor] = await tx
    .select()
    .from(users)
    .where(eq(users.id, actorUserId))
    .for("update");
  const [membership] = await tx
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, actorUserId))
    .limit(1);
  if (
    !actor ||
    !(
      actor.openId === ENV.ownerOpenId ||
      (membership?.role === "owner" && membership.status === "active")
    )
  )
    fail("team_owner_only", "FORBIDDEN");
}
async function editable(tx: MailTransaction, input: Change) {
  await ownerLock(tx, input.actorUserId);
  const [member] = await tx
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, input.id))
    .for("update");
  if (!member) return fail("team_missing", "NOT_FOUND");
  if (member.role === "owner" || member.userId === input.actorUserId)
    fail("team_protected", "FORBIDDEN");
  if (member.revision !== input.revision) fail("team_changed", "CONFLICT");
  return member;
}
export async function cancelInviteEmails(tx: MailTransaction, id: number) {
  await tx
    .update(emailOutbox)
    .set({
      status: "cancelled",
      payload: null,
      lastError: "invitation_changed",
    })
    .where(
      and(
        eq(emailOutbox.teamMemberId, id),
        inArray(emailOutbox.status, ["queued", "processing"])
      )
    );
}
async function queueInvite(
  tx: MailTransaction,
  member: TeamMember,
  actorUserId: number,
  locale: string
) {
  const config = mailConfiguration();
  if (!config.enabled) fail("team_mail_disabled");
  const [blocked] = await tx
    .select()
    .from(emailSuppressions)
    .where(eq(emailSuppressions.recipientHash, memberEmailKey(member.email)))
    .limit(1);
  if (blocked) fail("team_mail_suppressed");
  const token = randomToken(),
    tokenHash = hashToken(token),
    language = emailLocale(locale);
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  const inviteUrl = `${memberAuthOrigin()}/team/accept?lang=${language}#token=${token}`;
  const rendered = renderEmail({
    kind: "staff_invite",
    locale: language,
    name: "",
    url: inviteUrl,
  });
  const payload: MailPayload = {
    from: config.from,
    reply_to: config.replyTo,
    to: [member.email],
    ...rendered,
  };
  await cancelInviteEmails(tx, member.id);
  const [{ id: mailId }] = await tx
    .insert(emailOutbox)
    .values({
      teamMemberId: member.id,
      inviteTokenHash: tokenHash,
      dedupeKey: `team-invite:${member.id}:${tokenHash}`,
      kind: "staff_invite",
      locale: language,
      subject: rendered.subject,
      recipientHash: memberEmailKey(member.email),
      payload: encryptValue(JSON.stringify(payload), "email-outbox"),
      expiresAt,
      actorId: actorUserId,
    })
    .$returningId();
  await tx
    .update(teamMembers)
    .set({
      invitationTokenHash: tokenHash,
      invitationExpiresAt: expiresAt,
      invitationLocale: language,
      inviteEmailId: mailId,
      revision: member.revision + 1,
    })
    .where(eq(teamMembers.id, member.id));
  return { id: member.id, success: true, queued: true, inviteUrl, expiresAt };
}
export async function listTeamMembers() {
  const db = await mailDatabase();
  // Explicit projection: invitation secrets and hashes never enter list/cache responses.
  return db
    .select({
      id: teamMembers.id,
      userId: teamMembers.userId,
      email: teamMembers.email,
      role: teamMembers.role,
      status: teamMembers.status,
      revision: teamMembers.revision,
      createdAt: teamMembers.createdAt,
      invitationExpiresAt: teamMembers.invitationExpiresAt,
      invitationLocale: teamMembers.invitationLocale,
      mailStatus: emailOutbox.status,
      mailError: emailOutbox.lastError,
      mailUpdatedAt: emailOutbox.updatedAt,
    })
    .from(teamMembers)
    .leftJoin(emailOutbox, eq(teamMembers.inviteEmailId, emailOutbox.id))
    .orderBy(desc(teamMembers.createdAt));
}
export async function createTeamInvite(input: {
  email: string;
  role: Exclude<TeamRole, "owner">;
  locale?: string;
  actorUserId: number;
}) {
  if (input.role === ("owner" as string)) fail("team_protected", "FORBIDDEN");
  const db = await mailDatabase(),
    email = normalizeEmail(input.email);
  return db.transaction(async tx => {
    await ownerLock(tx, input.actorUserId);
    const [existing] = await tx
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.email, email))
      .limit(1);
    const [account] = await tx
      .select()
      .from(staffAccounts)
      .where(eq(staffAccounts.email, email))
      .limit(1);
    if (existing || account) fail("team_exists", "CONFLICT");
    const [{ id }] = await tx
      .insert(teamMembers)
      .values({
        email,
        role: input.role,
        status: "invited",
        invitedByUserId: input.actorUserId,
      })
      .$returningId();
    const [member] = await tx
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, id));
    const result = await queueInvite(
      tx,
      member,
      input.actorUserId,
      input.locale ?? "en"
    );
    await writeAudit(
      {
        actorUserId: input.actorUserId,
        action: "team.invite",
        entityType: "team_member",
        entityId: String(id),
        summary: `Queued team invitation as ${input.role}`,
      },
      tx
    );
    return result;
  });
}
export async function resendTeamInvite(input: Change & { locale: string }) {
  const db = await mailDatabase();
  return db.transaction(async tx => {
    const member = await editable(tx, input);
    if (member.status !== "invited") fail("team_not_invited");
    if (member.inviteEmailId) {
      const [last] = await tx
        .select({ createdAt: emailOutbox.createdAt })
        .from(emailOutbox)
        .where(eq(emailOutbox.id, member.inviteEmailId))
        .limit(1);
      if (last && Date.now() - last.createdAt.getTime() < 60000)
        fail("team_resend_wait");
    }
    const result = await queueInvite(
      tx,
      member,
      input.actorUserId,
      input.locale
    );
    await writeAudit(
      {
        actorUserId: input.actorUserId,
        action: "team.invite.resend",
        entityType: "team_member",
        entityId: String(member.id),
        summary: "Replaced the invitation link and queued a new email",
      },
      tx
    );
    return result;
  });
}
export async function setTeamMemberRole(
  input: Change & { role: Exclude<TeamRole, "owner"> }
) {
  if (input.role === ("owner" as string)) fail("team_protected", "FORBIDDEN");
  const db = await mailDatabase();
  return db.transaction(async tx => {
    const member = await editable(tx, input);
    if (member.role === input.role) return { success: true };
    await tx
      .update(teamMembers)
      .set({ role: input.role, revision: member.revision + 1 })
      .where(eq(teamMembers.id, member.id));
    if (member.userId) {
      await tx
        .update(users)
        .set({ role: input.role === "administrator" ? "admin" : "user" })
        .where(eq(users.id, member.userId));
      await tx
        .delete(staffSessions)
        .where(eq(staffSessions.userId, member.userId));
    }
    await writeAudit(
      {
        actorUserId: input.actorUserId,
        action: "team.member.role",
        entityType: "team_member",
        entityId: String(member.id),
        summary: `Changed team role from ${member.role} to ${input.role}; sessions revoked`,
        metadata: { before: member.role, after: input.role },
      },
      tx
    );
    return { success: true };
  });
}
export async function setTeamMemberStatus(
  input: Change & { status: "active" | "suspended" }
) {
  const db = await mailDatabase();
  return db.transaction(async tx => {
    const member = await editable(tx, input);
    if (member.status === "invited" || !member.userId)
      return fail("team_not_registered");
    await tx
      .update(teamMembers)
      .set({
        status: input.status,
        revision: member.revision + 1,
        invitationTokenHash: null,
        invitationExpiresAt: null,
      })
      .where(eq(teamMembers.id, member.id));
    await tx
      .delete(staffSessions)
      .where(eq(staffSessions.userId, member.userId));
    await cancelInviteEmails(tx, member.id);
    await writeAudit(
      {
        actorUserId: input.actorUserId,
        action: `team.member.${input.status}`,
        entityType: "team_member",
        entityId: String(member.id),
        summary: `Team access changed to ${input.status}; sessions revoked`,
      },
      tx
    );
    return { success: true };
  });
}
export async function removeTeamMember(input: Change) {
  const db = await mailDatabase();
  return db.transaction(async tx => {
    const member = await editable(tx, input);
    if (member.userId) {
      await tx
        .delete(staffSessions)
        .where(eq(staffSessions.userId, member.userId));
      await tx
        .delete(staffAccounts)
        .where(eq(staffAccounts.userId, member.userId));
      // Keep the historical user ID for audit attribution; remove every staff credential.
      await tx
        .update(users)
        .set({ role: "user" })
        .where(eq(users.id, member.userId));
    }
    await tx.delete(teamMembers).where(eq(teamMembers.id, member.id));
    await writeAudit(
      {
        actorUserId: input.actorUserId,
        action: "team.member.remove",
        entityType: "team_member",
        entityId: String(member.id),
        summary: `Removed ${member.status} team member and revoked credentials`,
        metadata: { userId: member.userId, role: member.role },
      },
      tx
    );
    return { success: true };
  });
}
