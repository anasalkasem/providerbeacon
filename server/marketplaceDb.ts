import { and, asc, count, desc, eq, gt, inArray, like, lt, ne, notInArray, or, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { providers as seedProviders, services as seedServices } from "../client/src/data/marketplace";
import { auditEntries, localizedContent, priceSnapshots, providerRecords, serviceRecords, staffSessions, teamMembers, type TeamRole } from "../drizzle/schema";
import { getDb } from "./db";
import { approvedService } from "./catalogueRules";
import { catalogueInput, searchPattern, type CatalogueInput } from "../shared/catalogueQuery";

const tierToDb = {
  "Tier 1 Direct Source": "tier_1_direct",
  "Verified Enterprise": "verified_enterprise",
  "Certified Wholesale": "certified_wholesale",
  "Specialized Partner": "specialized_partner",
} as const;
const tierFromDb = {
  tier_1_direct: "Tier 1 Direct Source",
  verified_enterprise: "Verified Enterprise",
  certified_wholesale: "Certified Wholesale",
  specialized_partner: "Specialized Partner",
} as const;

// Demo fixtures are opt-in and are never a production fallback.
export function marketplaceDemoEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.MARKETPLACE_DEMO_MODE === "true";
}

export async function getMarketplaceSnapshot(raw?: Partial<CatalogueInput>) {
  const input = catalogueInput.parse(raw);
  const empty = (source: "database" | "unavailable") => ({ providers: [], services: [], source,
    pagination: { total: 0, nextCursor: null as CatalogueInput["cursor"] | null } });
  const db = await getDb();
  if (!db) {
    if (!marketplaceDemoEnabled()) return empty("unavailable");
    const services = seedServices.slice(0, input.limit);
    return { providers: seedProviders.slice(0, 25), services, source: "seed" as const,
      pagination: { total: services.length, nextCursor: null as CatalogueInput["cursor"] | null } };
  }
  try {
    const eligible = and(eq(providerRecords.status, "active"),
      marketplaceDemoEnabled() ? undefined : notInArray(providerRecords.slug, seedProviders.map(provider => provider.slug)));
    const providerScope = input.scope === "providers" || input.scope === "provider";
    const providerFilter = and(eligible,
      input.scope === "provider" ? eq(providerRecords.slug, input.slug ?? "") : undefined,
      input.scope === "providers" && input.q ? or(like(providerRecords.name, searchPattern(input.q)), like(providerRecords.location, searchPattern(input.q))) : undefined);
    const providerPage = providerScope ? await db.select().from(providerRecords)
      .where(and(providerFilter, input.scope === "providers" && input.cursor ? lt(providerRecords.id, input.cursor.id) : undefined))
      .orderBy(desc(providerRecords.id)).limit(input.scope === "provider" ? 1 : input.limit + 1) : [];
    if (input.scope === "provider" && !providerPage.length) return empty("database");
    const serviceFilter = and(eligible, approvedService(),
      input.scope === "provider" ? eq(serviceRecords.providerId, providerPage[0]!.id) : undefined,
      input.scope === "compare" ? (input.ids.length ? inArray(serviceRecords.id, input.ids) : sql`false`) : undefined,
      input.platform ? eq(serviceRecords.platform, input.platform) : undefined,
      input.quality ? eq(serviceRecords.quality, input.quality) : undefined,
      input.refillOnly ? inArray(serviceRecords.refillMode, ["manual", "automatic", "lifetime"]) : undefined,
      input.q && !providerScope ? or(like(serviceRecords.name, searchPattern(input.q)), like(serviceRecords.category, searchPattern(input.q)),
        like(serviceRecords.platform, searchPattern(input.q)), like(providerRecords.name, searchPattern(input.q))) : undefined);
    const rank = input.sort === "price" ? sql<number>`${serviceRecords.pricePerThousandUsd}` : input.sort === "retention" ? sql<number>`coalesce(${serviceRecords.retentionBasisPoints}, -1)` : sql<number>`${serviceRecords.featured}`;
    const after = input.cursor ? or(
      input.sort === "price" ? gt(rank, input.cursor.rank) : lt(rank, input.cursor.rank),
      and(eq(rank, input.cursor.rank), lt(serviceRecords.id, input.cursor.id))) : undefined;
    const limit = input.scope === "home" ? 8 : input.scope === "compare" ? 4 : input.limit;
    const servicePage = input.scope === "providers" ? [] : await db.select({ service: serviceRecords, rank }).from(serviceRecords)
      .innerJoin(providerRecords, eq(providerRecords.id, serviceRecords.providerId)).where(and(serviceFilter, after))
      .orderBy(input.sort === "price" ? asc(rank) : desc(rank), desc(serviceRecords.id)).limit(limit + 1);
    const serviceRows = servicePage.slice(0, limit).map(row => row.service);
    const serviceProviderIds = Array.from(new Set(serviceRows.map(row => row.providerId)));
    const providerRows = providerScope ? providerPage.slice(0, input.limit) : await db.select().from(providerRecords)
      .where(and(eligible, serviceProviderIds.length ? inArray(providerRecords.id, serviceProviderIds) : undefined))
      .orderBy(providerRecords.name).limit(serviceProviderIds.length || 8);
    const providerIds = providerRows.map(row => row.id);
    const counts = providerIds.length ? await db.select({ providerId: serviceRecords.providerId, total: count() }).from(serviceRecords)
      .where(and(approvedService(), inArray(serviceRecords.providerId, providerIds))).groupBy(serviceRecords.providerId) : [];
    const serviceCounts = new Map(counts.map(row => [row.providerId, row.total]));
    const totals = input.scope === "providers" ? await db.select({ total: count() }).from(providerRecords).where(providerFilter)
      : await db.select({ total: count() }).from(serviceRecords).innerJoin(providerRecords, eq(serviceRecords.providerId, providerRecords.id)).where(serviceFilter);
    const last = servicePage[Math.min(limit, servicePage.length) - 1];
    const nextCursor = input.scope === "providers" ? (providerPage.length > input.limit ? { id: providerRows.at(-1)!.id, rank: 0 } : null)
      : input.scope !== "home" && input.scope !== "compare" && servicePage.length > limit ? { id: last!.service.id, rank: Number(last!.rank) } : null;
    const providers = providerRows.map(row => ({
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
      id: `service-${row.id}`, providerId: `provider-${row.providerId}`, platform: row.platform, category: row.category,
      name: row.name, pricePerThousand: Number(row.pricePerThousandUsd), min: row.minOrder, max: row.maxOrder,
      startTime: durationLabel(row.startMinutesMin, row.startMinutesMax),
      delivery: durationLabel(row.deliveryMinutesMin, row.deliveryMinutesMax),
      refill: row.refillMode === "unknown" ? "—" : row.refillMode === "lifetime" ? "Lifetime guarantee" : row.refillMode === "none" ? "No refill" : row.refillDays == null ? "Refill available; duration unspecified" : `${row.refillDays}-day ${row.refillMode === "automatic" ? "auto " : ""}refill`,
      quality: `${row.quality.charAt(0).toUpperCase()}${row.quality.slice(1)}` as "Standard" | "Premium" | "Elite",
      retention: row.retentionBasisPoints == null ? null : row.retentionBasisPoints / 100, featured: row.featured,
    }));
    const hasDemoProfiles = providerRows.some(row => seedProviders.some(provider => provider.slug === row.slug));
    return { providers, services, source: hasDemoProfiles ? "seed" as const : "database" as const, pagination: { total: totals[0]?.total ?? 0, nextCursor } };
  } catch {
    console.warn("[Marketplace] Catalogue query failed; no substitute data will be shown");
    return empty("unavailable");
  }
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

export async function seedMarketplaceIfEmpty(actorUserId?: number) {
  if (!marketplaceDemoEnabled()) return { seeded: false, reason: "demo_disabled" as const };
  const db = await getDb(); if (!db) return { seeded: false, reason: "database_unavailable" as const };
  const existing = await db.select({ id: providerRecords.id }).from(providerRecords).limit(1);
  if (existing.length) return { seeded: false, reason: "already_seeded" as const };
  const providerIds = new Map<string, number>();
  for (const provider of seedProviders) {
    const inserted = await db.insert(providerRecords).values({
      slug: provider.slug, name: provider.name, initials: provider.initials, status: "active", tier: tierToDb[provider.tier],
      location: provider.location, description: provider.description, verified: provider.verified, score: provider.score ?? 0,
      ratingBasisPoints: Math.round((provider.rating ?? 0) * 100), reviewCount: provider.reviews,
      responseMinutes: Number.parseInt(provider.responseTime), apiLatencyMs: Number.parseInt(provider.apiLatency),
      apiUptimeBasisPoints: Math.round(Number.parseFloat(provider.apiUptime) * 100), successRateBasisPoints: Math.round((provider.successRate ?? 0) * 100),
      minDepositUsd: provider.minDeposit.replace("$", ""), totalOrdersLabel: provider.totalOrders,
      activeServicesCount: provider.activeServicesCount, refillPolicy: provider.refillPolicy,
      paymentMethods: provider.paymentMethods, specialties: provider.specialties, strengths: provider.strengths,
      auditSignals: provider.auditSignals, sourceUpdatedAt: new Date(),
    }).$returningId();
    providerIds.set(provider.id, inserted[0]!.id);
  }
  for (const service of seedServices) {
    const providerId = providerIds.get(service.providerId); if (!providerId) continue;
    await db.insert(serviceRecords).values({ providerId, externalId: service.id, slug: service.id, platform: service.platform, category: service.category,
      name: service.name, status: "active", pricePerThousandUsd: service.pricePerThousand.toString(), minOrder: service.min, maxOrder: service.max,
      refillMode: service.refill.toLowerCase().includes("lifetime") ? "lifetime" : service.refill.toLowerCase().includes("auto") ? "automatic" : service.refill.toLowerCase().includes("no refill") ? "none" : "manual",
      refillDays: Number.parseInt(service.refill) || null, quality: service.quality.toLowerCase() as "standard" | "premium" | "elite",
      retentionBasisPoints: Math.round((service.retention ?? 0) * 100), featured: Boolean(service.featured), sourceUpdatedAt: new Date(),
    });
  }
  await writeAudit({ actorUserId, action: "marketplace.seed", entityType: "marketplace", entityId: "initial", summary: `Seeded ${seedProviders.length} providers and ${seedServices.length} services` });
  return { seeded: true, providers: seedProviders.length, services: seedServices.length };
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
export async function listAdminProviders() { const db = await getDb(); return db ? db.select().from(providerRecords).orderBy(desc(providerRecords.updatedAt)) : []; }
export async function createProviderDraft(input: { name: string; websiteUrl: string; actorUserId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const name = input.name.trim().slice(0, 200);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160);
  if (!name || !slug) throw new Error("Provider name is invalid");
  const endpoint = await assertPublicHttpsUrl(input.websiteUrl);
  const initials = name.split(/\s+/).map(part => part[0]).join("").slice(0, 4).toUpperCase();
  await db.insert(providerRecords).values({
    slug,
    name,
    initials,
    status: "draft",
    tier: "specialized_partner",
    websiteUrl: endpoint.origin,
    description: "Real provider draft awaiting API catalogue validation and editorial review.",
    verified: false,
  }).onDuplicateKeyUpdate({ set: { name, websiteUrl: endpoint.origin } });
  const [provider] = await db.select().from(providerRecords).where(eq(providerRecords.slug, slug)).limit(1);
  if (!provider) throw new Error("Provider draft could not be created");
  await writeAudit({ actorUserId: input.actorUserId, action: "provider.draft.create", entityType: "provider", entityId: String(provider.id), summary: `Created or refreshed provider draft ${name}`, metadata: { websiteHost: endpoint.host } });
  return provider;
}
export async function ensureCanonicalProviderDrafts() {
  const db = await getDb(); if (!db) return { created: 0 };
  await db.update(providerRecords).set({ status: "draft", verified: false }).where(inArray(providerRecords.slug, seedProviders.map(provider => provider.slug)));
  const [existing] = await db.select({ id: providerRecords.id }).from(providerRecords).where(eq(providerRecords.slug, "justanotherpanel")).limit(1);
  if (existing) return { created: 0 };
  const inserted = await db.insert(providerRecords).values({
    slug: "justanotherpanel",
    name: "JustAnotherPanel",
    initials: "JAP",
    status: "draft",
    tier: "specialized_partner",
    websiteUrl: "https://justanotherpanel.com",
    description: "Real provider draft awaiting API catalogue validation and editorial review.",
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
    if (input.status === "active" && !marketplaceDemoEnabled() && seedProviders.some(provider => provider.slug === before.slug)) {
      throw new Error("Demo providers cannot be published outside explicit demo mode");
    }
    // Publication never grants identity verification; suspending a listing withdraws its badge.
    const after = { status: input.status, verified: input.status === "suspended" ? false : before.verified };
    await tx.update(providerRecords).set(after).where(eq(providerRecords.id, input.id));
    await writeAudit({ actorUserId: input.actorUserId, action: "provider.status.update", entityType: "provider", entityId: String(input.id), summary: `Provider status changed to ${input.status}`, metadata: { before: { status: before.status, verified: before.verified }, after } }, tx);
    return { success: true };
  });
}

export async function updateServiceRecord(input: { id: number; status?: "draft" | "active" | "paused" | "archived"; pricePerThousandUsd?: number; actorUserId: number }) {
  if (input.status === "active") throw new Error("Use the service review and publication workflow");
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const [before] = await tx.select().from(serviceRecords).where(eq(serviceRecords.id, input.id)).for("update");
    if (!before) throw new Error("Service not found");
    const priceChanged = input.pricePerThousandUsd != null && input.pricePerThousandUsd.toFixed(4) !== before.pricePerThousandUsd;
    const changes = {
      status: input.status ?? (priceChanged && before.status === "active" ? "draft" as const : before.status),
      revision: before.revision + 1,
      ...(priceChanged ? { pricePerThousandUsd: input.pricePerThousandUsd!.toFixed(4), pricingConfirmed: false,
        priceCheckedAt: null, incomplete: true, reviewStatus: "pending" as const, reviewedAt: null, reviewedByUserId: null, lastPriceChangeAt: new Date() } : {}),
    };
    await tx.update(serviceRecords).set(changes).where(eq(serviceRecords.id, input.id));
    if (priceChanged) await tx.insert(priceSnapshots).values({ serviceId: input.id, pricePerThousandUsd: changes.pricePerThousandUsd! });
    await writeAudit({ actorUserId: input.actorUserId, action: "service.update", entityType: "service", entityId: String(input.id), summary: "Service status or unconfirmed price updated", metadata: { before: { status: before.status, pricePerThousandUsd: before.pricePerThousandUsd, revision: before.revision, reviewStatus: before.reviewStatus }, after: changes } }, tx);
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
