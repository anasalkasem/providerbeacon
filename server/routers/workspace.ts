import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { signedIn, safely } from "../memberProcedures";
import { reserveMemberRequests } from "../memberDb";
import {
  comparisonInput,
  targetInput,
  watchInput,
} from "../../shared/buyerWorkspace";
import {
  readWorkspace,
  removeWorkspaceItem,
  saveComparison,
  saveWatch,
  setWatchTarget,
  watchHistory,
  workspaceIds,
} from "../buyerWorkspace";

// Account ID is a cache partition, never authorization or an arbitrary owner selector.
const read = signedIn
  .input(z.object({ accountId: z.number().int().positive() }))
  .use(({ ctx, input, next }) => {
    if (input.accountId !== ctx.memberAuth.member.id)
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "member_sign_in_required",
      });
    return next();
  });
const write = signedIn.use(async ({ ctx, next }) => {
  await safely(() =>
    reserveMemberRequests([
      {
        key: `workspace:${ctx.memberAuth.member.id}`,
        limit: 40,
        windowMs: 60000,
      },
    ])
  );
  return next();
});
export const workspaceRouter = router({
  ids: read.query(({ ctx }) => safely(() => workspaceIds(ctx.memberAuth))),
  dashboard: read.query(({ ctx }) =>
    safely(() => readWorkspace(ctx.memberAuth))
  ),
  history: read
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      safely(() => watchHistory(ctx.memberAuth, input.id))
    ),
  watch: write
    .input(watchInput)
    .mutation(({ ctx, input }) =>
      safely(() => saveWatch(ctx.memberAuth, input))
    ),
  target: write
    .input(targetInput)
    .mutation(({ ctx, input }) =>
      safely(() => setWatchTarget(ctx.memberAuth, input))
    ),
  saveComparison: write
    .input(comparisonInput)
    .mutation(({ ctx, input }) =>
      safely(() => saveComparison(ctx.memberAuth, input))
    ),
  remove: write
    .input(
      z
        .object({
          id: z.number().int().positive(),
          kind: z.enum(["watch", "comparison"]),
        })
        .strict()
    )
    .mutation(({ ctx, input }) =>
      safely(() => removeWorkspaceItem(ctx.memberAuth, input.id, input.kind))
    ),
});
