import { priceHistoryKey } from "./priceHistory";
import { AsyncResultCache, registerCatalogueCache } from "./catalogueCache";
import { publicOfferMetadata } from "../shared/sourcedOffers";
import { and, asc, count, desc, eq, gt, inArray, like, lt, ne, notInArray, or, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { retiredDemoSlugs, assertRealProviderSlug } from "./retiredDemoProviders";
import { auditEntries, localizedContent, priceSnapshots, providerRecords, serviceRecords, staffSessions, teamMembers, type TeamRole } from "../drizzle/schema";
import { getDb } from "./db";
import { approvedService } from "./catalogueRules";
import { cataloguePriceAmount, cataloguePriceUnit, confirmedSourcePricing, connectedApiCatalogue, syncedApiConnection, hasSourceCatalogueRecords, visibleCatalogueProvider, visibleCatalogueService } from "./apiCatalogue";
import { TRPCError } from "@trpc/server";
import { adminProvidersInput, type AdminProvidersInput, catalogueInput, searchPattern, type CatalogueInput } from "../shared/catalogueQuery";

const tierFromDb = {
  tier_1_direct: "Tier 1 Direct Source",
  verified_enterprise: "Verified Enterprise",
  certified_wholesale: "Certified Wholesale",
  specialized_partner: "Specialized Partner",
} as const;

const publicServiceColumns = {
  id: serviceRecords.id, providerId: serviceRecords.providerId, platform: serviceRecords.platform,
  externalId: serviceRecords.externalId, sourceRate: serviceRecords.sourceRate, reviewStatus: serviceRecords.reviewStatus,
  sourceCurrency: serviceRecords.sourceCurrency,
  sourcePriceUnit: serviceRecords.sourcePriceUnit, sourcePricingIdentity: serviceRecords.sourcePricingIdentity,
  catalogueUnit: cataloguePriceUnit(), sourcePackageDescription: serviceRecords.sourcePackageDescription,
  sourceUrl: serviceRecords.sourceUrl, providerWebsite: providerRecords.websiteUrl,
  apiListing: sql<boolean>`${serviceRecords.reviewStatus} = 'pending'`.mapWith(Boolean),
  category: serviceRecords.category, name: serviceRecords.name, priceAmount: serviceRecords.priceAmount,
  priceCurrency: serviceRecords.priceCurrency, priceUnit: serviceRecords.priceUnit,
  packageDescription: serviceRecords.packageDescription, countryCode: serviceRecords.countryCode,
  minOrder: serviceRecords.minOrder, maxOrder: serviceRecords.maxOrder,
  startMinutesMin: serviceRecords.startMinutesMin, startMinutesMax: serviceRecords.startMinutesMax,
  deliveryMinutesMin: serviceRecords.deliveryMinutesMin, deliveryMinutesMax: serviceRecords.deliveryMinutesMax,
  refillMode: serviceRecords.refillMode, refillDays: serviceRecords.refillDays, quality: serviceRecords.quality,
  retentionBasisPoints: serviceRecords.retentionBasisPoints, featured: serviceRecords.featured,
  sourceKind: serviceRecords.sourceKind, evidenceUrl: serviceRecords.evidenceUrl,
  priceCheckedAt: serviceRecords.priceCheckedAt, sourceUpdatedAt: serviceRecords.sourceUpdatedAt,
  sourceData: sql<Record<string, unknown> | null>`case when ${serviceRecords.sourceKind} = 'public_web' then json_object(
    'nameAr', case when json_type(json_extract(${serviceRecords.sourceData}, '$.nameAr')) = 'STRING' then left(json_unquote(json_extract(${serviceRecords.sourceData}, '$.nameAr')), 200) else null end,
    'sourceServiceId', case when json_type(json_extract(${serviceRecords.sourceData}, '$.sourceServiceId')) = 'STRING' then left(json_unquote(json_extract(${serviceRecords.sourceData}, '$.sourceServiceId')), 80) else null end,
    'scopeAr', case when json_type(json_extract(${serviceRecords.sourceData}, '$.scopeAr')) = 'STRING' then left(json_unquote(json_extract(${serviceRecords.sourceData}, '$.scopeAr')), 300) else null end,
    'terms', case when json_type(json_extract(${serviceRecords.sourceData}, '$.terms')) = 'STRING' then left(json_unquote(json_extract(${serviceRecords.sourceData}, '$.terms')), 500) else null end,
    'termsAr', case when json_type(json_extract(${serviceRecords.sourceData}, '$.termsAr')) = 'STRING' then left(json_unquote(json_extract(${serviceRecords.sourceData}, '$.termsAr')), 500) else null end,
    'priceType', json_extract(${serviceRecords.sourceData}, '$.priceType')) else null end`
    .mapWith(value => typeof value === "string" ? JSON.parse(value) : value),
};

const snapshotCache = new AsyncResultCache<Awaited<ReturnType<typeof getMarketplaceSnapshot>>>();
registerCatalogueCache(() => snapshotCache.clear());
export function getCachedMarketplaceSnapshot(raw?: Partial<CatalogueInput>) {
  const input = catalogueInput.parse(raw);
  return snapshotCache.get(JSON.stringify(input), () => getMarketplaceSnapshot(input), value => value.source === "database");
}

export async function getMarketplaceSnapshot(raw?: Partial<CatalogueInput>) {
  const input = catalogueInput.parse(raw);
  const empty = (source: "database" | "unavailable") => ({ providers: [], services: [], source,
    pagination: { total: 0, nextCursor: null as CatalogueInput["cursor"] | null } });
  const db = await getDb();
  if (!db) return empty("unavailable");
  try {
    const eligible = visibleCatalogueProvider();
    const providerScope = input.scope === "providers" || input.scope === "provider";
    const marketFilter = input.market === "smm" ? or(eq(serviceRecords.sourceKind, "provider_api"), and(inArray(serviceRecords.priceUnit, ["per_1000", "per_item"]),
      inArray(serviceRecords.category, ["Followers", "Views", "Likes", "Comments", "Shares", "Subscribers"])))
      : input.market === "packages" ? eq(serviceRecords.priceUnit, "package") : undefined;
    const providerServiceFilter = and(visibleCatalogueService(), marketFilter,
      input.platform ? eq(serviceRecords.platform, input.platform) : undefined,
      input.category ? eq(serviceRecords.category, input.category) : undefined,
      input.countryCode ? eq(serviceRecords.countryCode, input.countryCode) : undefined,
      input.quantity ? and(sql`${serviceRecords.minOrder} <= ${input.quantity}`, sql`${serviceRecords.maxOrder} >= ${input.quantity}`) : undefined,
      input.refillOnly ? inArray(serviceRecords.refillMode, ["manual", "automatic", "lifetime"]) : undefined,
      input.minRefillDays ? or(eq(serviceRecords.refillMode, "lifetime"),
        and(inArray(serviceRecords.refillMode, ["manual", "automatic"]), sql`${serviceRecords.refillDays} >= ${input.minRefillDays}`)) : undefined,
      input.serviceQuery ? or(like(serviceRecords.name, searchPattern(input.serviceQuery)), like(serviceRecords.category, searchPattern(input.serviceQuery)), like(serviceRecords.platform, searchPattern(input.serviceQuery))) : undefined);
    const providerFilter = and(eligible,
      input.scope === "providers" && (marketFilter || input.platform || input.category || input.countryCode || input.quantity || input.refillOnly || input.minRefillDays || input.serviceQuery)
        ? sql`exists (select 1 from ${serviceRecords} where ${serviceRecords.providerId} = ${providerRecords.id} and ${providerServiceFilter})` : undefined,
      input.scope === "provider" ? eq(providerRecords.slug, input.slug ?? "") : undefined,
      input.scope === "providers" && input.q ? or(like(providerRecords.name, searchPattern(input.q)), like(providerRecords.location, searchPattern(input.q))) : undefined);
    const providerPage = providerScope ? await db.select().from(providerRecords)
      .where(and(providerFilter, input.scope === "providers" && input.cursor ? lt(providerRecords.id, input.cursor.id) : undefined))
      .orderBy(desc(providerRecords.id)).limit(input.scope === "provider" ? 1 : input.limit + 1) : [];
    if (input.scope === "provider" && !providerPage.length) return empty("database");
    const serviceFilter = and(eligible, visibleCatalogueService(),
      input.priceUnit || input.sort === "price" ? or(approvedService(), confirmedSourcePricing()) : undefined,
      marketFilter,
      input.category ? eq(serviceRecords.category, input.category) : undefined,
      input.scope === "provider" ? eq(serviceRecords.providerId, providerPage[0]!.id) : undefined,
      input.scope === "compare" ? (input.ids.length ? inArray(serviceRecords.id, input.ids) : sql`false`) : undefined,
      input.platform ? eq(serviceRecords.platform, input.platform) : undefined,
      input.countryCode ? eq(serviceRecords.countryCode, input.countryCode) : undefined,
      input.priceCurrency ? or(
        and(eq(serviceRecords.reviewStatus, "pending"), eq(serviceRecords.sourceCurrency, input.priceCurrency)),
        and(eq(serviceRecords.reviewStatus, "approved"), eq(serviceRecords.priceCurrency, input.priceCurrency))) : undefined,
      input.priceUnit ? eq(cataloguePriceUnit(), input.priceUnit) : undefined,
      input.quantity ? and(sql`${serviceRecords.minOrder} <= ${input.quantity}`, sql`${serviceRecords.maxOrder} >= ${input.quantity}`) : undefined,
      input.quality ? eq(serviceRecords.quality, input.quality) : undefined,
      input.refillOnly ? inArray(serviceRecords.refillMode, ["manual", "automatic", "lifetime"]) : undefined,
      input.minRefillDays ? or(eq(serviceRecords.refillMode, "lifetime"),
        and(inArray(serviceRecords.refillMode, ["manual", "automatic"]), sql`${serviceRecords.refillDays} >= ${input.minRefillDays}`)) : undefined,
      input.q && input.scope !== "providers" ? or(like(serviceRecords.name, searchPattern(input.q)), like(serviceRecords.category, searchPattern(input.q)),
        like(serviceRecords.platform, searchPattern(input.q)), like(providerRecords.name, searchPattern(input.q)),
        and(eq(serviceRecords.sourceKind, "public_web"), sql`json_unquote(json_extract(${serviceRecords.sourceData}, '$.nameAr')) like ${searchPattern(input.q)}`)) : undefined);
    const rank = input.sort === "price" ? cataloguePriceAmount() : input.sort === "retention" ? sql<number>`coalesce(${serviceRecords.retentionBasisPoints}, -1)` : sql<number>`${serviceRecords.featured}`;
    const cursorRank = input.sort === "price" ? sql`cast(${input.cursor?.rank ?? 0} as decimal(65,30))` : input.cursor?.rank;
    const after = input.cursor ? or(
      input.sort === "price" ? gt(rank, cursorRank) : lt(rank, cursorRank),
      and(eq(rank, cursorRank), lt(serviceRecords.id, input.cursor.id))) : undefined;
    const limit = input.scope === "home" ? 8 : input.scope === "compare" ? 4 : input.limit;
    const servicePage = input.scope === "providers" ? [] : await db.select({ service: publicServiceColumns, rank }).from(serviceRecords)
      .innerJoin(providerRecords, eq(providerRecords.id, serviceRecords.providerId)).where(and(serviceFilter, after))
      .orderBy(input.sort === "price" ? asc(rank) : desc(rank), desc(serviceRecords.id)).limit(limit + 1);
    const serviceRows = servicePage.slice(0, limit).map(row => row.service);
    const serviceProviderIds = Array.from(new Set(serviceRows.map(row => row.providerId)));
    const providerRows = providerScope ? providerPage.slice(0, input.limit) : serviceProviderIds.length ? await db.select().from(providerRecords)
      .where(and(eligible, serviceProviderIds.length ? inArray(providerRecords.id, serviceProviderIds) : undefined))
      .orderBy(providerRecords.name).limit(serviceProviderIds.length) : [];
    const providerIds = providerRows.map(row => row.id);
    const counts = providerIds.length ? await db.select({ providerId: serviceRecords.providerId, total: count() }).from(serviceRecords)
      .innerJoin(providerRecords, eq(providerRecords.id, serviceRecords.providerId)).where(and(visibleCatalogueService(), inArray(serviceRecords.providerId, providerIds))).groupBy(serviceRecords.providerId) : [];
    const serviceCounts = new Map(counts.map(row => [row.providerId, row.total]));
    const totals = input.scope === "providers" ? await db.select({ total: count() }).from(providerRecords).where(providerFilter)
      : await db.select({ total: count() }).from(serviceRecords).innerJoin(providerRecords, eq(serviceRecords.providerId, providerRecords.id)).where(serviceFilter);
    const last = servicePage[Math.min(limit, servicePage.length) - 1];
    const nextCursor = input.scope === "providers" ? (providerPage.length > input.limit ? { id: providerRows.at(-1)!.id, rank: 0 } : null)
      : input.scope !== "home" && input.scope !== "compare" && servicePage.length > limit ? { id: last!.service.id, rank: input.sort === "price" ? String(last!.rank) : Number(last!.rank) } : null;
    const connectedRows = providerIds.length ? await db.select({id: providerRecords.id}).from(providerRecords).where(and(inArray(providerRecords.id, providerIds), connectedApiCatalogue())) : [];
    const connectedIds = new Set(connectedRows.map(row => row.id));
    const providers = providerRows.map(row => ({
      apiConnected: connectedIds.has(row.id),
      id: `provider-${row.id}`, slug: row.slug, name: row.name, initials: row.initials, location: row.location ?? "",
      verified: row.verified, tier: tierFromDb[row.tier],
      // Public scores remain unavailable until the evidence-backed scoring pipeline exists.
      score: null, auditSignals: null,
      rating: row.reviewCount > 0 ? row.ratingBasisPoints / 100 : null, reviews: row.reviewCount,
      responseTime: row.responseMinutes == null ? "—" : `${row.responseMinutes} min`,
      apiLatency: row.apiLatencyMs == null ? "—" : `${row.apiLatencyMs}ms`,
      apiUptime: row.apiUptimeBasisPoints == null ? "—" : `${(row.apiUptimeBasisPoints / 100).toFixed(2)}%`,
      apiStatus: "unknown" as const, successRate: row.successRateBasisPoints == null ? null : row.successRateBasisPoints / 100,
      updatedMinutes: row.sourceUpdatedAt ? Math.max(0, Math.round((Date.now() - row.sourceUpdatedAt.getTime()) / 60000)) : null,
      since: row.createdAt.getUTCFullYear(), minDeposit: row.minDepositUsd == null ? "—" : `$${row.minDepositUsd}`,
      refillPolicy: row.refillPolicy ?? "—", totalOrders: row.totalOrdersLabel ?? "—",
      activeServicesCount: serviceCounts.get(row.id) ?? 0, priceLevel: "$$" as const,
      paymentMethods: row.paymentMethods ?? [], specialties: row.specialties ?? [], description: row.description ?? "",
      strengths: row.strengths ?? [],
    }));
    const services = serviceRows.map(row => ({
      // Provider API IDs are only unique within that provider. The database ID is global.
      ...publicOfferMetadata(row),
      historyKey: priceHistoryKey(row),
      sourceRate: row.apiListing ? row.sourceRate : null,
      catalogueListing: row.apiListing ? "api_source" as const : "reviewed" as const,
      sourceServiceId: row.sourceKind === "provider_api" ? row.externalId : publicOfferMetadata(row).sourceServiceId,
      sourceUrl: row.apiListing ? safeSourceWebsite(row.providerWebsite, row.sourceUrl) : publicOfferMetadata(row).sourceUrl,
      id: `service-${row.id}`, providerId: `provider-${row.providerId}`, platform: row.platform, category: row.category,
      name: row.name, priceAmount: Number(row.apiListing ? row.sourceRate : row.priceAmount), priceCurrency: row.apiListing ? row.sourceCurrency : row.priceCurrency,
      priceUnit: row.catalogueUnit, packageDescription: row.apiListing ? row.sourcePackageDescription : row.packageDescription, countryCode: row.countryCode, min: row.minOrder, max: row.maxOrder,
      startTime: durationLabel(row.startMinutesMin, row.startMinutesMax),
      delivery: durationLabel(row.deliveryMinutesMin, row.deliveryMinutesMax),
      refill: row.refillMode === "unknown" ? "—" : row.refillMode === "lifetime" ? "Lifetime guarantee" : row.refillMode === "none" ? "No refill" : row.refillDays == null ? "Refill available; duration unspecified" : `${row.refillDays}-day ${row.refillMode === "automatic" ? "auto " : ""}refill`,
      quality: `${row.quality.charAt(0).toUpperCase()}${row.quality.slice(1)}` as "Standard" | "Premium" | "Elite",
      retention: row.retentionBasisPoints == null ? null : row.retentionBasisPoints / 100, featured: row.featured,
    }));
    return { providers, services, source: "database" as const, pagination: { total: totals[0]?.total ?? 0, nextCursor } };
  } catch (error) {
    const failure = (error as {cause?: Error & {code?: string}})?.cause ?? error as Error & {code?: string};
    console.warn("[Marketplace] Catalogue query failed; no substitute data will be shown", failure?.code ?? "query_error");
    if (process.env.VITEST && process.env.TEST_DATABASE_URL) console.warn("[Catalogue test diagnostic]", failure?.message);
    return empty("unavailable");
  }
}

function safeSourceWebsite(website: string | null, endpoint: string | null) {
  try {
    const url = new URL(website ?? endpoint ?? "");
    return url.protocol === "https:" && !url.username && !url.password ? url.origin : null;
  } catch { return null; }
}

function durationLabel(min: number | null, max: number | null) {
  if (min == null && max == null) return "—";
  const low = min ?? max ?? 0; const high = max ?? min ?? 0;
  const unit = high >= 1440 ? "days" : high >= 60 ? "hours" : "min";
  const divisor = unit === "days" ? 1440 : unit === "hours" ? 60 : 1;
  return `${Math.round(low / divisor)}–${Math.round(high / divisor)} ${unit}`;
}

export function isPrivateAddress(address: string) {
  if (address === "::1" || address === "0.0.0.0" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  const parts = address.split(".").map(Number); if (parts.length !== 4) return false; const [a,b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

export async function assertPublicHttpsUrl(value: string) {
  const endpoint = new URL(value);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || (endpoint.port && endpoint.port !== "443")) throw new Error("Provider API must be a standard public HTTPS URL");
  if (endpoint.hostname === "localhost" || (isIP(endpoint.hostname) && isPrivateAddress(endpoint.hostname))) throw new Error("Private network addresses are not allowed");
  const addresses = await lookup(endpoint.hostname, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error("Provider API must resolve only to public addresses");
  return endpoint;
}

export async function listTeamMembers() { const db = await getDb(); return db ? db.select().from(teamMembers).orderBy(desc(teamMembers.createdAt)) : []; }
export async function setTeamMemberStatus(input: { id: number; status: "active" | "suspended"; actorUserId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, input.id)).limit(1);
  if (!member) throw new Error("Team member not found");
  if (member.role === "owner") throw new Error("The owner account cannot be suspended");
  if (member.userId === input.actorUserId) throw new Error("You cannot suspend your own account");
  await db.update(teamMembers).set({ status: input.status, invitationTokenHash: null, invitationExpiresAt: null }).where(eq(teamMembers.id, input.id));
  if (input.status === "suspended" && member.userId) await db.delete(staffSessions).where(eq(staffSessions.userId, member.userId));
  await writeAudit({ actorUserId: input.actorUserId, action: `team.member.${input.status}`, entityType: "team_member", entityId: String(input.id), summary: `${member.email} changed to ${input.status}` });
  return { success: true };
}
const adminProviderColumns = {
  id: providerRecords.id, slug: providerRecords.slug, name: providerRecords.name,
  websiteUrl: providerRecords.websiteUrl, location: providerRecords.location,
  status: providerRecords.status, verified: providerRecords.verified, updatedAt: providerRecords.updatedAt,
  apiCataloguePublished: providerRecords.apiCataloguePublished,
  apiConnectionReady: sql<boolean>`${syncedApiConnection()}`.mapWith(Boolean),
  apiServicesReady: sql<boolean>`${hasSourceCatalogueRecords()}`.mapWith(Boolean),
  // There is no completed evidence-backed scoring pipeline yet.
  score: sql<null>`null`, successRateBasisPoints: providerRecords.successRateBasisPoints,
};
function providerSearch(q: string) {
  return q ? or(like(providerRecords.name, searchPattern(q)), like(providerRecords.slug, searchPattern(q))) : undefined;
}
export async function listAdminProviders(raw?: Partial<AdminProvidersInput>) {
  const input = adminProvidersInput.parse(raw);
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  return db.select(adminProviderColumns).from(providerRecords)
    .where(and(notInArray(providerRecords.slug, [...retiredDemoSlugs]),
      input.includeId ? or(eq(providerRecords.id, input.includeId), providerSearch(input.q) ?? sql`true`) : providerSearch(input.q)))
    .orderBy(desc(sql`${providerRecords.id} = ${input.includeId ?? 0}`), desc(providerRecords.id)).limit(input.limit);
}
export async function listAdminProviderPage(raw?: Partial<AdminProvidersInput>) {
  const input = adminProvidersInput.parse(raw);
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const filter = and(notInArray(providerRecords.slug, [...retiredDemoSlugs]), providerSearch(input.q));
  const [rows, totals] = await Promise.all([
    db.select(adminProviderColumns).from(providerRecords)
      .where(and(filter, input.cursor ? lt(providerRecords.id, input.cursor) : undefined))
      .orderBy(desc(providerRecords.id)).limit(input.limit + 1),
    db.select({ total: count() }).from(providerRecords).where(filter),
  ]);
  const items = rows.slice(0, input.limit);
  return { items, total: totals[0]?.total ?? 0, nextCursor: rows.length > input.limit ? items.at(-1)!.id : null };
}
export async function createProviderDraft(input: { name: string; websiteUrl: string; actorUserId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const name = input.name.trim().slice(0, 200);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160);
  if (!name || !slug) throw new Error("Provider name is invalid");
  assertRealProviderSlug(slug);
  const endpoint = await assertPublicHttpsUrl(input.websiteUrl);
  const initials = name.split(/\s+/).map(part => part[0]).join("").slice(0, 4).toUpperCase();
  await db.insert(providerRecords).values({
    slug,
    name,
    initials,
    status: "draft",
    tier: "specialized_partner",
    websiteUrl: endpoint.origin,
    description: "Provider details are listed from public sources. Service delivery and quality have not been independently verified.",
    verified: false,
  }).onDuplicateKeyUpdate({ set: { name, websiteUrl: endpoint.origin } });
  const [provider] = await db.select().from(providerRecords).where(eq(providerRecords.slug, slug)).limit(1);
  if (!provider) throw new Error("Provider draft could not be created");
  await writeAudit({ actorUserId: input.actorUserId, action: "provider.draft.create", entityType: "provider", entityId: String(provider.id), summary: `Created or refreshed provider draft ${name}`, metadata: { websiteHost: endpoint.host } });
  return provider;
}
export async function ensureCanonicalProviderDrafts() {
  const db = await getDb(); if (!db) return { created: 0 };
  const [existing] = await db.select({ id: providerRecords.id }).from(providerRecords).where(eq(providerRecords.slug, "justanotherpanel")).limit(1);
  if (existing) return { created: 0 };
  const inserted = await db.insert(providerRecords).values({
    slug: "justanotherpanel",
    name: "JustAnotherPanel",
    initials: "JAP",
    status: "draft",
    tier: "specialized_partner",
    websiteUrl: "https://justanotherpanel.com",
    description: "Provider details are listed from public sources. Service delivery and quality have not been independently verified.",
    verified: false,
  }).$returningId();
  await writeAudit({ action: "provider.draft.bootstrap", entityType: "provider", entityId: String(inserted[0]!.id), summary: "Created the initial real provider draft for API onboarding", metadata: { websiteHost: "justanotherpanel.com" } });
  return { created: 1 };
}
export async function updateProviderStatus(input: { id: number; status: "draft" | "pending_review" | "active" | "suspended"; actorUserId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const [before] = await tx.select().from(providerRecords).where(eq(providerRecords.id, input.id)).for("update");
    if (!before) throw new Error("Provider not found");
    if (input.status === "active") assertRealProviderSlug(before.slug);
    // Publication never grants identity verification; suspending a listing withdraws its badge.
    const after = { status: input.status, verified: input.status === "suspended" ? false : before.verified };
    await tx.update(providerRecords).set(after).where(eq(providerRecords.id, input.id));
    await writeAudit({ actorUserId: input.actorUserId, action: "provider.status.update", entityType: "provider", entityId: String(input.id), summary: `Provider status changed to ${input.status}`, metadata: { before: { status: before.status, verified: before.verified }, after } }, tx);
    return { success: true };
  });
}

export async function setProviderCataloguePublication(input: {
  id: number;
  enabled: boolean;
  reason: string;
  actorUserId: number;
  ipAddress?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    // Connection edits, synchronization and publication share this provider lock.
    const [before] = await tx.select().from(providerRecords).where(eq(providerRecords.id, input.id)).for("update");
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "provider_not_found" });
    if (input.enabled) {
      assertRealProviderSlug(before.slug);
      if (before.status === "suspended") throw new TRPCError({ code: "BAD_REQUEST", message: "provider_suspended" });
      const [ready] = await tx.select({ id: providerRecords.id }).from(providerRecords)
        .where(and(eq(providerRecords.id, input.id), syncedApiConnection(), hasSourceCatalogueRecords())).limit(1);
      if (!ready) throw new TRPCError({ code: "BAD_REQUEST", message: "api_catalogue_not_ready" });
    }
    const after = { apiCataloguePublished: input.enabled, status: input.enabled ? "active" as const : before.status };
    if (before.apiCataloguePublished === after.apiCataloguePublished && before.status === after.status) return { success: true, changed: false };
    await tx.update(providerRecords).set(after).where(eq(providerRecords.id, input.id));
    await writeAudit({
      actorUserId: input.actorUserId, ipAddress: input.ipAddress,
      action: input.enabled ? "provider.api_catalogue.publish" : "provider.api_catalogue.unpublish",
      entityType: "provider", entityId: String(input.id),
      summary: input.enabled ? "Published connected provider profile and source catalogue" : "Withdrew provider source catalogue",
      metadata: { reason: input.reason, before: { apiCataloguePublished: before.apiCataloguePublished, status: before.status }, after, verificationUnchanged: true, serviceReviewsUnchanged: true },
    }, tx);
    return { success: true, changed: true };
  });
}

export async function updateServiceRecord(input: { id: number; status?: "draft" | "active" | "paused" | "archived"; priceAmount?: number; actorUserId: number }) {
  if (input.status === "active") throw new Error("Use the service review and publication workflow");
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const [before] = await tx.select().from(serviceRecords).where(eq(serviceRecords.id, input.id)).for("update");
    if (!before) throw new Error("Service not found");
    const priceChanged = input.priceAmount != null && input.priceAmount.toFixed(4) !== before.priceAmount;
    const changes = {
      status: input.status ?? (priceChanged && before.status === "active" ? "draft" as const : before.status),
      revision: before.revision + 1,
      ...(priceChanged ? { priceAmount: input.priceAmount!.toFixed(4), pricingConfirmed: false,
        priceCheckedAt: null, incomplete: true, reviewStatus: "pending" as const, reviewedAt: null, reviewedByUserId: null, lastPriceChangeAt: new Date() } : {}),
    };
    await tx.update(serviceRecords).set(changes).where(eq(serviceRecords.id, input.id));
    if (priceChanged) await tx.insert(priceSnapshots).values({ serviceId: input.id, priceAmount: changes.priceAmount!, priceCurrency: before.priceCurrency,
      priceUnit: before.priceUnit, packageDescription: before.packageDescription, kind: "review" });
    await writeAudit({ actorUserId: input.actorUserId, action: "service.update", entityType: "service", entityId: String(input.id), summary: "Service status or unconfirmed price updated", metadata: { before: { status: before.status, priceAmount: before.priceAmount, revision: before.revision, reviewStatus: before.reviewStatus }, after: changes } }, tx);
    return { success: true };
  });
}

export async function createTeamInvite(input: { email: string; role: TeamRole; actorUserId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const token = randomBytes(32).toString("base64url");
  const invitationTokenHash = createHash("sha256").update(token).digest("hex");
  const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(teamMembers).values({ email: input.email.toLowerCase(), role: input.role, status: "invited", invitedByUserId: input.actorUserId, invitationTokenHash, invitationExpiresAt }).onDuplicateKeyUpdate({ set: { role: input.role, status: "invited", invitedByUserId: input.actorUserId, invitationTokenHash, invitationExpiresAt } });
  await writeAudit({ actorUserId: input.actorUserId, action: "team.invite", entityType: "team_member", entityId: input.email.toLowerCase(), summary: `Invited team member as ${input.role}` });
  return { success: true, token, expiresAt: invitationExpiresAt };
}

export async function acceptTeamInvite(input: { token: string; userId: number; email: string | null }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  if (!input.email) throw new Error("Your authenticated account must include an email address");
  const invitationTokenHash = createHash("sha256").update(input.token).digest("hex");
  const [invite] = await db.select().from(teamMembers).where(and(eq(teamMembers.invitationTokenHash, invitationTokenHash), eq(teamMembers.status, "invited"), gt(teamMembers.invitationExpiresAt, new Date()))).limit(1);
  if (!invite || invite.email.toLowerCase() !== input.email.toLowerCase()) throw new Error("Invitation is invalid, expired, or belongs to another account");
  await db.update(teamMembers).set({ userId: input.userId, status: "active", invitationTokenHash: null, invitationExpiresAt: null }).where(eq(teamMembers.id, invite.id));
  await writeAudit({ actorUserId: input.userId, action: "team.invite.accept", entityType: "team_member", entityId: String(invite.id), summary: `Accepted team invitation as ${invite.role}` });
  return { success: true, role: invite.role };
}

export async function listAuditEntries(limit = 100) { const db = await getDb(); return db ? db.select().from(auditEntries).orderBy(desc(auditEntries.createdAt)).limit(limit) : []; }
export async function listLocalizedContent() { const db = await getDb(); return db ? db.select().from(localizedContent).orderBy(desc(localizedContent.updatedAt)).limit(500) : []; }
export async function upsertLocalizedContent(input: { entityType: "provider" | "service" | "page"; entityId: string; fieldName: string; locale: "en" | "es" | "ar" | "hi" | "zh"; value: string; status: "draft" | "machine_translated" | "reviewed" | "published"; actorUserId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const values = { entityType: input.entityType, entityId: input.entityId, fieldName: input.fieldName, locale: input.locale, value: input.value, status: input.status, updatedByUserId: input.actorUserId };
  await db.insert(localizedContent).values(values).onDuplicateKeyUpdate({ set: { value: input.value, status: input.status, updatedByUserId: input.actorUserId } });
  await writeAudit({ actorUserId: input.actorUserId, action: "translation.upsert", entityType: input.entityType, entityId: `${input.entityId}:${input.fieldName}:${input.locale}`, summary: `Updated ${input.locale} translation with ${input.status} status` });
  return { success: true };
}
export async function writeAudit(input: { actorUserId?: number; action: string; entityType: string; entityId: string; summary: string; metadata?: Record<string, unknown>; ipAddress?: string }, executor?: Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "insert">) {
  const db = executor ?? await getDb(); if (!db) throw new Error("Audit database unavailable");
  await db.insert(auditEntries).values({ actorUserId: input.actorUserId, action: input.action, entityType: input.entityType, entityId: input.entityId, summary: input.summary, metadata: input.metadata, ipAddress: input.ipAddress });
}
