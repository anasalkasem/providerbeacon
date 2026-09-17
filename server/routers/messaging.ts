import { createHash, randomBytes } from "node:crypto";
import { parse } from "cookie";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { resolveTeamRole } from "../authorization";
import { assertStaffOrigin } from "../staffOrigin";
import { assistantClientKey } from "../assistantUsage";
import {
  conversationId,
  conversationCursor,
  handoffInput,
  messageLocale,
  sendMessageInput,
  threadInput,
} from "../../shared/messaging";
import {
  changeSupportAssignment,
  closeChat,
  getChatThread,
  listConversations,
  messagingBudget,
  messagingDirectory,
  messagingPresence,
  messagingProfile,
  prepareTranslations,
  readChat,
  sendChatMessage,
  setVisitorLanguage,
  startDirect,
  startSupport,
  visitorConversation,
  expiredVisitorKey,
  type ChatActor,
} from "../messagingDb";
import type { TrpcContext } from "../_core/context";

export const SUPPORT_COOKIE = "pb_support";
function visitorKey(ctx: TrpcContext, create = false, replace = false) {
  const token = parse(ctx.req.headers.cookie ?? "")[SUPPORT_COOKIE];
  if (!replace && token && /^[a-f0-9]{64}$/.test(token))
    return createHash("sha256").update(token).digest("hex");
  if (!create) return null;
  const next = randomBytes(32).toString("hex");
  ctx.res.cookie(SUPPORT_COOKIE, next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 30 * 86400000,
  });
  return createHash("sha256").update(next).digest("hex");
}
const staff = protectedProcedure.use(async ({ ctx, type, next }) => {
  ctx.res.setHeader("Cache-Control", "no-store");
  const role = await resolveTeamRole(ctx.user);
  if (!role)
    throw new TRPCError({ code: "FORBIDDEN", message: "messaging_forbidden" });
  if (type === "mutation") assertStaffOrigin(ctx.req);
  const chatActor: Extract<ChatActor, { kind: "staff" }> = {
    kind: "staff",
    userId: ctx.user.id,
    role,
  };
  return next({ ctx: { ...ctx, chatActor } });
});
const publicChat = publicProcedure.use(async ({ ctx, type, next }) => {
  ctx.res.setHeader("Cache-Control", "no-store");
  if (type === "mutation") assertStaffOrigin(ctx.req);
  return next();
});
const visitor = publicChat.use(async ({ ctx, next }) => {
  const key = visitorKey(ctx);
  if (!key)
    throw new TRPCError({ code: "UNAUTHORIZED", message: "messaging_session" });
  return next({
    ctx: { ...ctx, chatActor: { kind: "visitor", key } as const },
  });
});
const readInput = z
  .object({ conversationId, messageId: z.number().int().nonnegative() })
  .strict();
const prepareInput = z
  .object({
    conversationId,
    messageIds: z.array(z.number().int().positive()).min(1).max(50),
    retry: z.boolean().default(false),
  })
  .strict();

export const messagingRouter = router({
  profile: staff.query(async ({ ctx }) => ({
    ...(await messagingProfile(ctx.user.id)),
    userId: ctx.user.id,
    canSupport: ctx.chatActor.role !== "auditor",
    canAssign: ["owner", "administrator"].includes(ctx.chatActor.role),
  })),
  presence: staff
    .input(
      z
        .object({ locale: messageLocale, available: z.boolean().optional() })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      if (input.available && ctx.chatActor.role === "auditor")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "messaging_forbidden",
        });
      return messagingPresence(ctx.user.id, input.locale, input.available);
    }),
  directory: staff.query(({ ctx }) => messagingDirectory(ctx.user.id)),
  list: staff
    .input(z.object({ before: conversationCursor.optional() }).optional())
    .query(({ ctx, input }) => listConversations(ctx.chatActor, input?.before)),
  direct: staff
    .input(z.object({ recipientId: z.number().int().positive() }).strict())
    .mutation(async ({ ctx, input }) => {
      await messagingBudget(`direct:${ctx.user.id}`, 20);
      return startDirect(ctx.user.id, input.recipientId);
    }),
  thread: staff
    .input(threadInput)
    .query(({ ctx, input }) =>
      getChatThread(ctx.chatActor, input.conversationId, input.before)
    ),
  send: staff.input(sendMessageInput).mutation(async ({ ctx, input }) => {
    await messagingBudget(`send:s${ctx.user.id}`, 40);
    return sendChatMessage(ctx.chatActor, input);
  }),
  read: staff
    .input(readInput)
    .mutation(({ ctx, input }) =>
      readChat(ctx.chatActor, input.conversationId, input.messageId)
    ),
  prepare: staff.input(prepareInput).mutation(async ({ ctx, input }) => {
    await messagingBudget(`translate:s${ctx.user.id}`, 30);
    return prepareTranslations(
      ctx.chatActor,
      input.conversationId,
      input.messageIds,
      input.retry
    );
  }),
  assign: staff
    .input(
      z.object({ conversationId, userId: z.number().int().positive() }).strict()
    )
    .mutation(({ ctx, input }) =>
      changeSupportAssignment(ctx.chatActor, input.conversationId, input.userId)
    ),
  close: staff
    .input(z.object({ conversationId }).strict())
    .mutation(({ ctx, input }) =>
      closeChat(ctx.chatActor, input.conversationId)
    ),
  support: router({
    current: publicChat.query(({ ctx }) =>
      visitorConversation(visitorKey(ctx))
    ),
    start: publicChat.input(handoffInput).mutation(async ({ ctx, input }) => {
      await messagingBudget(`start:${assistantClientKey(ctx.req)}`, 8, 3600000);
      const previous = visitorKey(ctx);
      const replace = previous ? await expiredVisitorKey(previous) : false;
      return startSupport(visitorKey(ctx, true, replace)!, input);
    }),
    thread: visitor
      .input(threadInput)
      .query(({ ctx, input }) =>
        getChatThread(ctx.chatActor, input.conversationId, input.before)
      ),
    send: visitor.input(sendMessageInput).mutation(async ({ ctx, input }) => {
      await messagingBudget(`send:v${ctx.chatActor.key}`, 20);
      await messagingBudget(`send:ip${assistantClientKey(ctx.req)}`, 60);
      return sendChatMessage(ctx.chatActor, input);
    }),
    read: visitor
      .input(readInput)
      .mutation(({ ctx, input }) =>
        readChat(ctx.chatActor, input.conversationId, input.messageId)
      ),
    prepare: visitor.input(prepareInput).mutation(async ({ ctx, input }) => {
      await messagingBudget(`translate:v${ctx.chatActor.key}`, 20);
      return prepareTranslations(
        ctx.chatActor,
        input.conversationId,
        input.messageIds,
        input.retry
      );
    }),
    language: visitor
      .input(z.object({ conversationId, locale: messageLocale }).strict())
      .mutation(({ ctx, input }) =>
        setVisitorLanguage(ctx.chatActor, input.conversationId, input.locale)
      ),
    close: visitor
      .input(z.object({ conversationId }).strict())
      .mutation(({ ctx, input }) =>
        closeChat(ctx.chatActor, input.conversationId)
      ),
  }),
});
