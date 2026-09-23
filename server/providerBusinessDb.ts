import { randomBytes } from "node:crypto";
import {
  and,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { z } from "zod";
import {
  providerBusinessAccounts as accounts,
  providerOwnershipClaims as claims,
  providerPromotions as promotions,
} from "../drizzle/businessSchema";
import { communityGroups } from "../drizzle/communitySchema";
import { memberAccounts } from "../drizzle/memberSchema";
import { providerRecords } from "../drizzle/schema";
import { importedMedia } from "../drizzle/linkMetadataSchema";
import { decodeVipCover } from "./providerVipDb";
import { memberAuthOrigin } from "./memberSecurity";
import {
  BUSINESS_DAY_MS,
  PROMOTIONS_PER_MONTH,
  planState,
  providerHost,
  providerOwnedUrl,
  providerOwnershipProofUrl,
  validPromotionDates,
  promotionCategories,
  type ownerPromotionInput,
  type publicPromotionsInput,
  type subscriptionInput,
  type claimProofInput,
  type claimReviewInput,
  type promotionInput,
  type promotionEditInput,
  type promotionReviewInput,
  type revokeOwnerInput,
} from "../shared/providerBusiness";
import { lockedAuth, type MemberAuth } from "./memberDb";
import { writeAudit } from "./marketplaceDb";
import { visibleCatalogueProvider } from "./apiCatalogue";
import {
  activeProviderPlan,
  businessDatabase,
  businessFail,
  lockedBusinessAccount,
  lockedBusinessProvider,
  lockedProviderOwner,
  type BusinessTransaction,
} from "./providerEntitlements";
import { getProviderAnalytics } from "./providerAnalyticsDb";
import {
  PROVIDER_PLAN,
  providerPlanPricing,
} from "../shared/providerBusinessPricing";

const claimFields = {
  id: claims.id,
  providerId: claims.providerId,
  token: claims.token,
  proofUrl: claims.proofUrl,
  status: claims.status,
  revision: claims.revision,
  reviewNote: claims.reviewNote,
  expiresAt: claims.expiresAt,
  websiteHost: claims.websiteHost,
};
async function audit(
  tx: BusinessTransaction,
  actorId: number | null,
  action: string,
  providerId: number,
  note: string,
  metadata: Record<string, unknown> = {}
) {
  await writeAudit(
    {
      actorUserId: actorId ?? undefined,
      action: `business.${action}`,
      entityType: "provider",
      entityId: String(providerId),
      summary: note,
      metadata,
    },
    tx
  );
}
async function verifiedMember(tx: BusinessTransaction, auth: MemberAuth) {
  const member = await lockedAuth(tx, auth);
  if (!member.emailVerifiedAt) businessFail("verify_email", "FORBIDDEN");
  return member;
}

export async function businessWorkspace(auth: MemberAuth) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const member = await lockedAuth(tx, auth);
    const owned = await tx
      .select({
        account: accounts,
        provider: {
          id: providerRecords.id,
          name: providerRecords.name,
          slug: providerRecords.slug,
          logoUrl: providerRecords.logoUrl,
          websiteUrl: providerRecords.websiteUrl,
          status: providerRecords.status,
          isReviewWorkspace: providerRecords.isReviewWorkspace,
        },
      })
      .from(accounts)
      .innerJoin(providerRecords, eq(providerRecords.id, accounts.providerId))
      .where(eq(accounts.ownerMemberId, member.id))
      .orderBy(accounts.providerId)
      .limit(10);
    const requests = await tx
      .select({
        ...claimFields,
        providerName: providerRecords.name,
        providerWebsite: providerRecords.websiteUrl,
      })
      .from(claims)
      .innerJoin(providerRecords, eq(providerRecords.id, claims.providerId))
      .where(eq(claims.memberId, member.id))
      .orderBy(desc(claims.id))
      .limit(10);
    return {
      providers: owned.map(({ account, provider }) => ({
        provider,
        subscription: {
          status: account.status,
          state: planState(account),
          startsAt: account.startsAt,
          endsAt: account.endsAt,
          firstActivatedAt: account.firstActivatedAt,
          pricing: providerPlanPricing(account.firstActivatedAt),
        },
        ownershipValid: Boolean(
          member.emailVerifiedAt &&
            provider.status === "active" &&
            account.ownershipVerifiedAt &&
            account.ownerHost === providerHost(provider.websiteUrl)
        ),
      })),
      claims: requests,
      promotionsPerMonth: PROMOTIONS_PER_MONTH,
      now: new Date(),
    };
  });
}

export async function prepareOwnershipClaim(
  auth: MemberAuth,
  providerId: number
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const member = await verifiedMember(tx, auth);
    const provider = await lockedBusinessProvider(tx, providerId);
    const host = providerHost(provider.websiteUrl);
    if (provider.isReviewWorkspace || provider.status !== "active" || !host)
      businessFail("provider_unavailable");
    const account = await lockedBusinessAccount(tx, providerId);
    if (account.ownerMemberId && account.ownerMemberId !== member.id)
      businessFail("claimed", "CONFLICT");
    const [existing] = await tx
      .select()
      .from(claims)
      .where(
        and(eq(claims.providerId, providerId), eq(claims.memberId, member.id))
      )
      .for("update");
    if (
      existing &&
      existing.websiteHost === host &&
      existing.expiresAt.getTime() > Date.now() &&
      ["draft", "pending"].includes(existing.status)
    )
      return { id: existing.id };
    if (
      account.ownerMemberId === member.id &&
      account.ownerHost === host &&
      account.ownershipVerifiedAt
    )
      businessFail("already_owner", "CONFLICT");
    if (!existing) {
      const [total] = await tx
        .select({ value: count() })
        .from(claims)
        .where(eq(claims.memberId, member.id));
      if (total.value >= 10) businessFail("claim_limit");
    }
    const values = {
      token: `providerbeacon-${randomBytes(24).toString("hex")}`,
      websiteHost: host,
      proofUrl: null,
      status: "draft" as const,
      revision: (existing?.revision ?? 0) + 1,
      reviewNote: null,
      reviewedAt: null,
      expiresAt: new Date(Date.now() + 7 * BUSINESS_DAY_MS),
    };
    let id = existing?.id;
    if (id) await tx.update(claims).set(values).where(eq(claims.id, id));
    else {
      const [row] = await tx
        .insert(claims)
        .values({ ...values, providerId, memberId: member.id })
        .$returningId();
      id = row.id;
    }
    await audit(
      tx,
      null,
      "claim.prepared",
      providerId,
      "Ownership challenge prepared",
      { memberId: member.id, claimId: id }
    );
    return { id };
  });
}

export async function submitOwnershipProof(
  auth: MemberAuth,
  input: z.infer<typeof claimProofInput>
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    await verifiedMember(tx, auth);
    const [identity] = await tx
      .select({ providerId: claims.providerId })
      .from(claims)
      .where(and(eq(claims.id, input.id), eq(claims.memberId, auth.member.id)));
    if (!identity) businessFail("missing", "NOT_FOUND");
    const provider = await lockedBusinessProvider(tx, identity.providerId);
    const [claim] = await tx
      .select()
      .from(claims)
      .where(eq(claims.id, input.id))
      .for("update");
    if (
      claim.revision !== input.revision ||
      !["draft", "pending"].includes(claim.status)
    )
      businessFail("changed", "CONFLICT");
    if (claim.expiresAt.getTime() <= Date.now()) businessFail("claim_expired");
    const proofUrl = providerOwnershipProofUrl(
      input.proofUrl,
      provider.websiteUrl
    );
    if (!proofUrl || claim.websiteHost !== providerHost(provider.websiteUrl))
      businessFail("proof_domain");
    await tx
      .update(claims)
      .set({
        proofUrl,
        status: "pending",
        revision: claim.revision + 1,
        reviewNote: null,
        reviewedAt: null,
      })
      .where(eq(claims.id, claim.id));
    await audit(
      tx,
      null,
      "claim.submitted",
      provider.id,
      "Ownership proof submitted for staff review",
      { memberId: auth.member.id, claimId: claim.id }
    );
    return { id: claim.id };
  });
}

export async function ownershipQueue(input: {
  pendingOnly: boolean;
  cursor?: number;
}) {
  const db = await businessDatabase();
  const rows = await db
    .select({
      ...claimFields,
      memberName: memberAccounts.name,
      memberEmail: memberAccounts.email,
      providerName: providerRecords.name,
      providerWebsite: providerRecords.websiteUrl,
    })
    .from(claims)
    .innerJoin(memberAccounts, eq(memberAccounts.id, claims.memberId))
    .innerJoin(providerRecords, eq(providerRecords.id, claims.providerId))
    .where(
      and(
        input.pendingOnly ? eq(claims.status, "pending") : undefined,
        input.cursor ? lt(claims.id, input.cursor) : undefined
      )
    )
    .orderBy(desc(claims.id))
    .limit(26);
  return {
    items: rows.slice(0, 25),
    nextCursor: rows.length > 25 ? rows[24].id : undefined,
  };
}

export async function reviewOwnershipClaim(
  actorId: number,
  input: z.infer<typeof claimReviewInput>
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const [identity] = await tx
      .select({ memberId: claims.memberId, providerId: claims.providerId })
      .from(claims)
      .where(eq(claims.id, input.id));
    if (!identity) businessFail("missing", "NOT_FOUND");
    // The member -> provider -> business account -> claim lock order matches member writes.
    const [member] = await tx
      .select({
        id: memberAccounts.id,
        status: memberAccounts.status,
        emailVerifiedAt: memberAccounts.emailVerifiedAt,
      })
      .from(memberAccounts)
      .where(eq(memberAccounts.id, identity.memberId))
      .for("update");
    const provider = await lockedBusinessProvider(tx, identity.providerId);
    const account = await lockedBusinessAccount(tx, provider.id);
    const [claim] = await tx
      .select()
      .from(claims)
      .where(eq(claims.id, input.id))
      .for("update");
    if (
      !claim ||
      claim.status !== "pending" ||
      claim.revision !== input.revision
    )
      businessFail("changed", "CONFLICT");
    if (input.decision === "approved") {
      if (!input.tokenConfirmed) businessFail("review_required");
      if (
        !member ||
        member.status !== "active" ||
        !member.emailVerifiedAt ||
        provider.status !== "active"
      )
        businessFail("provider_unavailable");
      if (claim.expiresAt.getTime() <= Date.now())
        businessFail("claim_expired");
      if (
        !claim.proofUrl ||
        !providerOwnershipProofUrl(claim.proofUrl, provider.websiteUrl) ||
        claim.websiteHost !== providerHost(provider.websiteUrl)
      )
        businessFail("proof_domain");
      if (account.ownerMemberId && account.ownerMemberId !== member.id)
        businessFail("claimed", "CONFLICT");
      const [owned] = await tx
        .select({ value: count() })
        .from(accounts)
        .where(eq(accounts.ownerMemberId, member.id));
      if (account.ownerMemberId !== member.id && owned.value >= 10)
        businessFail("claim_limit");
      await tx
        .update(accounts)
        .set({
          ownerMemberId: member.id,
          ownerHost: claim.websiteHost,
          ownershipVerifiedAt: new Date(),
          revision: account.revision + 1,
        })
        .where(eq(accounts.providerId, provider.id));
    }
    await tx
      .update(claims)
      .set({
        status: input.decision,
        revision: claim.revision + 1,
        reviewNote: input.note,
        reviewedAt: new Date(),
      })
      .where(eq(claims.id, claim.id));
    await audit(
      tx,
      actorId,
      `claim.${input.decision}`,
      provider.id,
      input.note,
      {
        claimId: claim.id,
        memberId: claim.memberId,
        tokenConfirmed: input.tokenConfirmed,
      }
    );
    return { id: claim.id };
  });
}

export async function adminBusinessAccount(providerId: number) {
  const db = await businessDatabase();
  const [provider] = await db
    .select({
      id: providerRecords.id,
      name: providerRecords.name,
      websiteUrl: providerRecords.websiteUrl,
    })
    .from(providerRecords)
    .where(eq(providerRecords.id, providerId));
  if (!provider) businessFail("missing", "NOT_FOUND");
  const [row] = await db
    .select({
      account: accounts,
      owner: {
        id: memberAccounts.id,
        name: memberAccounts.name,
        email: memberAccounts.email,
      },
    })
    .from(accounts)
    .leftJoin(memberAccounts, eq(memberAccounts.id, accounts.ownerMemberId))
    .where(eq(accounts.providerId, providerId));
  return {
    provider,
    owner: row?.owner ?? null,
    subscription: {
      status: row?.account.status ?? "inactive",
      startsAt: row?.account.startsAt ?? null,
      endsAt: row?.account.endsAt ?? null,
      firstActivatedAt: row?.account.firstActivatedAt ?? null,
      pricing: providerPlanPricing(row?.account.firstActivatedAt ?? null),
      state: planState(row?.account),
      revision: row?.account.revision ?? 0,
    },
    ownershipVerifiedAt: row?.account.ownershipVerifiedAt ?? null,
  };
}

export async function setBusinessSubscription(
  actorId: number,
  input: z.infer<typeof subscriptionInput>
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    await lockedBusinessProvider(tx, input.providerId);
    const [before] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.providerId, input.providerId));
    if ((before?.revision ?? 0) !== input.revision)
      businessFail("changed", "CONFLICT");
    if (
      input.status === "active" &&
      (!input.endsAt || input.endsAt.getTime() <= Date.now())
    )
      businessFail("invalid_dates");
    const account = await lockedBusinessAccount(tx, input.providerId);
    // Renewals, suspension, ownership changes and reactivation never restart
    // the introductory window. Clients cannot supply prices or its anchor.
    if (
      input.status === "active" &&
      account.firstActivatedAt &&
      input.startsAt &&
      input.startsAt < account.firstActivatedAt
    )
      businessFail("pricing_start_fixed");
    const firstActivatedAt =
      account.firstActivatedAt ??
      (input.status === "active" ? input.startsAt : null);
    await tx
      .update(accounts)
      .set({
        status: input.status,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        firstActivatedAt,
        revision: account.revision + 1,
      })
      .where(eq(accounts.providerId, input.providerId));
    await audit(
      tx,
      actorId,
      "subscription.updated",
      input.providerId,
      input.note,
      {
        method: "manual",
        previousStatus: account.status,
        status: input.status,
        startsAt: input.startsAt?.toISOString(),
        endsAt: input.endsAt?.toISOString(),
        planKey: PROVIDER_PLAN.key,
        currency: PROVIDER_PLAN.currency,
        firstActivatedAt: firstActivatedAt?.toISOString(),
        introEndsAt:
          providerPlanPricing(firstActivatedAt).introEndsAt?.toISOString(),
        introMonthlyCents: PROVIDER_PLAN.introMonthlyCents,
        monthlyCents: PROVIDER_PLAN.monthlyCents,
      }
    );
    return { providerId: input.providerId };
  });
}

export async function revokeBusinessOwner(
  actorId: number,
  input: z.infer<typeof revokeOwnerInput>
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    await lockedBusinessProvider(tx, input.providerId);
    const account = await lockedBusinessAccount(tx, input.providerId);
    if (account.revision !== input.revision || !account.ownerMemberId)
      businessFail("changed", "CONFLICT");
    await tx
      .update(accounts)
      .set({
        ownerMemberId: null,
        ownerHost: null,
        ownershipVerifiedAt: null,
        status: "suspended",
        revision: account.revision + 1,
      })
      .where(eq(accounts.providerId, input.providerId));
    await tx
      .update(claims)
      .set({
        status: "revoked",
        reviewNote: input.note,
        revision: sql`${claims.revision} + 1`,
      })
      .where(
        and(
          eq(claims.providerId, input.providerId),
          eq(claims.status, "approved")
        )
      );
    await audit(
      tx,
      actorId,
      "ownership.revoked",
      input.providerId,
      input.note,
      { previousMemberId: account.ownerMemberId, subscriptionSuspended: true }
    );
    return { providerId: input.providerId };
  });
}

export async function businessAnalytics(
  auth: MemberAuth,
  providerId: number,
  days: 7 | 30 | 90
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    await lockedProviderOwner(tx, auth, providerId);
    const now = Date.now();
    const current = await getProviderAnalytics(
      { providerId, days, page: 1 },
      now,
      tx
    );
    const previous = await getProviderAnalytics(
      { providerId, days, page: 1 },
      now - days * BUSINESS_DAY_MS,
      tx
    );
    return {
      ...current,
      previous: {
        from: previous.from,
        to: previous.to,
        totals: previous.totals,
        fullyMeasured: previous.daily.every(day => day.measured),
      },
    };
  });
}

export async function businessGroups(auth: MemberAuth, providerId: number) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    await lockedProviderOwner(tx, auth, providerId, false);
    return tx
      .select()
      .from(communityGroups)
      .where(eq(communityGroups.providerId, providerId))
      .orderBy(desc(communityGroups.id))
      .limit(20);
  });
}

// Owner-scoped operational totals, independent of list pagination. Analytics
// remain behind their separate paid entitlement; this response contains none.
export async function businessOverview(auth: MemberAuth, providerId: number) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const { provider } = await lockedProviderOwner(tx, auth, providerId, false);
    const now = new Date();
    const [visibility] = await tx
      .select({ id: providerRecords.id })
      .from(providerRecords)
      .where(
        and(
          eq(providerRecords.id, providerId),
          visibleCatalogueProvider(),
          activeProviderPlan(providerRecords.id)
        )
      );
    const groupRows = await tx
      .select({
        status: communityGroups.status,
        reviewedAt: communityGroups.reviewedAt,
      })
      .from(communityGroups)
      .where(eq(communityGroups.providerId, providerId));
    const [offerCounts] = await tx
      .select({
        total: count(),
        pending:
          sql<number>`coalesce(sum(${promotions.status} = 'pending'), 0)`.mapWith(
            Number
          ),
        rejected:
          sql<number>`coalesce(sum(${promotions.status} = 'rejected'), 0)`.mapWith(
            Number
          ),
      })
      .from(promotions)
      .where(eq(promotions.providerId, providerId));
    const currentOffers = visibility
      ? await tx
          .select({
            id: promotions.id,
            title: promotions.title,
            destinationUrl: promotions.destinationUrl,
            endsAt: promotions.endsAt,
          })
          .from(promotions)
          .where(
            and(
              eq(promotions.providerId, providerId),
              eq(promotions.status, "approved"),
              isNotNull(promotions.reviewedAt),
              lte(promotions.startsAt, now),
              gte(promotions.endsAt, now)
            )
          )
          .orderBy(promotions.endsAt)
      : [];
    const liveOffers = currentOffers.filter(
      offer =>
        offer.endsAt > now &&
        providerOwnedUrl(offer.destinationUrl, provider.websiteUrl)
    );
    const expiring = liveOffers.filter(
      offer => offer.endsAt.getTime() <= now.getTime() + 7 * BUSINESS_DAY_MS
    );
    return {
      groups: {
        total: groupRows.length,
        live: visibility
          ? groupRows.filter(g => g.status === "approved" && g.reviewedAt)
              .length
          : 0,
        pending: groupRows.filter(g => g.status === "pending").length,
        rejected: groupRows.filter(g => g.status === "rejected").length,
      },
      offers: {
        ...offerCounts,
        live: liveOffers.length,
        expiring: expiring.length,
        nextExpiry: expiring[0]
          ? { title: expiring[0].title, endsAt: expiring[0].endsAt }
          : null,
      },
      usage: await promotionUsage(tx, providerId),
      now,
    };
  });
}

async function promotionUsage(tx: BusinessTransaction, providerId: number) {
  const now = new Date();
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  const [usage] = await tx
    .select({ value: count() })
    .from(promotions)
    .where(
      and(
        eq(promotions.providerId, providerId),
        eq(promotions.placement, "subscription"),
        gte(promotions.createdAt, month),
        lt(promotions.createdAt, nextMonth)
      )
    );
  return {
    used: usage.value,
    limit: PROMOTIONS_PER_MONTH,
    resetsAt: nextMonth,
  };
}
export async function ownPromotions(
  auth: MemberAuth,
  providerId: number,
  cursor?: number
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    await lockedProviderOwner(tx, auth, providerId, false);
    const rows = await tx
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.providerId, providerId),
          eq(promotions.placement, "subscription"),
          cursor ? lt(promotions.id, cursor) : undefined
        )
      )
      .orderBy(desc(promotions.id))
      .limit(26);
    return {
      items: rows.slice(0, 25).map(withPromotionCover),
      nextCursor: rows.length > 25 ? rows[24].id : undefined,
      usage: await promotionUsage(tx, providerId),
    };
  });
}
const withPromotionCover = <T extends { coverId: string | null }>(row: T) => ({
  ...row,
  coverUrl: row.coverId
    ? `${memberAuthOrigin()}/api/imported-media/${row.coverId}`
    : "",
});
async function savePromotionCover(
  tx: BusinessTransaction,
  input: { cover?: string; removeCover?: boolean },
  previous: string | null = null
) {
  if (input.cover && input.removeCover) businessFail("vip_cover");
  if (input.removeCover) return null;
  if (!input.cover) return previous;
  const image = decodeVipCover(input.cover);
  await tx
    .insert(importedMedia)
    .values(image)
    .onDuplicateKeyUpdate({ set: { id: image.id } });
  return image.id;
}
function checkedPromotion(
  input: Omit<z.infer<typeof promotionInput>, "category"> & {
    category?: string;
  },
  websiteUrl: string | null
) {
  const destinationUrl = providerOwnedUrl(input.destinationUrl, websiteUrl);
  if (!destinationUrl) businessFail("destination_domain");
  if (!validPromotionDates(input.startsAt, input.endsAt))
    businessFail("invalid_dates");
  if (
    input.category &&
    !promotionCategories.includes(
      input.category as (typeof promotionCategories)[number]
    )
  )
    businessFail("invalid");
  return {
    title: input.title,
    description: input.description,
    couponCode: input.couponCode || null,
    destinationUrl,
    category: input.category ?? "all",
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  };
}
export async function savePromotion(
  auth: MemberAuth,
  input: z.infer<typeof promotionInput> | z.infer<typeof promotionEditInput>
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const { provider } = await lockedProviderOwner(tx, auth, input.providerId);
    const values = checkedPromotion(input, provider.websiteUrl);
    if ("id" in input) {
      const [row] = await tx
        .select()
        .from(promotions)
        .where(
          and(
            eq(promotions.id, input.id),
            eq(promotions.providerId, provider.id)
          )
        )
        .for("update");
      if (!row) businessFail("missing", "NOT_FOUND");
      if (row.placement !== "subscription")
        businessFail("owner_required", "FORBIDDEN");
      if (row.revision !== input.revision) businessFail("changed", "CONFLICT");
      const coverId = await savePromotionCover(tx, input, row.coverId);
      await tx
        .update(promotions)
        .set({
          ...values,
          coverId,
          status: "pending",
          reviewedAt: null,
          reviewNote: null,
          revision: row.revision + 1,
        })
        .where(eq(promotions.id, row.id));
      await audit(
        tx,
        null,
        "promotion.edited",
        provider.id,
        "Promotion resubmitted for review",
        { promotionId: row.id, memberId: auth.member.id }
      );
      return { id: row.id };
    }
    const usage = await promotionUsage(tx, provider.id);
    if (usage.used >= usage.limit) businessFail("promotion_limit");
    const coverId = await savePromotionCover(tx, input);
    const [row] = await tx
      .insert(promotions)
      .values({
        ...values,
        coverId,
        providerId: provider.id,
        createdByMemberId: auth.member.id,
      })
      .$returningId();
    await audit(
      tx,
      null,
      "promotion.submitted",
      provider.id,
      "Promotion submitted for review",
      { promotionId: row.id, memberId: auth.member.id }
    );
    return { id: row.id };
  });
}
export async function withdrawPromotion(
  auth: MemberAuth,
  input: { providerId: number; id: number; revision: number }
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    await lockedProviderOwner(tx, auth, input.providerId, false);
    const [row] = await tx
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.id, input.id),
          eq(promotions.providerId, input.providerId)
        )
      )
      .for("update");
    if (!row) businessFail("missing", "NOT_FOUND");
    if (row.placement !== "subscription")
      businessFail("owner_required", "FORBIDDEN");
    if (row.revision !== input.revision) businessFail("changed", "CONFLICT");
    await tx
      .update(promotions)
      .set({ status: "hidden", reviewedAt: null, revision: row.revision + 1 })
      .where(eq(promotions.id, row.id));
    await audit(
      tx,
      null,
      "promotion.withdrawn",
      input.providerId,
      "Promotion withdrawn by its provider",
      { promotionId: row.id, memberId: auth.member.id }
    );
    return { id: row.id };
  });
}
export async function promotionQueue(input: {
  pendingOnly: boolean;
  cursor?: number;
}) {
  const db = await businessDatabase();
  const rows = await db
    .select({
      promotion: promotions,
      providerName: providerRecords.name,
      providerWebsite: providerRecords.websiteUrl,
    })
    .from(promotions)
    .innerJoin(providerRecords, eq(providerRecords.id, promotions.providerId))
    .where(
      and(
        input.pendingOnly ? eq(promotions.status, "pending") : undefined,
        input.cursor ? lt(promotions.id, input.cursor) : undefined
      )
    )
    .orderBy(desc(promotions.id))
    .limit(26);
  return {
    items: rows
      .slice(0, 25)
      .map(row => ({ ...row, promotion: withPromotionCover(row.promotion) })),
    nextCursor: rows.length > 25 ? rows[24].promotion.id : undefined,
  };
}
export async function reviewPromotion(
  actorId: number,
  input: z.infer<typeof promotionReviewInput>
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const [identity] = await tx
      .select({ providerId: promotions.providerId })
      .from(promotions)
      .where(eq(promotions.id, input.id));
    if (!identity) businessFail("missing", "NOT_FOUND");
    const provider = await lockedBusinessProvider(tx, identity.providerId);
    const [row] = await tx
      .select()
      .from(promotions)
      .where(eq(promotions.id, input.id))
      .for("update");
    if (!row || row.revision !== input.revision)
      businessFail("changed", "CONFLICT");
    if (input.decision === "approved") {
      if (!input.destinationConfirmed) businessFail("review_required");
      if (provider.status !== "active") businessFail("provider_unavailable");
      checkedPromotion(
        { ...row, couponCode: row.couponCode ?? "" },
        provider.websiteUrl
      );
    }
    await tx
      .update(promotions)
      .set({
        status: input.decision,
        reviewNote: input.note,
        reviewedAt: input.decision === "approved" ? new Date() : null,
        revision: row.revision + 1,
      })
      .where(eq(promotions.id, row.id));
    await audit(
      tx,
      actorId,
      `promotion.${input.decision}`,
      provider.id,
      input.note,
      { promotionId: row.id }
    );
    return { id: row.id };
  });
}
export async function publicPromotions(
  input: z.infer<typeof publicPromotionsInput>
) {
  const db = await businessDatabase();
  const rows = await db
    .select({
      id: promotions.id,
      title: promotions.title,
      description: promotions.description,
      couponCode: promotions.couponCode,
      destinationUrl: promotions.destinationUrl,
      coverId: promotions.coverId,
      category: promotions.category,
      placement: promotions.placement,
      startsAt: promotions.startsAt,
      endsAt: promotions.endsAt,
      provider: {
        id: providerRecords.id,
        name: providerRecords.name,
        slug: providerRecords.slug,
      },
      website: providerRecords.websiteUrl,
    })
    .from(promotions)
    .innerJoin(providerRecords, eq(providerRecords.id, promotions.providerId))
    .where(
      and(
        eq(promotions.status, "approved"),
        isNotNull(promotions.reviewedAt),
        lte(promotions.startsAt, sql`current_timestamp(3)`),
        sql`${promotions.endsAt} > current_timestamp(3)`,
        or(
          eq(promotions.placement, "platform"),
          activeProviderPlan(providerRecords.id)
        ),
        visibleCatalogueProvider(),
        input.explorer ? eq(promotions.showInExplorer, true) : undefined,
        input.category && input.category !== "all"
          ? eq(promotions.category, input.category)
          : undefined,
        input.q
          ? sql`locate(lower(${input.q}), lower(concat(${promotions.title}, ' ', ${promotions.description}, ' ', ${providerRecords.name}))) > 0`
          : undefined,
        input.providerId
          ? eq(promotions.providerId, input.providerId)
          : undefined,
        input.cursor ? lt(promotions.id, input.cursor) : undefined
      )
    )
    .orderBy(desc(promotions.id))
    .limit(25);
  return {
    items: rows
      .slice(0, 24)
      .filter(row => providerOwnedUrl(row.destinationUrl, row.website))
      .map(({ website, ...row }) => withPromotionCover(row)),
    nextCursor: rows.length > 24 ? rows[23].id : undefined,
    now: new Date(),
  };
}

export async function saveOwnerPromotion(
  actorId: number,
  input: z.infer<typeof ownerPromotionInput>
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const provider = await lockedBusinessProvider(tx, input.providerId);
    if (provider.status !== "active" || provider.isReviewWorkspace)
      businessFail("provider_unavailable");
    const values = checkedPromotion(input, provider.websiteUrl);
    const [previous] = input.id
      ? await tx
          .select()
          .from(promotions)
          .where(eq(promotions.id, input.id))
          .for("update")
      : [];
    if (input.id && (!previous || previous.providerId !== input.providerId))
      businessFail("missing", "NOT_FOUND");
    if ((previous?.revision ?? 0) !== input.revision)
      businessFail("changed", "CONFLICT");
    const coverId = await savePromotionCover(tx, input, previous?.coverId);
    const value = {
      ...values,
      coverId,
      showInExplorer: input.showInExplorer,
      status: "pending" as const,
      reviewedAt: null,
      reviewNote: null,
      revision: input.revision + 1,
    };
    let id: number;
    if (previous) {
      await tx
        .update(promotions)
        .set(value)
        .where(eq(promotions.id, previous.id));
      id = previous.id;
    } else {
      const [created] = await tx
        .insert(promotions)
        .values({ ...value, providerId: provider.id, placement: "platform" })
        .$returningId();
      id = created.id;
    }
    await audit(tx, actorId, "promotion.owner_saved", provider.id, input.note, {
      promotionId: id,
      revision: value.revision,
    });
    return { id, revision: value.revision };
  });
}
