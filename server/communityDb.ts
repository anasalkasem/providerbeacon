import { savedGroupMetadata } from "./linkMetadata";
import type { GroupLinkMetadata } from "../shared/linkMetadata";
import { createHash } from "node:crypto";
import {
  and,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  like,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import {
  communityGroups as groups,
  communityReports as reports,
} from "../drizzle/communitySchema";
import { providerRecords } from "../drizzle/schema";
import {
  groupLink,
  providerGroupEvidence,
  type GroupInput,
  type groupEditInput,
  type groupListInput,
  type groupReportInput,
  type groupReviewInput,
} from "../shared/community";
import { searchPattern } from "../shared/catalogueQuery";
import { getDb } from "./db";
import { visibleCatalogueProvider } from "./apiCatalogue";
import { lockedAuth, type MemberAuth } from "./memberDb";
import { writeAudit } from "./marketplaceDb";
import { activeProviderPlan, lockedProviderOwner } from "./providerEntitlements";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Author = { member: MemberAuth; providerId?: number } | { actorId: number };
export async function communityDatabase() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "groups_unavailable",
    });
  return db;
}
function fail(
  message: string,
  code: "BAD_REQUEST" | "CONFLICT" | "NOT_FOUND" = "BAD_REQUEST"
): never {
  throw new TRPCError({ code, message: `groups_${message}` });
}
function duplicate(error: unknown): boolean {
  const e = error as { code?: string; cause?: unknown };
  return e?.code === "ER_DUP_ENTRY" || Boolean(e?.cause && duplicate(e.cause));
}
const paidGroupVisibility = () => or(
  and(eq(groups.requiresSubscription, false), isNull(groups.providerId)),
  and(isNotNull(groups.providerId), activeProviderPlan(sql`community_groups.provider_id`),
    sql`exists (select 1 from provider_records where provider_records.id = community_groups.provider_id and ${visibleCatalogueProvider()})`)
);
const published = () =>
  and(eq(groups.status, "approved"), isNotNull(groups.reviewedAt), paidGroupVisibility());
const ownColumns = {
  id: groups.id,
  name: groups.name,
  description: groups.description,
  url: groups.url,
  platform: groups.platform,
  topic: groups.topic,
  language: groups.language,
  providerId: groups.providerId,
  requiresSubscription: groups.requiresSubscription,
  evidenceUrl: groups.evidenceUrl,
  linkMetadata: groups.linkMetadata,
  status: groups.status,
  revision: groups.revision,
  reviewNote: groups.reviewNote,
  reviewedAt: groups.reviewedAt,
  createdAt: groups.createdAt,
};
// Explicit qualification is required in this correlated subquery. Drizzle's
// single-table SELECT projection unqualifies interpolated column objects,
// which would bind `id` to the inner report instead of the outer group.
const openReports =
  sql<number>`(select count(*) from community_reports group_report
  where group_report.group_id = community_groups.id and group_report.status = 'open')`.mapWith(
    Number
  );

export async function publicGroups(input: z.infer<typeof groupListInput>) {
  const db = await communityDatabase();
  const filter = and(
    published(),
    input.platform ? eq(groups.platform, input.platform) : undefined,
    input.topic ? eq(groups.topic, input.topic) : undefined,
    input.language ? eq(groups.language, input.language) : undefined,
    input.providerId ? eq(providerRecords.id, input.providerId) : undefined,
    input.q
      ? or(
          like(groups.name, searchPattern(input.q)),
          like(groups.description, searchPattern(input.q)),
          like(providerRecords.name, searchPattern(input.q))
        )
      : undefined
  );
  const association = and(
    eq(providerRecords.id, groups.providerId),
    visibleCatalogueProvider()
  );
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: groups.id,
        name: groups.name,
        description: groups.description,
        url: groups.url,
        platform: groups.platform,
        topic: groups.topic,
        language: groups.language,
        linkMetadata: groups.linkMetadata,
        reviewedAt: groups.reviewedAt,
        providerWebsite: providerRecords.websiteUrl,
        provider: {
          id: providerRecords.id,
          name: providerRecords.name,
          slug: providerRecords.slug,
        },
        evidenceUrl: sql<
          string | null
        >`case when ${providerRecords.id} is not null then ${groups.evidenceUrl} else null end`,
      })
      .from(groups)
      .leftJoin(providerRecords, association)
      .where(
        and(filter, input.cursor ? lt(groups.id, input.cursor) : undefined)
      )
      .orderBy(desc(groups.id))
      .limit(25),
    db
      .select({ total: count() })
      .from(groups)
      .leftJoin(providerRecords, association)
      .where(filter),
  ]);
  return {
    items: rows.slice(0, 24).map(({ providerWebsite, ...row }) => {
      const evidence =
        row.provider &&
        providerGroupEvidence(row.evidenceUrl ?? "", providerWebsite);
      return {
        ...row,
        provider: evidence ? row.provider : null,
        evidenceUrl: evidence || null,
      };
    }),
    total: totals[0].total,
    nextCursor: rows.length > 24 ? rows[23].id : undefined,
  };
}
export async function groupProviders(q: string) {
  const db = await communityDatabase();
  return db
    .select({ id: providerRecords.id, name: providerRecords.name })
    .from(providerRecords)
    .where(
      and(
        visibleCatalogueProvider(),
        q ? like(providerRecords.name, searchPattern(q)) : undefined
      )
    )
    .orderBy(providerRecords.name)
    .limit(30);
}
export async function ownGroups(auth: MemberAuth) {
  const db = await communityDatabase();
  return db.transaction(async tx => {
    await lockedAuth(tx, auth);
    return tx
      .select(ownColumns)
      .from(groups)
      .where(eq(groups.submittedBy, auth.member.id))
      .orderBy(desc(groups.id))
      .limit(10);
  });
}
async function checkedValues(tx: Transaction, input: GroupInput, existing?: { url: string; linkMetadata: GroupLinkMetadata | null }, authorizedProviderId?: number) {
  const link = groupLink(input.url);
  if (!link) fail("invalid_link");
  let evidenceUrl: string | null = null;
  if (input.providerId) {
    const [provider] = await tx
      .select({ website: providerRecords.websiteUrl })
      .from(providerRecords)
      .where(
        and(
          eq(providerRecords.id, input.providerId),
          or(
            visibleCatalogueProvider(),
            authorizedProviderId === input.providerId
              ? and(eq(providerRecords.isReviewWorkspace, true), eq(providerRecords.status, "active"))
              : undefined
          )
        )
      )
      .limit(1);
    if (!provider) fail("provider_unavailable");
    evidenceUrl = providerGroupEvidence(input.evidenceUrl, provider.website);
    if (!evidenceUrl) fail("evidence_required");
  }
  return {
    linkMetadata: input.metadataKey ? await savedGroupMetadata(input.metadataKey, input.url) : existing?.url === link.url ? existing.linkMetadata : null,
    name: input.name,
    description: input.description,
    topic: input.topic,
    language: input.language,
    ...link,
    urlKey: createHash("sha256").update(link.url).digest("hex"),
    providerId: input.providerId,
    evidenceUrl,
  };
}
async function authorCheck(tx: Transaction, author: Author) {
  if ("member" in author) {
    if (author.providerId) {
      await lockedProviderOwner(tx, author.member, author.providerId);
      return;
    }
    const account = await lockedAuth(tx, author.member);
    if (!account.emailVerifiedAt) fail("verify_email");
  }
}
async function audit(
  tx: Transaction,
  author: Author,
  id: number,
  action: string,
  revision: number
) {
  await writeAudit(
    {
      actorUserId: "actorId" in author ? author.actorId : undefined,
      action: `groups.${action}`,
      entityType: "community_group",
      entityId: String(id),
      summary: `Community group ${action}`,
      metadata: { revision, source: "member" in author ? "member" : "staff" },
    },
    tx
  );
}
export async function createGroup(author: Author, input: GroupInput) {
  const db = await communityDatabase();
  try {
    return await db.transaction(async tx => {
      await authorCheck(tx, author);
      if ("member" in author && author.providerId) {
        if (input.providerId !== author.providerId) fail("evidence_required");
        const [amount] = await tx.select({ total: count() }).from(groups).where(eq(groups.providerId, author.providerId));
        if (amount.total >= 20) fail("limit");
      }
      if ("member" in author) {
        const [amount] = await tx
          .select({ total: count() })
          .from(groups)
          .where(eq(groups.submittedBy, author.member.member.id));
        if (amount.total >= 10) fail("limit");
      }
      const values = await checkedValues(tx, input, undefined, "member" in author ? author.providerId : undefined);
      const [row] = await tx
        .insert(groups)
        .values({
          ...values,
          requiresSubscription: Boolean(input.providerId),
          submittedBy: "member" in author ? author.member.member.id : null,
        })
        .$returningId();
      await audit(tx, author, row.id, "submitted", 1);
      return { id: row.id };
    });
  } catch (error) {
    if (duplicate(error)) fail("duplicate", "CONFLICT");
    throw error;
  }
}
async function lockedGroup(
  tx: Transaction,
  id: number,
  revision: number,
  author?: Author
) {
  const [row] = await tx
    .select()
    .from(groups)
    .where(
      and(
        eq(groups.id, id),
        author && "member" in author
          ? author.providerId ? eq(groups.providerId, author.providerId) : eq(groups.submittedBy, author.member.member.id)
          : undefined
      )
    )
    .for("update");
  if (!row) fail("missing", "NOT_FOUND");
  if (row.revision !== revision) fail("changed", "CONFLICT");
  return row;
}
export async function editGroup(
  author: Author,
  input: z.infer<typeof groupEditInput>
) {
  const db = await communityDatabase();
  try {
    return await db.transaction(async tx => {
      await authorCheck(tx, author);
      const row = await lockedGroup(tx, input.id, input.revision, author);
      // Once a listing represents a provider, its submitter cannot remove that
      // association to turn an unpaid promotion into a free community entry.
      if ("member" in author && row.requiresSubscription && input.providerId !== row.providerId) fail("evidence_required");
      if ("member" in author && author.providerId && input.providerId !== author.providerId) fail("evidence_required");
      const values = await checkedValues(tx, input, row, "member" in author ? author.providerId : undefined);
      await tx
        .update(groups)
        .set({
          ...values,
          requiresSubscription: row.requiresSubscription || Boolean(input.providerId),
          revision: row.revision + 1,
          status: "pending",
          reviewNote: null,
          reviewedAt: null,
        })
        .where(eq(groups.id, row.id));
      await audit(tx, author, row.id, "edited", row.revision + 1);
      return { id: row.id };
    });
  } catch (error) {
    if (duplicate(error)) fail("duplicate", "CONFLICT");
    throw error;
  }
}
export async function withdrawGroup(
  auth: MemberAuth,
  id: number,
  revision: number,
  providerId?: number
) {
  const db = await communityDatabase();
  return db.transaction(async tx => {
    if (providerId) await lockedProviderOwner(tx, auth, providerId, false);
    else await lockedAuth(tx, auth);
    const row = await lockedGroup(tx, id, revision, { member: auth, providerId });
    await tx
      .update(groups)
      .set({
        status: "hidden",
        revision: row.revision + 1,
        reviewedAt: null,
        reviewNote: null,
      })
      .where(eq(groups.id, id));
    await audit(tx, { member: auth }, id, "withdrawn", row.revision + 1);
    return { id };
  });
}
export async function reviewGroup(
  actorId: number,
  input: z.infer<typeof groupReviewInput>
) {
  const db = await communityDatabase();
  return db.transaction(async tx => {
    const row = await lockedGroup(tx, input.id, input.revision);
    if (input.decision === "approved") {
      if (!input.groupConfirmed) fail("review_required");
      if (row.providerId && !input.providerConfirmed) fail("evidence_required");
      await checkedValues(tx, { ...row, evidenceUrl: row.evidenceUrl ?? "" });
    }
    await tx
      .update(groups)
      .set({
        status: input.decision,
        revision: row.revision + 1,
        reviewNote: input.note,
        reviewedAt: input.decision === "approved" ? new Date() : null,
      })
      .where(eq(groups.id, row.id));
    await audit(tx, { actorId }, row.id, input.decision, row.revision + 1);
    return { id: row.id };
  });
}
export async function reportGroup(
  auth: MemberAuth,
  input: z.infer<typeof groupReportInput>
) {
  const db = await communityDatabase();
  return db.transaction(async tx => {
    await authorCheck(tx, { member: auth });
    const [group] = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, input.id), published()))
      .for("update");
    if (!group) fail("missing", "NOT_FOUND");
    const [existing] = await tx
      .select()
      .from(reports)
      .where(
        and(eq(reports.groupId, input.id), eq(reports.memberId, auth.member.id))
      )
      .for("update");
    if (existing?.status === "open") return { recorded: true };
    if (existing)
      await tx
        .update(reports)
        .set({
          reason: input.reason,
          note: input.note,
          status: "open",
          createdAt: new Date(),
          resolvedAt: null,
          revision: existing.revision + 1,
        })
        .where(eq(reports.id, existing.id));
    else
      await tx.insert(reports).values({
        groupId: input.id,
        memberId: auth.member.id,
        reason: input.reason,
        note: input.note,
      });
    return { recorded: true };
  });
}
export async function adminGroups(input: {
  status?: typeof groups.$inferSelect.status;
  reportsOnly: boolean;
  cursor?: number;
  q: string;
}) {
  const db = await communityDatabase();
  const rows = await db
    .select({ ...ownColumns, openReports })
    .from(groups)
    .where(
      and(
        input.status ? eq(groups.status, input.status) : undefined,
        input.reportsOnly ? sql`${openReports} > 0` : undefined,
        input.cursor ? lt(groups.id, input.cursor) : undefined,
        input.q ? like(groups.name, searchPattern(input.q)) : undefined
      )
    )
    .orderBy(desc(groups.id))
    .limit(26);
  return {
    items: rows.slice(0, 25),
    nextCursor: rows.length > 25 ? rows[24].id : undefined,
  };
}
export async function groupReports(groupId: number, cursor?: number) {
  const db = await communityDatabase();
  const rows = await db
    .select({
      id: reports.id,
      groupId: reports.groupId,
      reason: reports.reason,
      note: reports.note,
      revision: reports.revision,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(
      and(
        eq(reports.groupId, groupId),
        eq(reports.status, "open"),
        cursor ? lt(reports.id, cursor) : undefined
      )
    )
    .orderBy(desc(reports.id))
    .limit(26);
  return {
    items: rows.slice(0, 25),
    nextCursor: rows.length > 25 ? rows[24].id : undefined,
  };
}
export async function resolveGroupReport(
  actorId: number,
  id: number,
  revision: number,
  note: string
) {
  const db = await communityDatabase();
  return db.transaction(async tx => {
    const [report] = await tx
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .for("update");
    if (!report) fail("missing", "NOT_FOUND");
    if (report.revision !== revision || report.status !== "open")
      fail("changed", "CONFLICT");
    await tx
      .update(reports)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        revision: revision + 1,
      })
      .where(eq(reports.id, id));
    await writeAudit(
      {
        actorUserId: actorId,
        action: "groups.report.resolved",
        entityType: "community_report",
        entityId: String(id),
        summary: note,
        metadata: { groupId: report.groupId, revision },
      },
      tx
    );
    return { id };
  });
}
