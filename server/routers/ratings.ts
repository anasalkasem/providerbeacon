import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { memberPublic, safely, signedIn } from "../memberProcedures";
import { reserveMemberRequests } from "../memberDb";
import {
  ownProviderRating,
  providerRatingSummary,
  writeProviderRating,
} from "../providerRatings";
import {
  ratingReference,
  ratingWrite,
  ratingRemove,
} from "../../shared/providerRatings";

const write = signedIn.use(async ({ ctx, next }) => {
  await safely(() =>
    reserveMemberRequests([
      {
        key: `rating-write:${ctx.memberAuth.member.id}`,
        limit: 20,
        windowMs: 3600000,
      },
    ])
  );
  return next();
});
export const ratingsRouter = router({
  summary: memberPublic
    .input(z.object({ providerId: z.number().int().positive() }).strict())
    .query(({ input }) =>
      safely(() => providerRatingSummary(input.providerId))
    ),
  mine: signedIn.input(ratingReference.strict()).query(({ ctx, input }) => {
    if (input.accountId !== ctx.memberAuth.member.id)
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "member_sign_in_required",
      });
    return safely(() => ownProviderRating(ctx.memberAuth, input.providerId));
  }),
  save: write
    .input(ratingWrite)
    .mutation(({ ctx, input }) =>
      safely(() => writeProviderRating(ctx.memberAuth, input))
    ),
  remove: write
    .input(ratingRemove)
    .mutation(({ ctx, input }) =>
      safely(() => writeProviderRating(ctx.memberAuth, input, true))
    ),
});
