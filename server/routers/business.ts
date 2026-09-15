import { z } from "zod";
import { router, publicProcedure, permissionProcedure } from "../_core/trpc";
import { signedIn, safely } from "../memberProcedures";
import { reserveMemberRequests } from "../memberDb";
import { assertStaffOrigin } from "../staffOrigin";
import { businessFail } from "../providerEntitlements";
import {
  businessMineInput,
  businessOwnedInput,
  businessProviderInput,
  businessQueueInput,
  claimProofInput,
  claimReviewInput,
  promotionEditInput,
  promotionInput,
  promotionReviewInput,
  promotionWithdrawInput,
  publicPromotionsInput,
  revokeOwnerInput,
  subscriptionInput,
} from "../../shared/providerBusiness";
import { groupInput, groupEditInput } from "../../shared/community";
import {
  adminBusinessAccount,
  businessAnalytics,
  businessGroups,
  businessWorkspace,
  ownPromotions,
  ownershipQueue,
  prepareOwnershipClaim,
  promotionQueue,
  publicPromotions,
  reviewOwnershipClaim,
  reviewPromotion,
  revokeBusinessOwner,
  savePromotion,
  setBusinessSubscription,
  submitOwnershipProof,
  withdrawPromotion,
} from "../providerBusinessDb";
import { createGroup, editGroup, withdrawGroup } from "../communityDb";

const write = (action: string, limit = 20) =>
  signedIn.use(async ({ ctx, next }) => {
    await safely(() =>
      reserveMemberRequests([
        {
          key: `business:${action}:${ctx.memberAuth.member.id}`,
          limit,
          windowMs: 3_600_000,
        },
      ])
    );
    return next();
  });
const ownRead = signedIn
  .input(businessMineInput.strip())
  .use(({ ctx, input, next }) => {
    if (input.accountId !== ctx.memberAuth.member.id)
      businessFail("owner_required", "FORBIDDEN");
    return next();
  });
const publicRead = publicProcedure.use(({ ctx, next }) => {
  ctx.res.setHeader("Cache-Control", "no-store");
  return next();
});
export const businessRouter = router({
  mine: ownRead.query(({ ctx }) =>
    safely(() => businessWorkspace(ctx.memberAuth))
  ),
  prepareClaim: write("claim", 5)
    .input(businessProviderInput)
    .mutation(({ ctx, input }) =>
      safely(() => prepareOwnershipClaim(ctx.memberAuth, input.providerId))
    ),
  submitProof: write("proof")
    .input(claimProofInput)
    .mutation(({ ctx, input }) =>
      safely(() => submitOwnershipProof(ctx.memberAuth, input))
    ),
  analytics: ownRead
    .input(
      businessOwnedInput.extend({
        days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
      })
    )
    .query(({ ctx, input }) =>
      safely(() =>
        businessAnalytics(ctx.memberAuth, input.providerId, input.days)
      )
    ),
  groups: router({
    mine: ownRead
      .input(businessOwnedInput)
      .query(({ ctx, input }) =>
        safely(() => businessGroups(ctx.memberAuth, input.providerId))
      ),
    submit: write("group", 5)
      .input(groupInput.extend({ providerId: z.number().int().positive() }))
      .mutation(({ ctx, input }) =>
        safely(() =>
          createGroup(
            { member: ctx.memberAuth, providerId: input.providerId },
            input
          )
        )
      ),
    edit: write("group")
      .input(groupEditInput.extend({ providerId: z.number().int().positive() }))
      .mutation(({ ctx, input }) =>
        safely(() =>
          editGroup(
            { member: ctx.memberAuth, providerId: input.providerId },
            input
          )
        )
      ),
    withdraw: write("group")
      .input(promotionWithdrawInput)
      .mutation(({ ctx, input }) =>
        safely(() =>
          withdrawGroup(
            ctx.memberAuth,
            input.id,
            input.revision,
            input.providerId
          )
        )
      ),
  }),
  promotions: router({
    list: publicRead
      .input(publicPromotionsInput)
      .query(({ input }) => safely(() => publicPromotions(input))),
    mine: ownRead
      .input(
        businessOwnedInput.extend({
          cursor: z.number().int().positive().optional(),
        })
      )
      .query(({ ctx, input }) =>
        safely(() =>
          ownPromotions(ctx.memberAuth, input.providerId, input.cursor)
        )
      ),
    submit: write("promotion")
      .input(promotionInput)
      .mutation(({ ctx, input }) =>
        safely(() => savePromotion(ctx.memberAuth, input))
      ),
    edit: write("promotion")
      .input(promotionEditInput)
      .mutation(({ ctx, input }) =>
        safely(() => savePromotion(ctx.memberAuth, input))
      ),
    withdraw: write("promotion")
      .input(promotionWithdrawInput)
      .mutation(({ ctx, input }) =>
        safely(() => withdrawPromotion(ctx.memberAuth, input))
      ),
  }),
});

const staff = (permission: "business.read" | "business.manage") =>
  permissionProcedure(permission).use(({ ctx, type, next }) => {
    ctx.res.setHeader("Cache-Control", "no-store");
    if (type === "mutation") assertStaffOrigin(ctx.req);
    return next();
  });
export const businessAdminRouter = router({
  account: staff("business.read")
    .input(businessProviderInput)
    .query(({ input }) => safely(() => adminBusinessAccount(input.providerId))),
  setSubscription: staff("business.manage")
    .input(subscriptionInput)
    .mutation(({ ctx, input }) =>
      safely(() => setBusinessSubscription(ctx.user!.id, input))
    ),
  revokeOwner: staff("business.manage")
    .input(revokeOwnerInput)
    .mutation(({ ctx, input }) =>
      safely(() => revokeBusinessOwner(ctx.user!.id, input))
    ),
  claims: staff("business.read")
    .input(businessQueueInput)
    .query(({ input }) => safely(() => ownershipQueue(input))),
  reviewClaim: staff("business.manage")
    .input(claimReviewInput)
    .mutation(({ ctx, input }) =>
      safely(() => reviewOwnershipClaim(ctx.user!.id, input))
    ),
  promotions: staff("business.read")
    .input(businessQueueInput)
    .query(({ input }) => safely(() => promotionQueue(input))),
  reviewPromotion: staff("business.manage")
    .input(promotionReviewInput)
    .mutation(({ ctx, input }) =>
      safely(() => reviewPromotion(ctx.user!.id, input))
    ),
});
