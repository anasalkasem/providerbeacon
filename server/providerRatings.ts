import { and, count, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { providerRatings as ratings } from "../drizzle/trustSchema";
import { memberAccounts as members } from "../drizzle/memberSchema";
import { providerBusinessAccounts as accounts } from "../drizzle/businessSchema";
import { providerRecords as providers } from "../drizzle/schema";
import { ratingWrite, ratingRemove } from "../shared/providerRatings";
import type { z } from "zod";
import { getDb } from "./db";
import { lockedAuth, type MemberAuth } from "./memberDb";
import { visibleCatalogueProvider } from "./apiCatalogue";
import { invalidateCatalogueCaches } from "./catalogueCache";

async function database() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "ratings_unavailable",
    });
  return db;
}
const validVoter = () =>
  and(
    eq(members.status, "active"),
    isNotNull(members.emailVerifiedAt),
    sql`not exists (select 1 from provider_business_accounts rating_owner where rating_owner.provider_id = provider_ratings.provider_id and rating_owner.owner_member_id = provider_ratings.member_id)`
  );

// One bounded grouped query for a catalogue page; never rely on legacy manual
// ratingBasisPoints/reviewCount or expose voter identities to visitors/providers.
export async function visitorRatingSummaries(providerIds: number[]) {
  if (!providerIds.length)
    return new Map<number, { rating: number; reviews: number }>();
  const db = await database();
  const rows = await db
    .select({
      providerId: ratings.providerId,
      reviews: count(),
      rating: sql<number>`round(avg(${ratings.stars}), 2)`.mapWith(Number),
    })
    .from(ratings)
    .innerJoin(members, eq(members.id, ratings.memberId))
    .where(and(inArray(ratings.providerId, providerIds), validVoter()))
    .groupBy(ratings.providerId);
  return new Map(
    rows.map(row => [
      row.providerId,
      { rating: row.rating, reviews: row.reviews },
    ])
  );
}
async function publicProvider(providerId: number) {
  const db = await database();
  const [provider] = await db
    .select({ id: providers.id })
    .from(providers)
    .where(and(eq(providers.id, providerId), visibleCatalogueProvider()))
    .limit(1);
  if (!provider)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "ratings_provider_missing",
    });
  return db;
}
export async function providerRatingSummary(providerId: number) {
  await publicProvider(providerId);
  return (
    (await visitorRatingSummaries([providerId])).get(providerId) ?? {
      rating: null,
      reviews: 0,
    }
  );
}
export async function ownProviderRating(auth: MemberAuth, providerId: number) {
  const db = await publicProvider(providerId);
  const [row] = await db
    .select({ stars: ratings.stars, revision: ratings.revision })
    .from(ratings)
    .where(
      and(
        eq(ratings.providerId, providerId),
        eq(ratings.memberId, auth.member.id)
      )
    )
    .limit(1);
  const [owner] = await db
    .select({ ownerId: accounts.ownerMemberId })
    .from(accounts)
    .where(eq(accounts.providerId, providerId))
    .limit(1);
  return { rating: row ?? null, isOwner: owner?.ownerId === auth.member.id };
}
export async function writeProviderRating(
  auth: MemberAuth,
  raw: z.infer<typeof ratingWrite> | z.infer<typeof ratingRemove>,
  remove = false
) {
  const input = remove ? ratingRemove.parse(raw) : ratingWrite.parse(raw);
  if (input.accountId !== auth.member.id)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "member_sign_in_required",
    });
  const db = await database();
  await db.transaction(async tx => {
    const member = await lockedAuth(tx, auth);
    if (!member.emailVerifiedAt)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "ratings_verify_email",
      });
    const [provider] = await tx
      .select({ id: providers.id })
      .from(providers)
      .where(
        and(eq(providers.id, input.providerId), visibleCatalogueProvider())
      )
      .for("update");
    if (!provider)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "ratings_provider_missing",
      });
    const [owner] = await tx
      .select({ ownerId: accounts.ownerMemberId })
      .from(accounts)
      .where(eq(accounts.providerId, input.providerId))
      .for("update");
    if (!remove && owner?.ownerId === member.id)
      throw new TRPCError({ code: "FORBIDDEN", message: "ratings_owner" });
    const filter = and(
      eq(ratings.providerId, input.providerId),
      eq(ratings.memberId, member.id)
    );
    const [before] = await tx
      .select()
      .from(ratings)
      .where(filter)
      .for("update");
    if ((before?.revision ?? 0) !== input.revision)
      throw new TRPCError({ code: "CONFLICT", message: "ratings_conflict" });
    if (remove) await tx.delete(ratings).where(filter);
    else {
      const stars = (input as z.infer<typeof ratingWrite>).stars;
      if (before)
        await tx
          .update(ratings)
          .set({ stars, revision: before.revision + 1 })
          .where(filter);
      else
        await tx
          .insert(ratings)
          .values({ providerId: input.providerId, memberId: member.id, stars });
    }
  });
  invalidateCatalogueCaches();
  return { ok: true };
}
