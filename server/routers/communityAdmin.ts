import {
  telegramPreviewInput,
  groupPreviewInput,
} from "../../shared/linkMetadata";
import { metadataBudget, previewLink, previewGroupLink } from "../linkMetadata";
import { z } from "zod";
import { permissionProcedure, router } from "../_core/trpc";
import { assertStaffOrigin } from "../staffOrigin";
import { safely } from "../memberProcedures";
import {
  groupEditInput,
  groupInput,
  groupReviewInput,
  groupStatuses,
} from "../../shared/community";
import {
  adminGroups,
  createGroup,
  editGroup,
  groupReports,
  resolveGroupReport,
  reviewGroup,
} from "../communityDb";

const guard = (permission: "groups.read" | "groups.review") =>
  permissionProcedure(permission).use(({ ctx, type, next }) => {
    ctx.res.setHeader("Cache-Control", "no-store");
    if (type === "mutation") assertStaffOrigin(ctx.req);
    return next();
  });
export const communityAdminRouter = router({
  previewGroup: guard("groups.review")
    .input(groupPreviewInput)
    .mutation(async ({ ctx, input }) => {
      await metadataBudget(`staff:${ctx.user!.id}`);
      return previewGroupLink(input.url);
    }),
  previewTelegram: guard("groups.review")
    .input(telegramPreviewInput)
    .mutation(async ({ ctx, input }) => {
      await metadataBudget(`staff:${ctx.user!.id}`);
      return previewLink("telegram", input.url);
    }),
  list: guard("groups.read")
    .input(
      z.object({
        status: z.enum(groupStatuses).optional(),
        reportsOnly: z.boolean().default(false),
        cursor: z.number().int().positive().optional(),
        q: z.string().trim().max(100).default(""),
      })
    )
    .query(({ input }) => safely(() => adminGroups(input))),
  create: guard("groups.review")
    .input(groupInput)
    .mutation(({ ctx, input }) =>
      safely(() => createGroup({ actorId: ctx.user!.id }, input))
    ),
  edit: guard("groups.review")
    .input(groupEditInput)
    .mutation(({ ctx, input }) =>
      safely(() => editGroup({ actorId: ctx.user!.id }, input))
    ),
  review: guard("groups.review")
    .input(groupReviewInput)
    .mutation(({ ctx, input }) =>
      safely(() => reviewGroup(ctx.user!.id, input))
    ),
  reports: guard("groups.read")
    .input(
      z.object({
        groupId: z.number().int().positive(),
        cursor: z.number().int().positive().optional(),
      })
    )
    .query(({ input }) =>
      safely(() => groupReports(input.groupId, input.cursor))
    ),
  resolveReport: guard("groups.review")
    .input(
      z
        .object({
          id: z.number().int().positive(),
          revision: z.number().int().positive(),
          note: z.string().trim().min(8).max(600),
        })
        .strict()
    )
    .mutation(({ ctx, input }) =>
      safely(() =>
        resolveGroupReport(ctx.user!.id, input.id, input.revision, input.note)
      )
    ),
});
