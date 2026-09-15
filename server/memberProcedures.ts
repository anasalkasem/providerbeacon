import { TRPCError } from "@trpc/server";
import { publicProcedure } from "./_core/trpc";
import { authenticateMemberSession } from "./memberDb";
import {
  assertMemberOrigin,
  memberCookie,
  publicMemberError,
} from "./memberSecurity";

export const memberPublic = publicProcedure.use(async ({ ctx, type, next }) => {
  ctx.res.setHeader("Cache-Control", "no-store");
  if (type === "mutation") assertMemberOrigin(ctx.req);
  try {
    return await next();
  } catch (error) {
    throw publicMemberError(error);
  }
});
export const signedIn = memberPublic.use(async ({ ctx, next }) => {
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
export async function safely<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw publicMemberError(error);
  }
}
