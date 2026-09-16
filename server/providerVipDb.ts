import { createHash } from "node:crypto";
import { and, eq, gt, gte, isNotNull, lt, lte, or, sql } from "drizzle-orm";
import type { z } from "zod";
import {
  providerVipCards as cards,
  providerVipDaily as daily,
  providerVipDedupe as dedupe,
} from "../drizzle/vipSchema";
import { providerBusinessAccounts as accounts } from "../drizzle/businessSchema";
import { memberAccounts } from "../drizzle/memberSchema";
import { importedMedia } from "../drizzle/linkMetadataSchema";
import { providerRecords } from "../drizzle/schema";
import {
  VIP_COVER_BYTES,
  VIP_PAGE_SIZE,
  rotateVipCards,
  type vipSaveInput,
  type vipReviewInput,
  type vipListInput,
  type VipEvent,
  type vipGrantInput,
  type vipRevokeGrantInput,
} from "../shared/providerVip";
import { planIsActive, providerHost } from "../shared/providerBusiness";
import {
  ANALYTICS_DAY_MS,
  ANALYTICS_REPEAT_MS,
  analyticsDate,
  analyticsPeriod,
} from "../shared/providerAnalytics";
import {
  activeProviderPlan,
  businessDatabase,
  businessFail,
  lockedProviderOwner,
  lockedBusinessProvider,
  lockedBusinessAccount,
  type BusinessTransaction,
} from "./providerEntitlements";
import { visibleCatalogueProvider } from "./apiCatalogue";
import type { MemberAuth } from "./memberDb";
import { memberAuthOrigin } from "./memberSecurity";
import { writeAudit } from "./marketplaceDb";
import { safeImage } from "./linkMetadataParse";
import { reserveAnalyticsBudget } from "./providerAnalyticsDb";

function rasterDimensions(body: Buffer, mime: string): [number, number] | null {
  if (
    mime === "image/png" &&
    body.length >= 33 &&
    body.toString("ascii", 12, 16) === "IHDR"
  )
    return [body.readUInt32BE(16), body.readUInt32BE(20)];
  if (mime === "image/webp" && body.length >= 30) {
    const format = body.toString("ascii", 12, 16);
    if (format === "VP8X")
      return [body.readUIntLE(24, 3) + 1, body.readUIntLE(27, 3) + 1];
    if (format === "VP8L" && body[20] === 0x2f) {
      const bits = body.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    if (format === "VP8 " && body.toString("hex", 23, 26) === "9d012a")
      return [body.readUInt16LE(26) & 0x3fff, body.readUInt16LE(28) & 0x3fff];
  }
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 4 < body.length) {
      if (body[offset++] !== 0xff) return null;
      while (body[offset] === 0xff) offset++;
      const marker = body[offset++];
      if (marker === 0xda || marker === 0xd9 || offset + 2 > body.length)
        return null;
      const size = body.readUInt16BE(offset);
      if (size < 2 || offset + size > body.length) return null;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      )
        return size >= 8
          ? [body.readUInt16BE(offset + 5), body.readUInt16BE(offset + 3)]
          : null;
      offset += size;
    }
  }
  return null;
}
export function decodeVipCover(value: string) {
  const match =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value
    );
  if (!match) businessFail("vip_cover");
  const body = Buffer.from(match[2], "base64");
  const image = safeImage(body, match[1]);
  if (
    !image ||
    image.mime !== match[1] ||
    body.length > VIP_COVER_BYTES ||
    body.toString("base64") !== match[2]
  )
    businessFail("vip_cover");
  const size = rasterDimensions(body, image.mime);
  if (
    !size ||
    size.some(side => side < 1 || side > 4096) ||
    size[0] * size[1] > 16000000
  )
    businessFail("vip_cover");
  return {
    id: createHash("sha256").update(image.mime).update(body).digest("hex"),
    mime: image.mime,
    content: match[2],
    bytes: body.length,
  };
}
const coverUrl = (id: string) =>
  `${memberAuthOrigin()}/api/imported-media/${id}`;
const withCover = <T extends { coverId: string }>(row: T) => ({
  ...row,
  coverUrl: row.coverId ? coverUrl(row.coverId) : "",
});
async function audit(
  tx: BusinessTransaction,
  actorId: number | null,
  providerId: number,
  action: string,
  note: string,
  revision: number,
  metadata: Record<string, unknown> = {}
) {
  await writeAudit(
    {
      actorUserId: actorId ?? undefined,
      action: `business.vip.${action}`,
      entityType: "provider",
      entityId: String(providerId),
      summary: note,
      metadata: { ...metadata, revision },
    },
    tx
  );
}
function currentCard(tx: BusinessTransaction, providerId: number) {
  return tx
    .select()
    .from(cards)
    .where(eq(cards.providerId, providerId))
    .for("update");
}
export async function ownVipCard(auth: MemberAuth, providerId: number) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const { member } = await lockedProviderOwner(tx, auth, providerId, false);
    const [row] = await tx
      .select()
      .from(cards)
      .where(
        and(
          eq(cards.providerId, providerId),
          eq(cards.ownerMemberId, member.id)
        )
      );
    return row ? withCover(row) : null;
  });
}
export async function saveVipCard(
  auth: MemberAuth,
  input: z.infer<typeof vipSaveInput>
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const { member, provider } = await lockedProviderOwner(
      tx,
      auth,
      input.providerId
    );
    const [previous] = await currentCard(tx, input.providerId);
    const own = previous?.ownerMemberId === member.id ? previous : undefined;
    if ((own?.revision ?? 0) !== input.revision)
      businessFail("stale", "CONFLICT");
    const image = input.cover ? decodeVipCover(input.cover) : null;
    if (!image && !own) businessFail("vip_cover");
    if (image)
      await tx
        .insert(importedMedia)
        .values(image)
        .onDuplicateKeyUpdate({ set: { id: image.id } });
    const revision = (previous?.revision ?? 0) + 1;
    const value = {
      providerId: input.providerId,
      ownerMemberId: member.id,
      websiteHost: providerHost(provider.websiteUrl)!,
      tagline: input.tagline,
      specialties: input.specialties,
      coverId: image?.id ?? own!.coverId,
      placement: "subscription" as const,
      complimentaryEndsAt: null,
      offer: input.offer,
      offerEndsAt: input.offer ? input.offerEndsAt : null,
      status: "pending" as const,
      revision,
      reviewNote: null,
      reviewedAt: null,
    };
    await tx.insert(cards).values(value).onDuplicateKeyUpdate({ set: value });
    await audit(
      tx,
      null,
      input.providerId,
      "submitted",
      "VIP card submitted for review",
      revision
    );
    return { providerId: input.providerId, revision };
  });
}
export async function withdrawVipCard(
  auth: MemberAuth,
  input: { providerId: number; revision: number }
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const { member } = await lockedProviderOwner(
      tx,
      auth,
      input.providerId,
      false
    );
    const [row] = await currentCard(tx, input.providerId);
    if (!row || row.ownerMemberId !== member.id)
      businessFail("missing", "NOT_FOUND");
    if (row.revision !== input.revision) businessFail("stale", "CONFLICT");
    await tx
      .update(cards)
      .set({ status: "hidden", reviewedAt: null, revision: row.revision + 1 })
      .where(eq(cards.providerId, row.providerId));
    await audit(
      tx,
      null,
      row.providerId,
      "withdrawn",
      "Provider withdrew VIP card",
      row.revision + 1
    );
    return { providerId: row.providerId };
  });
}
export async function vipReviewQueue(input: {
  cursor?: number;
  pendingOnly: boolean;
}) {
  const db = await businessDatabase();
  const rows = await db
    .select({
      card: cards,
      name: providerRecords.name,
      slug: providerRecords.slug,
      logoUrl: providerRecords.logoUrl,
    })
    .from(cards)
    .innerJoin(providerRecords, eq(providerRecords.id, cards.providerId))
    .where(
      and(
        input.pendingOnly ? eq(cards.status, "pending") : undefined,
        input.cursor ? gte(cards.providerId, input.cursor) : undefined
      )
    )
    .orderBy(cards.providerId)
    .limit(21);
  return {
    items: rows
      .slice(0, 20)
      .map(row => ({ ...row, card: withCover(row.card) })),
    nextCursor: rows[20]?.card.providerId ?? null,
  };
}
export async function reviewVipCard(
  actorId: number,
  input: z.infer<typeof vipReviewInput>
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    // Provider -> account -> card is also the order used by owner writes.
    const provider = await lockedBusinessProvider(tx, input.providerId);
    const account = await lockedBusinessAccount(tx, input.providerId);
    const [row] = await currentCard(tx, input.providerId);
    if (!row || row.revision !== input.revision)
      businessFail("stale", "CONFLICT");
    if (row.placement === "complimentary")
      businessFail("vip_owner_only", "FORBIDDEN");
    if (input.decision === "approved") {
      if (row.status !== "pending" || !input.contentConfirmed)
        businessFail("review_required");
      const [owner] = await tx
        .select({ id: memberAccounts.id })
        .from(memberAccounts)
        .where(
          and(
            eq(memberAccounts.id, row.ownerMemberId ?? 0),
            eq(memberAccounts.status, "active"),
            isNotNull(memberAccounts.emailVerifiedAt)
          )
        );
      const [visible] = await tx
        .select({ id: providerRecords.id })
        .from(providerRecords)
        .where(
          and(eq(providerRecords.id, provider.id), visibleCatalogueProvider())
        );
      if (
        !owner ||
        !visible ||
        !account.ownershipVerifiedAt ||
        account.ownerMemberId !== row.ownerMemberId ||
        account.ownerHost !== row.websiteHost ||
        row.websiteHost !== providerHost(provider.websiteUrl)
      )
        businessFail("owner_required", "FORBIDDEN");
      if (!planIsActive(account))
        businessFail("subscription_required", "FORBIDDEN");
    }
    await tx
      .update(cards)
      .set({
        status: input.decision,
        revision: row.revision + 1,
        reviewedAt: input.decision === "approved" ? new Date() : null,
        reviewNote: input.note,
      })
      .where(eq(cards.providerId, row.providerId));
    await audit(
      tx,
      actorId,
      row.providerId,
      input.decision,
      input.note,
      row.revision + 1
    );
    return { providerId: row.providerId };
  });
}

export async function vipGrantState(providerId: number) {
  const db = await businessDatabase();
  const [provider] = await db
    .select({
      id: providerRecords.id,
      name: providerRecords.name,
      slug: providerRecords.slug,
      logoUrl: providerRecords.logoUrl,
      websiteUrl: providerRecords.websiteUrl,
      status: providerRecords.status,
    })
    .from(providerRecords)
    .where(eq(providerRecords.id, providerId));
  if (!provider) businessFail("missing", "NOT_FOUND");
  const [card] = await db
    .select()
    .from(cards)
    .where(eq(cards.providerId, providerId));
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.providerId, providerId));
  return {
    provider,
    card: card ? withCover(card) : null,
    paidCardActive: card?.placement === "subscription" && planIsActive(account),
  };
}

export async function grantComplimentaryVip(
  actorId: number,
  input: z.infer<typeof vipGrantInput>
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const provider = await lockedBusinessProvider(tx, input.providerId);
    const [visible] = await tx
      .select({ id: providerRecords.id })
      .from(providerRecords)
      .where(
        and(eq(providerRecords.id, provider.id), visibleCatalogueProvider())
      );
    const host = providerHost(provider.websiteUrl);
    if (!visible || !host) businessFail("provider_unavailable");
    // Read existing billing data only. A grant creates neither an account nor a
    // payment, and cannot replace a current subscriber's card.
    const [account] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.providerId, provider.id))
      .for("update");
    const [previous] = await currentCard(tx, provider.id);
    if ((previous?.revision ?? 0) !== input.revision)
      businessFail("stale", "CONFLICT");
    if (previous?.placement === "subscription" && planIsActive(account))
      businessFail("vip_paid_card", "CONFLICT");
    if (!input.contentConfirmed) businessFail("review_required");
    const image = input.cover ? decodeVipCover(input.cover) : null;
    if (image)
      await tx
        .insert(importedMedia)
        .values(image)
        .onDuplicateKeyUpdate({ set: { id: image.id } });
    const now = new Date();
    const endsAt = new Date(now.getTime() + input.durationDays * 86400000);
    const revision = (previous?.revision ?? 0) + 1;
    const value = {
      providerId: provider.id,
      ownerMemberId: null,
      websiteHost: host,
      tagline: input.tagline,
      specialties: [],
      coverId:
        image?.id ?? (previous?.websiteHost === host ? previous.coverId : ""),
      offer: "",
      offerEndsAt: null,
      placement: "complimentary" as const,
      complimentaryEndsAt: endsAt,
      status: "approved" as const,
      revision,
      reviewNote: input.note,
      reviewedAt: now,
    };
    await tx.insert(cards).values(value).onDuplicateKeyUpdate({ set: value });
    await audit(
      tx,
      actorId,
      provider.id,
      "complimentary.granted",
      input.note,
      revision,
      {
        endsAt: endsAt.toISOString(),
        durationDays: input.durationDays,
        previousPlacement: previous?.placement ?? null,
      }
    );
    return { providerId: provider.id, endsAt, revision };
  });
}

export async function revokeComplimentaryVip(
  actorId: number,
  input: z.infer<typeof vipRevokeGrantInput>
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    await lockedBusinessProvider(tx, input.providerId);
    const [row] = await currentCard(tx, input.providerId);
    if (!row || row.revision !== input.revision)
      businessFail("stale", "CONFLICT");
    if (row.placement !== "complimentary")
      businessFail("vip_paid_card", "CONFLICT");
    await tx
      .update(cards)
      .set({
        status: "hidden",
        reviewedAt: null,
        complimentaryEndsAt: new Date(),
        revision: row.revision + 1,
      })
      .where(eq(cards.providerId, input.providerId));
    await audit(
      tx,
      actorId,
      input.providerId,
      "complimentary.revoked",
      input.note,
      row.revision + 1
    );
    return { providerId: input.providerId };
  });
}

// Paid cards recheck the subscription and owner; platform grants recheck their
// explicit expiry. Neither kind changes provider scores or catalogue ordering.
export async function eligibleVipCards(
  tx: BusinessTransaction,
  providerId?: number
) {
  const rows = await tx
    .select({
      providerId: cards.providerId,
      revision: cards.revision,
      name: providerRecords.name,
      slug: providerRecords.slug,
      logoUrl: providerRecords.logoUrl,
      tagline: cards.tagline,
      specialties: cards.specialties,
      coverId: cards.coverId,
      offer: cards.offer,
      offerEndsAt: cards.offerEndsAt,
      endsAt: accounts.endsAt,
      placement: cards.placement,
      complimentaryEndsAt: cards.complimentaryEndsAt,
      websiteUrl: providerRecords.websiteUrl,
      websiteHost: cards.websiteHost,
      ownerHost: accounts.ownerHost,
    })
    .from(cards)
    .innerJoin(providerRecords, eq(providerRecords.id, cards.providerId))
    .leftJoin(accounts, eq(accounts.providerId, cards.providerId))
    .leftJoin(memberAccounts, eq(memberAccounts.id, cards.ownerMemberId))
    .where(
      and(
        providerId ? eq(cards.providerId, providerId) : undefined,
        eq(cards.status, "approved"),
        isNotNull(cards.reviewedAt),
        visibleCatalogueProvider(),
        or(
          and(
            eq(cards.placement, "complimentary"),
            gt(cards.complimentaryEndsAt, sql`current_timestamp(3)`)
          ),
          and(
            eq(cards.placement, "subscription"),
            activeProviderPlan(cards.providerId),
            eq(accounts.ownerMemberId, cards.ownerMemberId),
            isNotNull(accounts.ownershipVerifiedAt),
            eq(memberAccounts.status, "active"),
            isNotNull(memberAccounts.emailVerifiedAt)
          )
        )
      )
    )
    .orderBy(cards.providerId);
  return rows.filter(
    row =>
      (row.placement === "complimentary" ||
        row.websiteHost === row.ownerHost) &&
      row.websiteHost === providerHost(row.websiteUrl)
  );
}
export async function publicVipCards(input: z.infer<typeof vipListInput>) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    const now = Date.now();
    const rows = await eligibleVipCards(tx);
    const rotation = input.rotation ?? Math.floor(now / 60000);
    const pages = Math.max(1, Math.ceil(rows.length / VIP_PAGE_SIZE));
    const page = Math.min(input.page, pages);
    return {
      items: rotateVipCards(rows, rotation)
        .slice((page - 1) * VIP_PAGE_SIZE, page * VIP_PAGE_SIZE)
        .map(row => ({
          providerId: row.providerId,
          revision: row.revision,
          name: row.name,
          slug: row.slug,
          logoUrl: row.logoUrl,
          tagline: row.tagline,
          specialties: row.specialties,
          coverUrl: row.coverId ? coverUrl(row.coverId) : "",
          placement: row.placement,
          ownershipVerified: row.placement === "subscription",
          endsAt: (row.placement === "complimentary"
            ? row.complimentaryEndsAt
            : row.endsAt)!,
          offer:
            row.offerEndsAt && row.offerEndsAt.getTime() > now ? row.offer : "",
          offerEndsAt: row.offerEndsAt,
        })),
      total: rows.length,
      page,
      pages,
      rotation,
    };
  });
}
export async function recordVipEvent(
  input: VipEvent,
  keys: { visitorKey: string; clientKey: string },
  now = Date.now()
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    if (!(await reserveAnalyticsBudget(tx, keys, now))) return "limited";
    const [card] = await eligibleVipCards(tx, input.providerId);
    if (!card || card.revision !== input.revision) return "ignored";
    let changed = false;
    // A trusted click also confirms a visible card, including clicks within one second.
    for (const kind of input.kind === "click"
      ? (["impression", "click"] as const)
      : (["impression"] as const)) {
      const identity = {
        providerId: input.providerId,
        visitorKey: keys.visitorKey,
        kind,
      };
      const condition = and(
        eq(dedupe.providerId, identity.providerId),
        eq(dedupe.visitorKey, identity.visitorKey),
        eq(dedupe.kind, kind)
      );
      await tx
        .insert(dedupe)
        .values({
          ...identity,
          lastCountedAt: new Date(now - ANALYTICS_REPEAT_MS),
          expiresAt: new Date(
            (Math.floor(now / ANALYTICS_DAY_MS) + 2) * ANALYTICS_DAY_MS
          ),
        })
        .onDuplicateKeyUpdate({ set: { kind } });
      const [previous] = await tx
        .select()
        .from(dedupe)
        .where(condition)
        .for("update");
      if (previous.lastCountedAt.getTime() > now - ANALYTICS_REPEAT_MS)
        continue;
      await tx
        .update(dedupe)
        .set({ lastCountedAt: new Date(now) })
        .where(condition);
      const counts = {
        impressions: kind === "impression" ? 1 : 0,
        clicks: kind === "click" ? 1 : 0,
      };
      await tx
        .insert(daily)
        .values({
          providerId: input.providerId,
          day: analyticsDate(now),
          ...counts,
        })
        .onDuplicateKeyUpdate({
          set: {
            impressions: sql`${daily.impressions} + ${counts.impressions}`,
            clicks: sql`${daily.clicks} + ${counts.clicks}`,
          },
        });
      changed = true;
    }
    return changed ? "counted" : "duplicate";
  });
}
export async function vipAnalytics(
  auth: MemberAuth,
  providerId: number,
  days: 7 | 30 | 90
) {
  const db = await businessDatabase();
  return db.transaction(async tx => {
    await lockedProviderOwner(tx, auth, providerId);
    const period = analyticsPeriod(days, Date.now());
    const [totals] = await tx
      .select({
        impressions:
          sql<number>`coalesce(sum(${daily.impressions}), 0)`.mapWith(Number),
        clicks: sql<number>`coalesce(sum(${daily.clicks}), 0)`.mapWith(Number),
      })
      .from(daily)
      .where(
        and(
          eq(daily.providerId, providerId),
          gte(daily.day, period.start),
          lte(daily.day, period.end)
        )
      );
    return {
      ...totals,
      from: period.start,
      to: period.end,
      collectionEnabled: Boolean(process.env.AUTH_PEPPER),
    };
  });
}
export async function cleanupVipAnalytics(now = Date.now()) {
  const db = await businessDatabase();
  await db
    .delete(dedupe)
    .where(lte(dedupe.expiresAt, new Date(now)))
    .limit(10000);
  await db
    .delete(daily)
    .where(lt(daily.day, analyticsDate(now - 400 * ANALYTICS_DAY_MS)))
    .limit(10000);
}
