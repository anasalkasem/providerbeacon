import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, isNotNull, like, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { emailOutbox, emailSuppressions } from "../../drizzle/emailSchema";
import { memberAccounts } from "../../drizzle/memberSchema";
import { auditEntries } from "../../drizzle/schema";
import { customerEmailInput } from "../../shared/email";
import { memberLocale } from "../../shared/memberAuth";
import { protectedProcedure, router } from "../_core/trpc";
import {
  hasPermission,
  resolveTeamRole,
  type Permission,
} from "../authorization";
import {
  enqueueEmail,
  mailConfiguration,
  mailDatabase,
  signEmailValue,
  validEmailSignature,
} from "../emailDb";
import { renderEmail } from "../emailTemplates";
import { reserveMemberRequests } from "../memberDb";
import {
  assertMemberOrigin,
  memberAuthOrigin,
  memberEmailKey,
} from "../memberSecurity";
import { randomToken } from "../security";

const guard = (permission: Permission) =>
  protectedProcedure.use(async ({ ctx, type, next }) => {
    if (!hasPermission(await resolveTeamRole(ctx.user), permission))
      throw new TRPCError({ code: "FORBIDDEN" });
    ctx.res.setHeader("Cache-Control", "no-store");
    if (type === "mutation") assertMemberOrigin(ctx.req);
    return next();
  });
const eligible = and(
  eq(memberAccounts.status, "active"),
  eq(memberAccounts.marketingOptIn, true),
  isNotNull(memberAccounts.emailVerifiedAt)
);
const proofData = (
  actorId: number,
  input: unknown,
  recipient: { name: string; email: string },
  expires: number,
  nonce: string
) =>
  JSON.stringify({
    actorId,
    input,
    recipient,
    expires,
    nonce,
    from: mailConfiguration().from,
    replyTo: mailConfiguration().replyTo,
  });
export const emailAdminRouter = router({
  status: guard("emails.read").query(async () => {
    const db = await mailDatabase();
    const counts = await db
      .select({ status: emailOutbox.status, count: sql<number>`count(*)` })
      .from(emailOutbox)
      .groupBy(emailOutbox.status);
    return {
      ...mailConfiguration(),
      counts: counts.map(row => ({ ...row, count: Number(row.count) })),
    };
  }),
  recipients: guard("emails.read")
    .input(
      z.object({
        q: z.string().trim().max(100).default(""),
        cursor: z.number().int().positive().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await mailDatabase();
      const rows = await db
        .select({
          id: memberAccounts.id,
          name: memberAccounts.name,
          email: memberAccounts.email,
          locale: memberAccounts.locale,
          verified: memberAccounts.emailVerifiedAt,
          subscribed: memberAccounts.marketingOptIn,
        })
        .from(memberAccounts)
        .where(
          and(
            eq(memberAccounts.status, "active"),
            input.cursor ? lt(memberAccounts.id, input.cursor) : undefined,
            input.q
              ? or(
                  like(
                    memberAccounts.email,
                    `%${input.q.replace(/[%_\\]/g, "")}%`
                  ),
                  like(
                    memberAccounts.name,
                    `%${input.q.replace(/[%_\\]/g, "")}%`
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(memberAccounts.id))
        .limit(26);
      return {
        items: rows.slice(0, 25),
        nextCursor: rows.length > 25 ? rows[24].id : undefined,
      };
    }),
  template: guard("emails.read")
    .input(
      z.object({
        kind: z.enum(["welcome", "verify", "reset", "security"]),
        locale: memberLocale,
      })
    )
    .query(({ input }) =>
      renderEmail({
        ...input,
        name:
          input.locale === "ar"
            ? "عميلنا العزيز"
            : input.locale === "es"
              ? "cliente"
              : "Customer",
        url: `${memberAuthOrigin()}/account?lang=${input.locale}`,
      })
    ),
  preview: guard("emails.send")
    .input(customerEmailInput)
    .mutation(async ({ ctx, input }) => {
      const db = await mailDatabase();
      const [member] = await db
        .select()
        .from(memberAccounts)
        .where(and(eq(memberAccounts.id, input.memberId), eligible))
        .limit(1);
      if (!member)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "email_recipient_ineligible",
        });
      const [blocked] = await db
        .select()
        .from(emailSuppressions)
        .where(
          eq(emailSuppressions.recipientHash, memberEmailKey(member.email))
        )
        .limit(1);
      if (blocked)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "email_recipient_suppressed",
        });
      const expires = Date.now() + 600000,
        nonce = randomToken();
      const recipient = { name: member.name, email: member.email };
      const signature = signEmailValue(
        proofData(ctx.user.id, input, recipient, expires, nonce),
        "preview"
      );
      return {
        recipient,
        from: mailConfiguration().from,
        ...renderEmail({
          ...input,
          kind: "customer",
          name: member.name,
          url: `${memberAuthOrigin()}${input.action}?lang=${input.locale}`,
          unsubscribeUrl: `${memberAuthOrigin()}/unsubscribe?preview=1`,
        }),
        proof: { expires, nonce, signature },
      };
    }),
  send: guard("emails.send")
    .input(
      z
        .object({
          message: customerEmailInput,
          proof: z.object({
            expires: z.number().int(),
            nonce: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
            signature: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
          }),
          confirm: z.literal(true),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      if (!mailConfiguration().enabled)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "email_not_enabled",
        });
      const { message, proof } = input;
      if (proof.expires < Date.now() || proof.expires > Date.now() + 600000)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "email_preview_expired",
        });
      await reserveMemberRequests([
        { key: `customer-mail:${ctx.user.id}`, limit: 50, windowMs: 3600000 },
        { key: "customer-mail:global", limit: 200, windowMs: 86400000 },
      ]);
      const db = await mailDatabase();
      return db.transaction(async tx => {
        const [member] = await tx
          .select()
          .from(memberAccounts)
          .where(and(eq(memberAccounts.id, message.memberId), eligible))
          .for("update");
        if (
          !member ||
          !validEmailSignature(
            proofData(
              ctx.user.id,
              message,
              { name: member.name, email: member.email },
              proof.expires,
              proof.nonce
            ),
            "preview",
            proof.signature
          )
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "email_preview_expired",
          });
        const [blocked] = await tx
          .select()
          .from(emailSuppressions)
          .where(
            eq(emailSuppressions.recipientHash, memberEmailKey(member.email))
          )
          .limit(1);
        if (blocked)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "email_recipient_suppressed",
          });
        const dedupeKey = `customer:${proof.nonce}`;
        const [existing] = await tx
          .select({ id: emailOutbox.id })
          .from(emailOutbox)
          .where(eq(emailOutbox.dedupeKey, dedupeKey))
          .limit(1);
        if (existing) return { id: existing.id, queued: true };
        await enqueueEmail(tx, member, {
          ...message,
          kind: "customer",
          key: dedupeKey,
          url: `${memberAuthOrigin()}${message.action}?lang=${message.locale}`,
          actorId: ctx.user.id,
        });
        const [queued] = await tx
          .select({ id: emailOutbox.id })
          .from(emailOutbox)
          .where(eq(emailOutbox.dedupeKey, dedupeKey))
          .limit(1);
        await tx
          .insert(auditEntries)
          .values({
            actorUserId: ctx.user.id,
            action: "email.customer.queued",
            entityType: "email",
            entityId: String(queued.id),
            summary: `Customer email queued for member ${member.id}; explicit preview confirmed`,
          });
        return { id: queued.id, queued: true };
      });
    }),
  history: guard("emails.read")
    .input(z.object({ cursor: z.number().int().positive().optional() }))
    .query(async ({ input }) => {
      const db = await mailDatabase();
      const rows = await db
        .select({
          id: emailOutbox.id,
          memberId: emailOutbox.memberId,
          email: memberAccounts.email,
          subject: emailOutbox.subject,
          kind: emailOutbox.kind,
          locale: emailOutbox.locale,
          status: emailOutbox.status,
          attempts: emailOutbox.attempts,
          error: emailOutbox.lastError,
          createdAt: emailOutbox.createdAt,
          updatedAt: emailOutbox.updatedAt,
        })
        .from(emailOutbox)
        .innerJoin(memberAccounts, eq(memberAccounts.id, emailOutbox.memberId))
        .where(input.cursor ? lt(emailOutbox.id, input.cursor) : undefined)
        .orderBy(desc(emailOutbox.id))
        .limit(26);
      return {
        items: rows.slice(0, 25),
        nextCursor: rows.length > 25 ? rows[24].id : undefined,
      };
    }),
});
