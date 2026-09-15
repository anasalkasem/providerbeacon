import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import {
  emailEvents,
  emailOutbox,
  emailSuppressions,
  memberEmailTokens,
} from "../drizzle/emailSchema";
import { teamMembers } from "../drizzle/schema";
import { memberAccounts } from "../drizzle/memberSchema";
import { memberWatches } from "../drizzle/workspaceSchema";
import type {
  PriceAlertReference,
  PriceTargetEmail,
} from "../shared/priceAlerts";
import { getDb } from "./db";
import { decryptValue, encryptValue, randomToken } from "./security";
import {
  memberAuthOrigin,
  memberEmailKey,
  MemberAuthError,
} from "./memberSecurity";
import { emailLocale, renderEmail, type MailKind } from "./emailTemplates";
import { reserveMemberRequests } from "./memberDb";

export type MailDatabase = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type MailTransaction = Parameters<
  Parameters<MailDatabase["transaction"]>[0]
>[0];
type Member = typeof memberAccounts.$inferSelect;
export type MailPayload = {
  from: string;
  reply_to: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};
export async function mailDatabase() {
  const db = await getDb();
  if (!db) throw new MemberAuthError("unavailable");
  return db;
}
export function mailConfiguration() {
  const from =
    process.env.MAIL_FROM || "ProviderBeacon <soporte@providerbeacon.com>";
  const replyTo = process.env.MAIL_REPLY_TO || "soporte@providerbeacon.com";
  const validSender =
    /^ProviderBeacon <[A-Za-z0-9._+-]+@providerbeacon\.com>$/.test(from) &&
    /^[A-Za-z0-9._+-]+@providerbeacon\.com$/.test(replyTo);
  const configured = Boolean(
    process.env.RESEND_API_KEY &&
      process.env.RESEND_WEBHOOK_SECRET &&
      validSender
  );
  return {
    from,
    replyTo,
    configured,
    enabled: configured && process.env.MAIL_ENABLED === "true",
  };
}
export const emailTokenHash = (token: string) =>
  createHash("sha256").update(`pb-email-token:${token}`).digest("hex");
export const credentialFingerprint = (
  member: Pick<
    Member,
    "passwordHash" | "googleSubjectHash" | "recoveryCodeHash"
  >
) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        member.passwordHash,
        member.googleSubjectHash,
        member.recoveryCodeHash,
      ])
    )
    .digest("hex");
export function signEmailValue(value: string, purpose: string) {
  const secret = process.env.AUTH_PEPPER;
  if (!secret) throw new MemberAuthError("unavailable");
  return createHmac("sha256", secret)
    .update(`pb-email:${purpose}:${value}`)
    .digest("base64url");
}
export function validEmailSignature(
  value: string,
  purpose: string,
  signature: string
) {
  const expected = Buffer.from(signEmailValue(value, purpose));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function unsubscribeToken(member: Pick<Member, "id" | "email">) {
  const value = `${member.id}.${memberEmailKey(member.email)}`;
  return `${value}.${signEmailValue(value, "unsubscribe")}`;
}
export function priceUnsubscribeToken(member: Pick<Member, "id" | "email">) {
  const value = `prices.${member.id}.${memberEmailKey(member.email)}`;
  return `${value}.${signEmailValue(value, "price-unsubscribe")}`;
}
export async function unsubscribeMember(token: string) {
  const prices = token.startsWith("prices.");
  const plain = prices ? token.slice(7) : token;
  if (!/^\d{1,10}\.[a-f0-9]{64}\.[A-Za-z0-9_-]{43}$/.test(plain))
    throw new MemberAuthError("invalid_recovery");
  const [id, emailHash, signature] = plain.split(".");
  if (
    !validEmailSignature(
      `${prices ? "prices." : ""}${id}.${emailHash}`,
      prices ? "price-unsubscribe" : "unsubscribe",
      signature
    )
  )
    throw new MemberAuthError("invalid_recovery");
  const db = await mailDatabase();
  await db.transaction(async tx => {
    const [member] = await tx
      .select()
      .from(memberAccounts)
      .where(eq(memberAccounts.id, Number(id)))
      .for("update");
    if (!member || memberEmailKey(member.email) !== emailHash) return;
    if (prices) {
      await tx
        .update(memberWatches)
        .set({
          emailAlertEnabled: false,
          emailAlertNextCheckAt: null,
          emailAlertRevision: sql`${memberWatches.emailAlertRevision} + 1`,
        })
        .where(eq(memberWatches.memberId, member.id));
      const { cancelWatchEmails } = await import("./priceAlerts");
      await cancelWatchEmails(tx, member.id);
      return;
    }
    await tx
      .update(memberAccounts)
      .set({ marketingOptIn: false })
      .where(eq(memberAccounts.id, member.id));
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
  });
}
export async function enqueueEmail(
  tx: MailTransaction,
  member: Member,
  input: {
    kind: Exclude<MailKind, "staff_invite">;
    key: string;
    url: string;
    subject?: string;
    body?: string;
    locale?: string;
    expiresAt?: Date;
    actorId?: number;
    priceAlert?: PriceAlertReference;
    priceTarget?: PriceTargetEmail;
  }
) {
  const locale = emailLocale(input.locale || member.locale),
    config = mailConfiguration();
  const unsubToken =
    input.kind === "price_target"
      ? priceUnsubscribeToken(member)
      : unsubscribeToken(member);
  const unsubscribeUrl =
    input.kind === "customer" || input.kind === "price_target"
      ? `${memberAuthOrigin()}/unsubscribe?lang=${locale}${input.kind === "price_target" ? "&scope=prices" : ""}#token=${unsubToken}`
      : undefined;
  const rendered = renderEmail({
    ...input,
    name: member.name,
    locale,
    unsubscribeUrl,
  });
  const payload: MailPayload = {
    from: config.from,
    reply_to: config.replyTo,
    to: [member.email],
    ...rendered,
    ...(unsubscribeUrl
      ? {
          headers: {
            "List-Unsubscribe": `<${memberAuthOrigin()}/api/email/unsubscribe?token=${unsubToken}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  };
  await tx
    .insert(emailOutbox)
    .values({
      memberId: member.id,
      dedupeKey: input.key,
      kind: input.kind,
      locale,
      subject: rendered.subject,
      recipientHash: memberEmailKey(member.email),
      payload: encryptValue(JSON.stringify(payload), "email-outbox"),
      priceAlert: input.priceAlert,
      expiresAt: input.expiresAt ?? new Date(Date.now() + 7 * 86400000),
      actorId: input.actorId,
    })
    .onDuplicateKeyUpdate({ set: { id: sql`id` } });
}
// Called in the account creation transaction: provider downtime cannot interrupt signup.
export async function queueNewMemberEmail(tx: MailTransaction, member: Member) {
  if (member.emailVerifiedAt)
    return enqueueEmail(tx, member, {
      kind: "welcome",
      key: `welcome:${member.id}`,
      url: `${memberAuthOrigin()}/services?lang=${emailLocale(member.locale)}`,
    });
  await createMemberEmailToken(tx, member, "verify", `welcome:${member.id}`);
}
export async function createMemberEmailToken(
  tx: MailTransaction,
  member: Member,
  kind: "verify" | "reset",
  key?: string
) {
  const token = randomToken(),
    expiresAt = new Date(Date.now() + (kind === "verify" ? 86400000 : 1800000));
  // Multiple verification requests remain valid until one succeeds; reset tokens are
  // invalidated together on any credential change and consumed under the member lock.
  await tx.insert(memberEmailTokens).values({
    tokenHash: emailTokenHash(token),
    memberId: member.id,
    kind,
    email: member.email,
    credentialHash: credentialFingerprint(member),
    expiresAt,
  });
  await enqueueEmail(tx, member, {
    kind,
    key: key ?? `${kind}:${emailTokenHash(token)}`,
    url: `${memberAuthOrigin()}/${kind === "verify" ? "verify-email" : "reset-password"}?lang=${emailLocale(member.locale)}#token=${token}`,
    expiresAt,
  });
}
export async function queueSecurityEmail(tx: MailTransaction, member: Member) {
  await tx
    .delete(memberEmailTokens)
    .where(eq(memberEmailTokens.memberId, member.id));
  await tx
    .update(emailOutbox)
    .set({
      status: "cancelled",
      payload: null,
      lastError: "credential_changed",
    })
    .where(
      and(
        eq(emailOutbox.memberId, member.id),
        inArray(emailOutbox.kind, ["reset", "verify"]),
        eq(emailOutbox.status, "queued")
      )
    );
  if (member.emailVerifiedAt)
    await enqueueEmail(tx, member, {
      kind: "security",
      key: `security:${randomToken()}`,
      url: `${memberAuthOrigin()}/forgot-password?lang=${emailLocale(member.locale)}`,
    });
}
export function nextEmailStatus(current: string, event: string) {
  const targets: Record<string, string> = {
    "email.sent": "accepted",
    "email.delivered": "delivered",
    "email.delivery_delayed": "delayed",
    "email.failed": "failed",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.suppressed": "suppressed",
  };
  const ranks: Record<string, number> = {
    queued: 0,
    processing: 0,
    accepted: 1,
    delayed: 2,
    delivered: 3,
    failed: 4,
    cancelled: 4,
    suppressed: 5,
    bounced: 6,
    complained: 7,
  };
  const target = targets[event];
  return target && (ranks[target] ?? 0) > (ranks[current] ?? 0)
    ? target
    : current;
}
export async function reconcileEmailEvents(providerId: string) {
  const db = await mailDatabase();
  await db.transaction(async tx => {
    const [mail] = await tx
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.providerId, providerId))
      .for("update");
    if (!mail) return;
    const events = await tx
      .select({ type: emailEvents.type })
      .from(emailEvents)
      .where(eq(emailEvents.providerId, providerId));
    const status = events.reduce(
      (state, event) => nextEmailStatus(state, event.type),
      mail.status
    );
    if (["bounced", "complained", "suppressed"].includes(status))
      await tx
        .insert(emailSuppressions)
        .values({ recipientHash: mail.recipientHash, reason: status })
        .onDuplicateKeyUpdate({ set: { reason: status } });
    await tx
      .update(emailOutbox)
      .set({ status, payload: null })
      .where(eq(emailOutbox.id, mail.id));
  });
}
export async function recordEmailEvent(
  id: string,
  event: { type: string; data: { email_id: string } }
) {
  const db = await mailDatabase();
  await db
    .insert(emailEvents)
    .values({ id, providerId: event.data.email_id, type: event.type })
    .onDuplicateKeyUpdate({ set: { id: sql`id` } });
  await reconcileEmailEvents(event.data.email_id);
}
// Shared worker supports customer accounts and staff invitations without inventing
// customer accounts for employees. Both paths recheck eligibility before dispatch.
async function emailRecipientEligible(db: Pick<MailDatabase, "select">, mail: typeof emailOutbox.$inferSelect) {
  if (mail.kind === "staff_invite") {
    if (!mail.teamMemberId || mail.memberId || !mail.inviteTokenHash) return false;
    const [invite] = await db.select().from(teamMembers).where(eq(teamMembers.id, mail.teamMemberId)).limit(1);
    return Boolean(invite && invite.status === "invited"
      && invite.invitationTokenHash === mail.inviteTokenHash
      && invite.invitationExpiresAt && invite.invitationExpiresAt > new Date()
      && memberEmailKey(invite.email) === mail.recipientHash);
  }
  if (!mail.memberId || mail.teamMemberId) return false;
  const [member] = await db.select().from(memberAccounts).where(eq(memberAccounts.id, mail.memberId)).limit(1);
  return Boolean(member && member.status === "active"
    && memberEmailKey(member.email) === mail.recipientHash
    && (mail.kind !== "customer" || (member.emailVerifiedAt && member.marketingOptIn))
    && (mail.kind !== "price_target" || member.emailVerifiedAt));
}
export async function claimEmail() {
  const db = await mailDatabase(),
    now = new Date();
  return db.transaction(async tx => {
    const [mail] = await tx
      .select()
      .from(emailOutbox)
      .where(
        or(
          and(
            eq(emailOutbox.status, "queued"),
            lt(emailOutbox.availableAt, now)
          ),
          and(
            eq(emailOutbox.status, "processing"),
            lt(emailOutbox.leaseUntil, now)
          )
        )
      )
      .orderBy(emailOutbox.id)
      .limit(1)
      .for("update", { skipLocked: true });
    if (!mail) return null;
    const [blocked] = await tx
      .select()
      .from(emailSuppressions)
      .where(eq(emailSuppressions.recipientHash, mail.recipientHash))
      .limit(1);
    const expired =
      mail.expiresAt <= now ||
      (mail.firstAttemptAt &&
        now.getTime() - mail.firstAttemptAt.getTime() > 23 * 3600000);
    const ineligible = !(await emailRecipientEligible(tx, mail));
    if (
      expired ||
      ineligible ||
      blocked ||
      !mail.payload ||
      mail.attempts >= 8
    ) {
      await tx
        .update(emailOutbox)
        .set({
          status: blocked
            ? "suppressed"
            : expired && mail.attempts
              ? "failed"
              : "cancelled",
          payload: null,
          lastError: blocked
            ? "recipient_suppressed"
            : expired
              ? mail.attempts
                ? "delivery_unknown"
                : "expired"
              : ineligible
                ? "recipient_ineligible"
                : "retry_limit",
        })
        .where(eq(emailOutbox.id, mail.id));
      return null;
    }
    const leaseToken = randomToken();
    await tx
      .update(emailOutbox)
      .set({
        status: "processing",
        leaseToken,
        leaseUntil: new Date(Date.now() + 90000),
        attempts: mail.attempts + 1,
        firstAttemptAt: mail.firstAttemptAt ?? now,
      })
      .where(eq(emailOutbox.id, mail.id));
    return { ...mail, leaseToken, attempts: mail.attempts + 1 };
  });
}
export async function sendOneEmail() {
  if (!mailConfiguration().enabled) return false;
  const mail = await claimEmail();
  if (!mail?.payload) return false;
  const db = await mailDatabase();
  const ownsLease = and(
    eq(emailOutbox.id, mail.id),
    eq(emailOutbox.leaseToken, mail.leaseToken),
    eq(emailOutbox.status, "processing")
  );
  let errorCode = "provider_unavailable",
    retry = true;
  try {
    const payload = JSON.parse(
      decryptValue(mail.payload, "email-outbox")
    ) as MailPayload;
    // Recheck consent/suppression immediately before the network call, after the claim.
    const [blocked] = await db
      .select()
      .from(emailSuppressions)
      .where(eq(emailSuppressions.recipientHash, mail.recipientHash))
      .limit(1);
    if (blocked || !(await emailRecipientEligible(db, mail))) {
      await db
        .update(emailOutbox)
        .set({
          status: "cancelled",
          payload: null,
          lastError: "recipient_ineligible",
        })
        .where(ownsLease);
      return false;
    }
    if (mail.kind === "price_target") {
      const { priceAlertStillEligible } = await import("./priceAlerts");
      if (!(await priceAlertStillEligible(mail))) {
        await db
          .update(emailOutbox)
          .set({
            status: "cancelled",
            payload: null,
            lastError: "price_alert_changed",
          })
          .where(ownsLease);
        return false;
      }
    }
    {
      const [lease] = await db
        .select({ id: emailOutbox.id })
        .from(emailOutbox)
        .where(ownsLease)
        .limit(1);
      if (!lease) return false;
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `providerbeacon/${mail.dedupeKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const data = (await response.json()) as { id?: string };
      if (!data.id || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.id))
        throw new Error("Invalid response");
      await db
        .update(emailOutbox)
        .set({
          status: "accepted",
          providerId: data.id,
          payload: null,
          lastError: null,
          leaseUntil: null,
        })
        .where(ownsLease);
      await reconcileEmailEvents(data.id);
      return true;
    }
    errorCode = `provider_http_${response.status}`;
    retry =
      response.status === 429 ||
      response.status >= 500 ||
      response.status === 409;
    await response.body?.cancel();
  } catch {
    /* Never log credentials, recipient addresses, message bodies or reset tokens. */
  }
  await db
    .update(emailOutbox)
    .set({
      status: retry && mail.attempts < 8 ? "queued" : "failed",
      availableAt: new Date(
        Date.now() + Math.min(3 * 3600000, 30000 * 2 ** mail.attempts)
      ),
      leaseUntil: null,
      lastError: errorCode,
      ...(retry && mail.attempts < 8 ? {} : { payload: null }),
    })
    .where(ownsLease);
  return false;
}
export async function maintainEmailQueue() {
  const db = await mailDatabase();
  // Bounded, indexed maintenance also runs while sending is disabled.
  await db
    .delete(memberEmailTokens)
    .where(lt(memberEmailTokens.expiresAt, new Date()))
    .limit(1000);
  await db
    .update(emailOutbox)
    .set({ status: "cancelled", payload: null, lastError: "expired" })
    .where(
      and(
        eq(emailOutbox.status, "queued"),
        eq(emailOutbox.attempts, 0),
        lt(emailOutbox.expiresAt, new Date())
      )
    )
    .limit(1000);
  const cutoff = new Date(Date.now() - 90 * 86400000);
  await db
    .delete(emailOutbox)
    .where(lt(emailOutbox.createdAt, cutoff))
    .limit(1000);
  await db
    .delete(emailEvents)
    .where(lt(emailEvents.createdAt, cutoff))
    .limit(1000);
}
export function startEmailWorker() {
  let busy = false;
  let nextMaintenance = 0;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      if (Date.now() >= nextMaintenance) {
        await maintainEmailQueue();
        nextMaintenance = Date.now() + 3600000;
      }
      if (!mailConfiguration().enabled) return;
      // Shared database limiter applies across Railway replicas.
      try {
        await reserveMemberRequests([
          { key: "mail:worker:global", limit: 1, windowMs: 1000 },
        ]);
      } catch (error) {
        if (error instanceof MemberAuthError && error.code === "rate_limited")
          return;
        throw error;
      }
      // One message per tick keeps throughput below the provider's default rate.
      await sendOneEmail();
    } catch {
      console.warn("[Email] Queue processing temporarily unavailable");
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => {
    void tick();
  }, 2000);
  timer.unref();
  return () => clearInterval(timer);
}
