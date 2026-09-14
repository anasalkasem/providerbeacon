import { AsyncResultCache, registerCatalogueCache } from "./catalogueCache";
import { and, count, desc, eq, gt, like, lt, or, sql, type SQL } from "drizzle-orm";
import { auditEntries, providerRecords, providerIntegrations, providerSyncJobs, serviceRecords, teamMembers } from "../drizzle/schema";
import { adminServicesInput, searchPattern, type AdminServicesInput } from "../shared/catalogueQuery";
import { getDb } from "./db";
import type { Permission } from "./authorization";
import { catalogueViewFilter, reviewNeedFilter } from "./catalogueRules";
import { reviewNeeds, type ReviewNeed } from "../shared/serviceReview";
import { isStale, reviewBlockers } from "./serviceNormalizer";

const summaryCache = new AsyncResultCache<Awaited<ReturnType<typeof getServiceReviewSummary>>>(10_000, 64);
const overviewCache = new AsyncResultCache<Awaited<ReturnType<typeof getAdminOverview>>>(10_000, 16);
registerCatalogueCache(() => { summaryCache.clear(); overviewCache.clear(); });
export function getCachedServiceReviewSummary(raw?: Partial<AdminServicesInput>) {
  const { cursor, need, limit, ...filters } = adminServicesInput.parse(raw);
  return summaryCache.get(JSON.stringify(filters), () => getServiceReviewSummary(filters));
}
export function getCachedAdminOverview(permissions: readonly Permission[]) {
  return overviewCache.get(JSON.stringify([...permissions].sort()), () => getAdminOverview(permissions));
}

function adminServiceFilter(input: AdminServicesInput) {
  return and(
    catalogueViewFilter(input.view),
    input.countryCode ? eq(serviceRecords.countryCode, input.countryCode) : undefined,
    input.providerId ? eq(serviceRecords.providerId, input.providerId) : undefined,
    input.status ? eq(serviceRecords.status, input.status) : undefined,
    input.platform ? eq(serviceRecords.platform, input.platform) : undefined,
    input.q ? or(like(serviceRecords.name, searchPattern(input.q)), like(serviceRecords.externalId, searchPattern(input.q)),
      like(providerRecords.name, searchPattern(input.q)), like(serviceRecords.category, searchPattern(input.q))) : undefined,
  );
}

export async function getServiceReviewSummary(raw?: Partial<AdminServicesInput>) {
  const input = adminServicesInput.parse(raw);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = Date.now();
  const counters = Object.fromEntries(reviewNeeds.map(need => [
    need, sql<number>`coalesce(sum(${reviewNeedFilter(need, now)}), 0)`.mapWith(Number),
  ])) as Record<ReviewNeed, SQL<number>>;
  // Counts reflect search/platform/country/status/view filters, never the
  // selected need or current page. Categories overlap and remain navigable.
  const [summary] = await db.select({ total: count(), ...counters }).from(serviceRecords)
    .innerJoin(providerRecords, eq(serviceRecords.providerId, providerRecords.id))
    .where(adminServiceFilter(input));
  return summary;
}

export async function listAdminServices(raw?: Partial<AdminServicesInput>) {
  const input = adminServicesInput.parse(raw);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = Date.now();
  const filter = and(adminServiceFilter(input), reviewNeedFilter(input.need, now));
  const [rows, totals] = await Promise.all([
    db.select({
      id: serviceRecords.id, providerId: serviceRecords.providerId, providerName: providerRecords.name,
      providerStatus: providerRecords.status, name: serviceRecords.name, externalId: serviceRecords.externalId,
      platform: serviceRecords.platform, category: serviceRecords.category, status: serviceRecords.status,
      priceAmount: serviceRecords.priceAmount,
      priceCurrency: serviceRecords.priceCurrency, priceUnit: serviceRecords.priceUnit,
      packageDescription: serviceRecords.packageDescription, quality: serviceRecords.quality,
      updatedAt: serviceRecords.updatedAt, countryCode: serviceRecords.countryCode, reviewStatus: serviceRecords.reviewStatus,
      revision: serviceRecords.revision, incomplete: serviceRecords.incomplete, available: serviceRecords.available,
      sourceUpdatedAt: serviceRecords.sourceUpdatedAt, priceCheckedAt: serviceRecords.priceCheckedAt,
      lastPriceChangeAt: serviceRecords.lastPriceChangeAt, pricingConfirmed: serviceRecords.pricingConfirmed,
      reviewFields: {
        minOrder: serviceRecords.minOrder, maxOrder: serviceRecords.maxOrder,
        policyReviewed: serviceRecords.policyReviewed, normalizationVersion: serviceRecords.normalizationVersion,
        hasEvidence: sql<number>`(${serviceRecords.evidenceUrl} is not null and char_length(${serviceRecords.evidenceUrl}) > 0)`.mapWith(Number),
      },
    }).from(serviceRecords).innerJoin(providerRecords, eq(serviceRecords.providerId, providerRecords.id))
      .where(and(filter, input.cursor ? lt(serviceRecords.id, input.cursor) : undefined))
      .orderBy(desc(serviceRecords.id)).limit(input.limit + 1),
    db.select({ total: count() }).from(serviceRecords).innerJoin(providerRecords, eq(serviceRecords.providerId, providerRecords.id)).where(filter),
  ]);
  const items = rows.slice(0, input.limit).map(({ reviewFields, ...row }) => {
    const blockers = reviewBlockers({ ...row, ...reviewFields, evidenceUrl: reviewFields.hasEvidence ? "retained" : null });
    const stale = isStale(row, now);
    const canApprove = blockers.length === 0 && !stale;
    const canPublish = canApprove && row.reviewStatus === "approved" && row.providerStatus === "active" && !["paused", "archived"].includes(row.status);
    return { ...row, blockers, stale, canApprove, canPublish };
  });
  return { items, total: totals[0]?.total ?? 0, nextCursor: rows.length > input.limit ? items.at(-1)!.id : null };
}

export async function getAdminOverview(permissions: readonly Permission[]) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  // Each aggregate has the same server-side permission boundary as its corresponding list.
  const [providers, services, published, team, audit, operations] = await Promise.all([
    permissions.includes("providers.read") ? db.select({ total: count() }).from(providerRecords).where(eq(providerRecords.verified, true)) : [],
    permissions.includes("services.read") ? db.select({ total: count() }).from(serviceRecords) : [],
    permissions.includes("services.read") ? db.select({ total: count() }).from(serviceRecords)
      .innerJoin(providerRecords, eq(providerRecords.id, serviceRecords.providerId))
      .where(catalogueViewFilter("published")) : [],
    permissions.includes("team.read") ? db.select({ total: count() }).from(teamMembers) : [],
    permissions.includes("audit.read") ? db.select({ total: count() }).from(auditEntries) : [],
    permissions.includes("services.read") ? db.select({
      pending: sql<number>`coalesce(sum(${serviceRecords.reviewStatus} = 'pending'), 0)`.mapWith(Number),
      approved: sql<number>`coalesce(sum(${serviceRecords.reviewStatus} = 'approved'), 0)`.mapWith(Number),
      changesRequested: sql<number>`coalesce(sum(${serviceRecords.reviewStatus} = 'changes_requested'), 0)`.mapWith(Number),
      incomplete: sql<number>`coalesce(sum(${serviceRecords.incomplete} = true), 0)`.mapWith(Number),
      stale: sql<number>`coalesce(sum(${catalogueViewFilter("stale")}), 0)`.mapWith(Number),
      priceChanged: sql<number>`coalesce(sum(${catalogueViewFilter("price_changed")}), 0)`.mapWith(Number),
      missing: sql<number>`coalesce(sum(${serviceRecords.available} = false), 0)`.mapWith(Number),
      normalizationPending: sql<number>`coalesce(sum(${serviceRecords.normalizationVersion} = 0), 0)`.mapWith(Number),
    }).from(serviceRecords) : [],
  ]);
  return { verifiedProviders: providers[0]?.total ?? null, totalServices: services[0]?.total ?? null,
    publishedServices: published[0]?.total ?? null, teamMembers: team[0]?.total ?? null, recordedActions: audit[0]?.total ?? null, operations: operations[0] ?? null };
}

export async function getProviderForAnalysis(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [provider] = await db.select().from(providerRecords).where(eq(providerRecords.id, id)).limit(1);
  return provider;
}

export async function listSyncAlerts() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const overdueBefore = new Date(Date.now() - 3600000);
  // A queued, incomplete or failed retry must not hide the last completed
  // snapshot's quarantine. Match the current provider/endpoint after edits.
  // The existing (integrationId, id) index supports this newest-first lookup.
  const lastCompleted = eq(
    providerSyncJobs.id,
    sql`(
    select recent.id from provider_sync_jobs recent
    where recent.integrationId = ${providerIntegrations.id}
      and recent.providerId = ${providerIntegrations.providerId}
      and recent.sourceUrl = ${providerIntegrations.baseUrl}
      and recent.status in ('completed', 'completed_with_issues')
    order by recent.id desc limit 1
  )`
  );
  const filter = or(
    gt(providerIntegrations.consecutiveFailures, 0),
    eq(providerIntegrations.status, "error"),
    and(
      eq(providerIntegrations.status, "active"),
      lt(providerIntegrations.nextSyncAt, overdueBefore)
    ),
    gt(providerSyncJobs.invalidCount, 0)
  );
  const [items, totals] = await Promise.all([
    db
      .select({
        id: providerIntegrations.id,
        providerId: providerIntegrations.providerId,
        providerName: providerRecords.name,
        name: providerIntegrations.name,
        failures: providerIntegrations.consecutiveFailures,
        lastError: providerIntegrations.lastError,
        lastSyncedAt: providerIntegrations.lastSyncedAt,
        nextSyncAt: providerIntegrations.nextSyncAt,
        status: providerIntegrations.status,
        sourceIssues: {
          jobId: providerSyncJobs.id,
          count: providerSyncJobs.invalidCount,
          completedAt: providerSyncJobs.finishedAt,
        },
      })
      .from(providerIntegrations)
      .innerJoin(
        providerRecords,
        eq(providerRecords.id, providerIntegrations.providerId)
      )
      .leftJoin(providerSyncJobs, lastCompleted)
      .where(filter)
      .orderBy(
        desc(providerIntegrations.updatedAt),
        desc(providerIntegrations.id)
      )
      .limit(50),
    db
      .select({ total: count() })
      .from(providerIntegrations)
      .leftJoin(providerSyncJobs, lastCompleted)
      .where(filter),
  ]);
  return {
    items: items.map(item => ({
      ...item,
      hasFailure: item.failures > 0 || item.status === "error",
      isOverdue:
        item.status === "active" &&
        item.nextSyncAt !== null &&
        item.nextSyncAt < overdueBefore,
      sourceIssues: item.sourceIssues?.count ? item.sourceIssues : null,
    })),
    total: totals[0]?.total ?? 0,
  };
}
