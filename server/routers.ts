import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { adminRouter } from "./routers/admin";
import { marketplaceRouter } from "./routers/marketplace";
import { writeAudit } from "./marketplaceDb";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      if (ctx.user) {
        try {
          await writeAudit({ actorUserId: ctx.user.id, action: "auth.logout", entityType: "user", entityId: String(ctx.user.id), summary: "User signed out" });
        } catch (error) {
          console.warn("[Audit] Failed to record logout:", error);
        }
      }
      return {
        success: true,
      } as const;
    }),
  }),
  marketplace: marketplaceRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
