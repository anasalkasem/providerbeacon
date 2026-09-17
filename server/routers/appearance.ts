import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { resolveTeamRole } from "../authorization";
import { readSiteAppearance, updateSiteAppearance } from "../siteAppearance";
import { assertStaffOrigin } from "../staffOrigin";
import { siteThemeIds } from "../../shared/siteThemes";

const owner = protectedProcedure.use(async ({ ctx, type, next }) => {
  ctx.res.setHeader("Cache-Control", "no-store");
  if ((await resolveTeamRole(ctx.user)) !== "owner")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "appearance_owner_only",
    });
  if (type === "mutation") assertStaffOrigin(ctx.req);
  return next();
});

export const appearanceAdminRouter = router({
  get: owner.query(readSiteAppearance),
  update: owner
    .input(
      z
        .object({
          edgeGlowEnabled: z.boolean().optional(),
          theme: z.enum(siteThemeIds).optional(),
          revision: z.number().int().positive(),
        })
        .strict()
        .refine(
          input =>
            input.edgeGlowEnabled !== undefined || input.theme !== undefined,
          {
            message: "An appearance setting is required",
          }
        )
    )
    .mutation(({ ctx, input }) => updateSiteAppearance(ctx.user.id, input)),
});

export const appearanceRouter = router({
  public: publicProcedure.query(async ({ ctx }) => {
    ctx.res.setHeader("Cache-Control", "no-store");
    const { edgeGlowEnabled, theme } = await readSiteAppearance();
    return { edgeGlowEnabled, theme };
  }),
});
