import { assertStaffOrigin } from "../staffOrigin";
import { memberClientKey } from "../memberSecurity";
import { reserveMemberRequests } from "../memberDb";
import { memberCredentials } from "../../shared/memberAuth";
import { memberPublic, safely } from "../memberProcedures";
import { setMemberCookie, withMemberPasswordWork } from "../memberSecurity";
import { reservePasswordSignIn, reserveStaffVerification, signInWithPassword } from "../siteSignIn";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions, getStaffSessionCookieOptions } from "../_core/cookies";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  beginMfaSetup,
  bootstrapOwner,
  changePassword,
  confirmMfaSetup,
  destroyStaffSession,
  disableMfa,
  getBootstrapStatus,
  getSecuritySummary,
  loginWithPassword,
  recoverBootstrapOwner,
  registerInvitedAccount,
  revokeOtherSessions,
  verifyMfaSession,
} from "../authDb";
import { PENDING_MFA_MINUTES, STAFF_SESSION_COOKIE, STAFF_SESSION_HOURS } from "../security";
import { writeAudit } from "../marketplaceDb";

const credentials = memberCredentials;
const registration = credentials.extend({
  name: z.string().trim().min(2).max(160),
});

function setStaffCookie(ctx: { req: Parameters<typeof getStaffSessionCookieOptions>[0]; res: { cookie: Function } }, token: string, fullSession: boolean) {
  ctx.res.cookie(STAFF_SESSION_COOKIE, token, {
    ...getStaffSessionCookieOptions(ctx.req),
    maxAge: (fullSession ? STAFF_SESSION_HOURS * 60 : PENDING_MFA_MINUTES) * 60_000,
  });
}

function authError(error: unknown, fallback = "Authentication failed") {
  const message = error instanceof Error ? error.message : fallback;
  return new TRPCError({ code: "UNAUTHORIZED", message });
}

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    ctx.res.setHeader("Cache-Control", "no-store");
    return ctx.user ? { ...ctx.user, authMode: ctx.authMode ?? null } : null;
  }),
  signIn: memberPublic.input(credentials).mutation(({ ctx, input }) => safely(async () => {
    await reservePasswordSignIn(ctx.req, input.email);
    const result = await signInWithPassword({ ...input, req: ctx.req });
    if (result.kind === "staff") {
      setStaffCookie(ctx, result.token, !result.mfaRequired);
      return { kind: "staff" as const, mfaRequired: result.mfaRequired };
    }
    setMemberCookie(ctx.res, result.token);
    return { kind: "member" as const, member: result.member };
  })),
  bootstrapStatus: publicProcedure.query(() => getBootstrapStatus()),
  bootstrapOwner: publicProcedure.input(registration.extend({ token: z.string().min(20).max(300) })).mutation(async ({ ctx, input }) => {
    try {
      const result = await bootstrapOwner({ ...input, req: ctx.req });
      setStaffCookie(ctx, result.token, true);
      return { success: true };
    } catch (error) { throw authError(error); }
  }),
  recoverOwner: publicProcedure.input(credentials.extend({ token: z.string().min(20).max(300) })).mutation(async ({ ctx, input }) => {
    try {
      const result = await recoverBootstrapOwner({ ...input, req: ctx.req });
      setStaffCookie(ctx, result.token, true);
      return { success: true };
    } catch (error) { throw authError(error); }
  }),
  registerInvite: publicProcedure.input(registration.extend({ token: z.string().min(20).max(300) })).mutation(async ({ ctx, input }) => {
    assertStaffOrigin(ctx.req);
    ctx.res.setHeader("Cache-Control", "no-store");
    await reserveMemberRequests([{ key: `staff-accept:${memberClientKey(ctx.req)}`, limit: 20, windowMs: 900000 }]);
    try {
      const result = await registerInvitedAccount({ ...input, req: ctx.req });
      setStaffCookie(ctx, result.token, true);
      return { success: true };
    } catch (error) { throw authError(error); }
  }),
  login: publicProcedure.input(credentials).mutation(async ({ ctx, input }) => {
    assertStaffOrigin(ctx.req);
    ctx.res.setHeader("Cache-Control", "no-store");
    await safely(() => reservePasswordSignIn(ctx.req, input.email));
    try {
      const result = await withMemberPasswordWork(() => loginWithPassword({ ...input, req: ctx.req }));
      setStaffCookie(ctx, result.token, !result.mfaRequired);
      return { success: true, mfaRequired: result.mfaRequired };
    } catch (error) { throw authError(error); }
  }),
  verifyMfa: publicProcedure.input(z.object({ code: z.string().min(6).max(32) })).mutation(async ({ ctx, input }) => {
    assertStaffOrigin(ctx.req);
    ctx.res.setHeader("Cache-Control", "no-store");
    if (!ctx.staffSessionToken) throw authError(new Error("MFA session is missing or expired"));
    await safely(() => reserveStaffVerification(ctx.req, ctx.staffSessionToken!));
    try {
      await verifyMfaSession({ token: ctx.staffSessionToken, code: input.code, req: ctx.req });
      setStaffCookie(ctx, ctx.staffSessionToken, true);
      return { success: true };
    } catch (error) { throw authError(error); }
  }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const staffCookie = getStaffSessionCookieOptions(ctx.req);
    const oauthCookie = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(STAFF_SESSION_COOKIE, staffCookie);
    ctx.res.clearCookie(COOKIE_NAME, oauthCookie);
    if (ctx.authMode === "staff") await destroyStaffSession(ctx.staffSessionToken, ctx.user?.id);
    else if (ctx.user) {
      try {
        await writeAudit({ actorUserId: ctx.user.id, action: "auth.logout", entityType: "user", entityId: String(ctx.user.id), summary: "User signed out" });
      } catch (error) { console.warn("[Audit] Failed to record logout:", error); }
    }
    return { success: true } as const;
  }),
  security: router({
    summary: protectedProcedure.query(({ ctx }) => getSecuritySummary(ctx.user!.id)),
    changePassword: protectedProcedure.input(z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(14).max(128) })).mutation(async ({ ctx, input }) => {
      try { return await changePassword({ ...input, userId: ctx.user!.id, currentSessionToken: ctx.staffSessionToken }); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Password change failed" }); }
    }),
    beginMfa: protectedProcedure.mutation(({ ctx }) => beginMfaSetup(ctx.user!.id)),
    confirmMfa: protectedProcedure.input(z.object({ code: z.string().min(6).max(12) })).mutation(async ({ ctx, input }) => {
      try { return await confirmMfaSetup({ userId: ctx.user!.id, code: input.code, currentSessionToken: ctx.staffSessionToken }); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "MFA setup failed" }); }
    }),
    disableMfa: protectedProcedure.input(z.object({
      currentPassword: z.string().min(1).max(128),
      code: z.string().trim().min(6).max(32),
      confirm: z.literal(true),
    }).strict()).mutation(async ({ ctx, input }) => {
      assertStaffOrigin(ctx.req);
      ctx.res.setHeader("Cache-Control", "no-store");
      if (ctx.authMode !== "staff" || !ctx.staffSessionToken)
        throw new TRPCError({ code: "UNAUTHORIZED", message: "auth_mfa_session_required" });
      await safely(() => reserveStaffVerification(ctx.req, `disable:${ctx.user!.id}`));
      try {
        return await withMemberPasswordWork(() => disableMfa({
          ...input, userId: ctx.user!.id, currentSessionToken: ctx.staffSessionToken!, req: ctx.req,
        }));
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error && error.message.startsWith("auth_mfa_") ? error.message : "auth_mfa_unavailable" });
      }
    }),
    revokeOtherSessions: protectedProcedure.mutation(({ ctx }) => revokeOtherSessions({ userId: ctx.user!.id, currentSessionToken: ctx.staffSessionToken })),
  }),
});
