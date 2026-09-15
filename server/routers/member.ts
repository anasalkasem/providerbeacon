import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  memberCredentials,
  memberGoogleStart,
  memberPassword,
  memberProof,
  memberRecovery,
  memberRegistration,
  memberLocale,
  memberEmail,
} from "../../shared/memberAuth";
import { emailTokenInput } from "../../shared/email";
import { mailConfiguration, unsubscribeMember } from "../emailDb";
import { consumeMemberEmailToken, requestEmailVerification, requestPasswordEmail, updateMemberEmailPreferences } from "../memberEmail";
import { publicProcedure, router } from "../_core/trpc";
import {
  authenticateMemberSession,
  changeMemberPassword,
  deleteMember,
  loginMember,
  logoutMember,
  memberProfile,
  recoverMember,
  registerMember,
  requireMemberProof,
  reserveMemberRequests,
  rotateMemberRecovery,
  updateMemberName,
} from "../memberDb";
import { beginGoogle, googleAvailable } from "../memberGoogle";
import {
  assertMemberOrigin,
  clearMemberCookie,
  memberClientKey,
  memberCookie,
  memberEmailKey,
  publicMemberError,
  setMemberCookie,
} from "../memberSecurity";
import type { Request, Response } from "express";

const memberPublic = publicProcedure.use(async ({ ctx, type, next }) => {
  ctx.res.setHeader("Cache-Control", "no-store");
  if (type === "mutation") assertMemberOrigin(ctx.req);
  try {
    return await next();
  } catch (error) {
    throw publicMemberError(error);
  }
});
const signedIn = memberPublic.use(async ({ ctx, next }) => {
  const memberAuth = await safely(() =>
    authenticateMemberSession(memberCookie(ctx.req, "session"))
  );
  if (!memberAuth)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "member_sign_in_required",
    });
  return next({ ctx: { ...ctx, memberAuth } });
});
// tRPC wraps resolver errors before middleware returns, so sanitize at each operation boundary.
async function safely<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw publicMemberError(error);
  }
}
function sessionResult(
  res: Response,
  result: Awaited<ReturnType<typeof loginMember>> & { recoveryCode?: string }
) {
  setMemberCookie(res, result.token);
  return {
    member: result.member,
    ...(result.recoveryCode ? { recoveryCode: result.recoveryCode } : {}),
  };
}
async function limit(
  req: Request,
  action: "register" | "login" | "google" | "security",
  email?: string
) {
  const ip = memberClientKey(req);
  const buckets = [
    {
      key: `${action}:ip:${ip}`,
      limit: action === "register" ? 5 : action === "google" ? 30 : 10,
      windowMs: action === "register" || action === "google" ? 3600000 : 60000,
    },
    {
      key: `${action}:global`,
      limit: action === "register" ? 300 : 5000,
      windowMs: action === "register" ? 86400000 : 3600000,
    },
  ];
  if (email)
    buckets.push({
      key: `credential:email:${memberEmailKey(email)}`,
      limit: 10,
      windowMs: 900000,
    });
  await reserveMemberRequests(buckets);
}
async function emailLimit(req: Request, email: string) {
  await reserveMemberRequests([
    { key: `mail:ip:${memberClientKey(req)}`, limit: 5, windowMs: 3600000 },
    { key: `mail:email:${memberEmailKey(email)}`, limit: 3, windowMs: 3600000 },
    { key: "mail:requests:global", limit: 300, windowMs: 86400000 },
  ]);
}
export const memberRouter = router({
  emailPreferences: signedIn.input(z.object({ locale: memberLocale, marketingOptIn: z.boolean() }).strict()).mutation(({ ctx, input }) => safely(async () => {
    await limit(ctx.req, "security");
    return updateMemberEmailPreferences(ctx.memberAuth, input);
  })),
  requestVerification: signedIn.mutation(({ ctx }) => safely(async () => {
    await emailLimit(ctx.req, ctx.memberAuth.member.email);
    return requestEmailVerification(ctx.memberAuth);
  })),
  forgotPassword: memberPublic.input(z.object({ email: memberEmail }).strict()).mutation(({ ctx, input }) => safely(async () => {
    await emailLimit(ctx.req, input.email);
    return requestPasswordEmail(input.email);
  })),
  verifyEmail: memberPublic.input(z.object({ token: emailTokenInput }).strict()).mutation(({ ctx, input }) => safely(async () => {
    await limit(ctx.req, "security");
    return consumeMemberEmailToken(input.token, "verify");
  })),
  resetPassword: memberPublic.input(z.object({ token: emailTokenInput, newPassword: memberPassword }).strict()).mutation(({ ctx, input }) => safely(async () => {
    await limit(ctx.req, "security");
    const result = await consumeMemberEmailToken(input.token, "reset", input.newPassword);
    clearMemberCookie(ctx.res);
    return result;
  })),
  unsubscribe: memberPublic.input(z.object({ token: z.string().max(160) }).strict()).mutation(({ ctx, input }) => safely(async () => {
    await limit(ctx.req, "security");
    await unsubscribeMember(input.token); return { ok: true };
  })),
  me: memberPublic.query(({ ctx }) =>
    safely(async () => {
      const auth = await authenticateMemberSession(
        memberCookie(ctx.req, "session")
      );
      return {
        member: auth ? memberProfile(auth.member) : null,
        googleEnabled: googleAvailable(),
        emailEnabled: mailConfiguration().enabled,
      };
    })
  ),
  register: memberPublic.input(memberRegistration).mutation(({ ctx, input }) =>
    safely(async () => {
      await limit(ctx.req, "register", input.email);
      return sessionResult(ctx.res, await registerMember(input));
    })
  ),
  login: memberPublic.input(memberCredentials).mutation(({ ctx, input }) =>
    safely(async () => {
      await limit(ctx.req, "login", input.email);
      return sessionResult(
        ctx.res,
        await loginMember(input.email, input.password)
      );
    })
  ),
  recover: memberPublic.input(memberRecovery).mutation(({ ctx, input }) =>
    safely(async () => {
      await limit(ctx.req, "login", input.email);
      return sessionResult(ctx.res, await recoverMember(input));
    })
  ),
  logout: memberPublic
    .input(z.object({ all: z.boolean().default(false) }).strict())
    .mutation(({ ctx, input }) =>
      safely(async () => {
        await logoutMember(memberCookie(ctx.req, "session"), input.all);
        clearMemberCookie(ctx.res);
        return { ok: true };
      })
    ),
  updateName: signedIn
    .input(z.object({ name: z.string().trim().min(2).max(120) }).strict())
    .mutation(({ ctx, input }) =>
      safely(async () => {
        await limit(ctx.req, "security");
        return updateMemberName(ctx.memberAuth, input.name);
      })
    ),
  changePassword: signedIn
    .input(memberProof.extend({ newPassword: memberPassword }))
    .mutation(({ ctx, input }) =>
      safely(async () => {
        await limit(ctx.req, "security", ctx.memberAuth.member.email);
        return sessionResult(
          ctx.res,
          await changeMemberPassword(
            ctx.memberAuth,
            input.newPassword,
            input.currentPassword
          )
        );
      })
    ),
  recoveryCode: signedIn.input(memberProof).mutation(({ ctx, input }) =>
    safely(async () => {
      await limit(ctx.req, "security", ctx.memberAuth.member.email);
      return rotateMemberRecovery(ctx.memberAuth, input.currentPassword);
    })
  ),
  deleteAccount: signedIn
    .input(memberProof.extend({ confirm: z.literal(true) }))
    .mutation(({ ctx, input }) =>
      safely(async () => {
        await limit(ctx.req, "security", ctx.memberAuth.member.email);
        await deleteMember(ctx.memberAuth, input.currentPassword);
        clearMemberCookie(ctx.res);
        return { ok: true };
      })
    ),
  beginGoogle: memberPublic
    .input(memberGoogleStart)
    .mutation(({ ctx, input }) =>
      safely(async () => {
        await limit(ctx.req, "google");
        let link;
        if (input.mode === "link") {
          const auth = await authenticateMemberSession(
            memberCookie(ctx.req, "session")
          );
          if (!auth)
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "member_sign_in_required",
            });
          await limit(ctx.req, "security", auth.member.email);
          await requireMemberProof(auth, input.currentPassword);
          link = {
            memberId: auth.member.id,
            sessionHash: auth.session.tokenHash,
          };
        }
        return beginGoogle(ctx.res, {
          next: input.next,
          locale: input.locale,
          link,
        });
      })
    ),
});
