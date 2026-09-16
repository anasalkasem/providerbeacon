import {
  telegramPreviewInput,
  groupPreviewInput,
} from "../../shared/linkMetadata";
import { previewLink, previewGroupLink } from "../linkMetadata";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { safely, signedIn } from "../memberProcedures";
import { reserveMemberRequests } from "../memberDb";
import {
  createGroup,
  editGroup,
  groupProviders,
  ownGroups,
  publicGroups,
  reportGroup,
  withdrawGroup,
} from "../communityDb";
import {
  groupEditInput,
  groupInput,
  groupListInput,
  groupReportInput,
} from "../../shared/community";

const publicRead = publicProcedure.use(({ ctx, next }) => {
  ctx.res.setHeader("Cache-Control", "no-store");
  return next();
});
const write = (action: string, limit: number) =>
  signedIn.use(async ({ ctx, next }) => {
    await safely(() =>
      reserveMemberRequests([
        {
          key: `groups:${action}:${ctx.memberAuth.member.id}`,
          limit,
          windowMs: 3600000,
        },
      ])
    );
    return next();
  });
export const communityRouter = router({
  previewGroup: write("preview", 20)
    .input(groupPreviewInput)
    .mutation(({ input }) => safely(() => previewGroupLink(input.url))),
  previewTelegram: write("preview", 20)
    .input(telegramPreviewInput)
    .mutation(({ input }) => safely(() => previewLink("telegram", input.url))),
  list: publicRead
    .input(groupListInput)
    .query(({ input }) => safely(() => publicGroups(input))),
  providers: publicRead
    .input(z.object({ q: z.string().trim().max(100).default("") }))
    .query(({ input }) => safely(() => groupProviders(input.q))),
  mine: signedIn
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(({ ctx, input }) => {
      if (input.accountId !== ctx.memberAuth.member.id)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "member_sign_in_required",
        });
      return safely(() => ownGroups(ctx.memberAuth));
    }),
  submit: write("submit", 5)
    .input(groupInput)
    .mutation(({ ctx, input }) =>
      safely(() => createGroup({ member: ctx.memberAuth }, input))
    ),
  edit: write("edit", 20)
    .input(groupEditInput)
    .mutation(({ ctx, input }) =>
      safely(() => editGroup({ member: ctx.memberAuth }, input))
    ),
  withdraw: write("withdraw", 20)
    .input(
      z
        .object({
          id: z.number().int().positive(),
          revision: z.number().int().positive(),
        })
        .strict()
    )
    .mutation(({ ctx, input }) =>
      safely(() => withdrawGroup(ctx.memberAuth, input.id, input.revision))
    ),
  report: write("report", 10)
    .input(groupReportInput)
    .mutation(({ ctx, input }) =>
      safely(() => reportGroup(ctx.memberAuth, input))
    ),
});
