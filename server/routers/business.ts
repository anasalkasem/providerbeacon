import { z } from "zod";
import { reviewWorkspaceInput } from "../../shared/reviewWorkspace";
import {
  provisionReviewWorkspace,
  reviewWorkspaceState,
} from "../reviewWorkspaceDb";
import { router, publicProcedure, permissionProcedure } from "../_core/trpc";
import { signedIn, safely } from "../memberProcedures";
import { reserveMemberRequests } from "../memberDb";
import { assertStaffOrigin } from "../staffOrigin";
import {
  vipIdentityInput,
  vipListInput,
  vipReviewInput,
  vipSaveInput,
  vipGrantInput,
  vipRevokeGrantInput,
} from "../../shared/providerVip";
import {
  ownVipCard,
  publicVipCards,
  reviewVipCard,
  saveVipCard,
  vipAnalytics,
  vipReviewQueue,
  withdrawVipCard,
  vipGrantState,
  grantComplimentaryVip,
  revokeComplimentaryVip,
} from "../providerVipDb";
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
  ownerPromotionInput,
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
  businessOverview,
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
  saveOwnerPromotion,
  setBusinessSubscription,
  submitOwnershipProof,
  withdrawPromotion,
} from "../providerBusinessDb";
import { createGroup, editGroup, withdrawGroup } from "../communityDb";
import {
  checkoutInput,
  gatewaySettingsInput,
  paymentInput,
} from "../../shared/providerPayments";
import {
  adminPayments,
  applyReviewedPayment,
  closeReviewedPayment,
  cancelProviderCheckout,
  gatewaySettings,
  ownerPayment,
  ownerPayments,
  publicPaymentMethods,
  recheckProviderPayment,
  saveGatewaySettings,
  startProviderCheckout,
} from "../providerPaymentsDb";

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
  vip: router({
    list: publicRead
      .input(vipListInput)
      .query(({ input }) => safely(() => publicVipCards(input))),
    mine: ownRead
      .input(businessOwnedInput)
      .query(({ ctx, input }) =>
        safely(() => ownVipCard(ctx.memberAuth, input.providerId))
      ),
    submit: write("vip-submit", 10)
      .input(vipSaveInput)
      .mutation(({ ctx, input }) =>
        safely(() => saveVipCard(ctx.memberAuth, input))
      ),
    withdraw: write("vip-withdraw")
      .input(vipIdentityInput)
      .mutation(({ ctx, input }) =>
        safely(() => withdrawVipCard(ctx.memberAuth, input))
      ),
    analytics: ownRead
      .input(
        businessOwnedInput.extend({
          days: z
            .union([z.literal(7), z.literal(30), z.literal(90)])
            .default(30),
        })
      )
      .query(({ ctx, input }) =>
        safely(() => vipAnalytics(ctx.memberAuth, input.providerId, input.days))
      ),
  }),
  payments: router({
    methods: publicRead.query(() => safely(publicPaymentMethods)),
    list: ownRead
      .input(businessOwnedInput)
      .query(({ ctx, input }) =>
        safely(() => ownerPayments(ctx.memberAuth, input.providerId))
      ),
    status: ownRead
      .input(
        businessMineInput.extend({ paymentId: z.string().uuid() }).strict()
      )
      .query(({ ctx, input }) =>
        safely(() => ownerPayment(ctx.memberAuth, input.paymentId))
      ),
    checkout: write("checkout", 10)
      .input(checkoutInput)
      .mutation(({ ctx, input }) =>
        safely(() =>
          startProviderCheckout(ctx.memberAuth, input.providerId, input.gateway)
        )
      ),
    check: write("payment-check", 30)
      .input(paymentInput)
      .mutation(({ ctx, input }) =>
        safely(() => recheckProviderPayment(ctx.memberAuth, input.paymentId))
      ),
    cancel: write("payment-cancel", 10)
      .input(paymentInput)
      .mutation(({ ctx, input }) =>
        safely(() => cancelProviderCheckout(ctx.memberAuth, input.paymentId))
      ),
  }),
  mine: ownRead.query(({ ctx }) =>
    safely(() => businessWorkspace(ctx.memberAuth))
  ),
  overview: ownRead
    .input(businessOwnedInput)
    .query(({ ctx, input }) =>
      safely(() => businessOverview(ctx.memberAuth, input.providerId))
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
  reviewWorkspace: router({
    state: staff("business.read")
      .use(({ ctx, next }) => {
        if (ctx.teamRole !== "owner")
          businessFail("review_owner_only", "FORBIDDEN");
        return next();
      })
      .query(() => safely(reviewWorkspaceState)),
    provision: staff("business.manage")
      .use(({ ctx, next }) => {
        if (ctx.teamRole !== "owner")
          businessFail("review_owner_only", "FORBIDDEN");
        return next();
      })
      .input(reviewWorkspaceInput)
      .mutation(({ ctx, input }) =>
        safely(() => provisionReviewWorkspace(ctx.user!.id, input))
      ),
  }),
  vip: router({
    grantState: staff("business.read")
      .use(({ ctx, next }) => {
        if (ctx.teamRole !== "owner")
          businessFail("vip_owner_only", "FORBIDDEN");
        return next();
      })
      .input(businessProviderInput)
      .query(({ input }) => safely(() => vipGrantState(input.providerId))),
    grant: staff("business.manage")
      .use(({ ctx, next }) => {
        if (ctx.teamRole !== "owner")
          businessFail("vip_owner_only", "FORBIDDEN");
        return next();
      })
      .input(vipGrantInput)
      .mutation(({ ctx, input }) =>
        safely(() => grantComplimentaryVip(ctx.user!.id, input))
      ),
    revokeGrant: staff("business.manage")
      .use(({ ctx, next }) => {
        if (ctx.teamRole !== "owner")
          businessFail("vip_owner_only", "FORBIDDEN");
        return next();
      })
      .input(vipRevokeGrantInput)
      .mutation(({ ctx, input }) =>
        safely(() => revokeComplimentaryVip(ctx.user!.id, input))
      ),
    list: staff("business.read")
      .input(businessQueueInput)
      .query(({ input }) => safely(() => vipReviewQueue(input))),
    review: staff("business.manage")
      .input(vipReviewInput)
      .mutation(({ ctx, input }) =>
        safely(() => reviewVipCard(ctx.user!.id, input))
      ),
  }),
  payments: router({
    settings: staff("business.manage").query(() => safely(gatewaySettings)),
    saveSettings: staff("business.manage")
      .input(gatewaySettingsInput)
      .mutation(({ ctx, input }) =>
        safely(() => saveGatewaySettings(ctx.user!.id, input))
      ),
    list: staff("business.read")
      .input(z.object({ cursor: z.string().uuid().optional() }).strict())
      .query(({ input }) => safely(() => adminPayments(input.cursor))),
    applyReviewed: staff("business.manage")
      .input(
        paymentInput
          .extend({ note: z.string().trim().min(8).max(600) })
          .strict()
      )
      .mutation(({ ctx, input }) =>
        safely(() =>
          applyReviewedPayment(ctx.user!.id, input.paymentId, input.note)
        )
      ),
    closeReview: staff("business.manage")
      .input(
        paymentInput
          .extend({ note: z.string().trim().min(8).max(600) })
          .strict()
      )
      .mutation(({ ctx, input }) =>
        safely(() =>
          closeReviewedPayment(ctx.user!.id, input.paymentId, input.note)
        )
      ),
  }),
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
  savePromotion: staff("business.manage")
    .use(({ ctx, next }) => {
      if (ctx.teamRole !== "owner") businessFail("vip_owner_only", "FORBIDDEN");
      return next();
    })
    .input(ownerPromotionInput)
    .mutation(({ ctx, input }) =>
      safely(() => saveOwnerPromotion(ctx.user!.id, input))
    ),
  reviewPromotion: staff("business.manage")
    .input(promotionReviewInput)
    .mutation(({ ctx, input }) =>
      safely(() => reviewPromotion(ctx.user!.id, input))
    ),
});
