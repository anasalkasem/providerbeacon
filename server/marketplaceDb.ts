import { and, desc, eq, gt } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { providers as seedProviders, services as seedServices } from "../client/src/data/marketplace";
import { auditEntries, localizedContent, priceSnapshots, providerIntegrations, providerRecords, serviceRecords, teamMembers, type TeamRole } from "../drizzle/schema";
import { getDb } from "./db";

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

export async function getMarketplaceSnapshot() {
  const db = await getDb();
  if (!db) return { providers: seedProviders, services: seedServices, source: "seed" as const };
  try {
    const providerRows = await db.select().from(providerRecords).where(eq(providerRecords.status, "active")).orderBy(desc(providerRecords.score));
    if (!providerRows.length) return { providers: seedProviders, services: seedServices, source: "seed" as const };
    const serviceRows = await db.select().from(serviceRecords).where(eq(serviceRecords.status, "active"));
    const externalProviderIds = new Map(providerRows.map(row => [row.id, seedProviders.find(provider => provider.slug === row.slug)?.id ?? String(row.id)]));
    const providers = providerRows.map(row => {
      const seeded = seedProviders.find(provider => provider.slug === row.slug);
      return ({
      id: externalProviderIds.get(row.id)!, slug: row.slug, name: row.name, initials: row.initials, location: row.location ?? "",
      verified: row.verified, tier: tierFromDb[row.tier], score: row.score,
      rating: row.ratingBasisPoints / 100, reviews: row.reviewCount, responseTime: `${row.responseMinutes ?? 0} min`,
      apiLatency: `${row.apiLatencyMs ?? 0}ms`, apiUptime: `${((row.apiUptimeBasisPoints ?? 0) / 100).toFixed(2)}%`,
      apiStatus: "optimal" as const, successRate: (row.successRateBasisPoints ?? 0) / 100,
      updatedMinutes: row.sourceUpdatedAt ? Math.max(0, Math.round((Date.now() - row.sourceUpdatedAt.getTime()) / 60000)) : 0,
      since: seeded?.since ?? row.createdAt.getUTCFullYear(), minDeposit: `$${row.minDepositUsd ?? "0"}`,
      refillPolicy: row.refillPolicy ?? "", totalOrders: row.totalOrdersLabel ?? "0",
      activeServicesCount: row.activeServicesCount, priceLevel: seeded?.priceLevel ?? "$$" as const,
      paymentMethods: row.paymentMethods ?? [], specialties: row.specialties ?? [], description: row.description ?? "",
      strengths: row.strengths ?? [], auditSignals: row.auditSignals ?? { apiReliability: 0, priceFairness: 0, refillFulfillment: 0, customerSupport: 0, complianceAudit: 0 },
    })});
    const services = serviceRows.map(row => {
      const seeded = seedServices.find(service => service.id === row.externalId);
      return ({
      id: row.externalId ?? String(row.id), providerId: externalProviderIds.get(row.providerId) ?? String(row.providerId), platform: row.platform as any, category: row.category,
      name: row.name, pricePerThousand: Number(row.pricePerThousandUsd), min: row.minOrder, max: row.maxOrder,
      startTime: row.startMinutesMin == null && row.startMinutesMax == null ? seeded?.startTime ?? "—" : durationLabel(row.startMinutesMin, row.startMinutesMax),
      delivery: row.deliveryMinutesMin == null && row.deliveryMinutesMax == null ? seeded?.delivery ?? "—" : durationLabel(row.deliveryMinutesMin, row.deliveryMinutesMax),
      refill: row.refillMode === "lifetime" ? "Lifetime guarantee" : row.refillMode === "none" ? "No refill" : `${row.refillDays ?? 0}-day ${row.refillMode === "automatic" ? "auto " : ""}refill`,
      quality: `${row.quality.charAt(0).toUpperCase()}${row.quality.slice(1)}` as "Standard" | "Premium" | "Elite",
      retention: (row.retentionBasisPoints ?? 0) / 100, featured: row.featured,
    })});
    return { providers, services, source: "database" as const };
  } catch (error) {
    console.warn("[Marketplace] Database unavailable, using seed fallback:", error);
    return { providers: seedProviders, services: seedServices, source: "seed" as const };
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

async function assertPublicHttpsUrl(value: string) {
  const endpoint = new URL(value);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || (endpoint.port && endpoint.port !== "443")) throw new Error("Provider API must be a standard public HTTPS URL");
  if (endpoint.hostname === "localhost" || (isIP(endpoint.hostname) && isPrivateAddress(endpoint.hostname))) throw new Error("Private network addresses are not allowed");
  const addresses = await lookup(endpoint.hostname, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error("Provider API must resolve only to public addresses");
  return endpoint;
}

export async function seedMarketplaceIfEmpty(actorUserId?: number) {
  const db = await getDb(); if (!db) return { seeded: false, reason: "database_unavailable" as const };
  const existing = await db.select({ id: providerRecords.id }).from(providerRecords).limit(1);
  if (existing.length) return { seeded: false, reason: "already_seeded" as const };
  const providerIds = new Map<string, number>();
  for (const provider of seedProviders) {
    const inserted = await db.insert(providerRecords).values({
      slug: provider.slug, name: provider.name, initials: provider.initials, status: "active", tier: tierToDb[provider.tier],
      location: provider.location, description: provider.description, verified: provider.verified, score: provider.score,
      ratingBasisPoints: Math.round(provider.rating * 100), reviewCount: provider.reviews,
      responseMinutes: Number.parseInt(provider.responseTime), apiLatencyMs: Number.parseInt(provider.apiLatency),
      apiUptimeBasisPoints: Math.round(Number.parseFloat(provider.apiUptime) * 100), successRateBasisPoints: Math.round(provider.successRate * 100),
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
      retentionBasisPoints: Math.round(service.retention * 100), featured: Boolean(service.featured), sourceUpdatedAt: new Date(),
    });
  }
  await writeAudit({ actorUserId, action: "marketplace.seed", entityType: "marketplace", entityId: "initial", summary: `Seeded ${seedProviders.length} providers and ${seedServices.length} services` });
  return { seeded: true, providers: seedProviders.length, services: seedServices.length };
}

export async function listTeamMembers() { const db = await getDb(); return db ? db.select().from(teamMembers).orderBy(desc(teamMembers.createdAt)) : []; }
export async function listAdminProviders() { const db = await getDb(); return db ? db.select().from(providerRecords).orderBy(desc(providerRecords.updatedAt)) : []; }
export async function updateProviderStatus(input: { id: number; status: "draft" | "pending_review" | "active" | "suspended"; actorUserId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  await db.update(providerRecords).set({ status: input.status, verified: input.status === "active" }).where(eq(providerRecords.id, input.id));
  await writeAudit({ actorUserId: input.actorUserId, action: "provider.status.update", entityType: "provider", entityId: String(input.id), summary: `Provider status changed to ${input.status}`, metadata: { status: input.status } });
  return { success: true };
}

export async function listAdminServices() { const db = await getDb(); return db ? db.select().from(serviceRecords).orderBy(desc(serviceRecords.updatedAt)) : []; }
export async function updateServiceRecord(input: { id: number; status?: "draft" | "active" | "paused" | "archived"; pricePerThousandUsd?: number; actorUserId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const changes: { status?: "draft" | "active" | "paused" | "archived"; pricePerThousandUsd?: string; sourceUpdatedAt: Date } = { sourceUpdatedAt: new Date() };
  if (input.status) changes.status = input.status;
  if (input.pricePerThousandUsd != null) changes.pricePerThousandUsd = input.pricePerThousandUsd.toFixed(4);
  await db.update(serviceRecords).set(changes).where(eq(serviceRecords.id, input.id));
  await writeAudit({ actorUserId: input.actorUserId, action: "service.update", entityType: "service", entityId: String(input.id), summary: "Service publishing or price data updated", metadata: changes });
  return { success: true };
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
export async function syncProviderServicesNow(input: { providerId: number; baseUrl: string; apiKey: string; actorUserId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const [provider] = await db.select().from(providerRecords).where(eq(providerRecords.id, input.providerId)).limit(1);
  if (!provider) throw new Error("Provider not found");
  const endpoint = await assertPublicHttpsUrl(input.baseUrl);
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15_000);
  let payload: unknown;
  try {
    const response = await fetch(endpoint, { method: "POST", redirect: "error", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ key: input.apiKey, action: "services" }), signal: controller.signal });
    if (!response.ok) throw new Error(`Provider API returned HTTP ${response.status}`);
    payload = await response.json();
  } finally { clearTimeout(timeout); }
  if (!Array.isArray(payload)) throw new Error("Provider API did not return a service list");
  const normalized = payload.slice(0, 5000).map((item, index) => {
    const row = item as Record<string, unknown>; const externalId = String(row.service ?? row.id ?? index + 1); const name = String(row.name ?? "").trim(); const price = Number(row.rate ?? row.price); const min = Number(row.min ?? 1); const max = Number(row.max ?? min);
    if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min) return null;
    const platform = name.split(/\s|\||-/)[0]?.slice(0, 80) || "Other"; const category = String(row.category ?? "Imported").slice(0, 120); const slug = `${provider.slug}-${externalId}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 190);
    return { externalId, name: name.slice(0, 300), price, min, max, platform, category, slug };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!normalized.length) throw new Error("No valid services were found in the provider response");
  for (const item of normalized) {
    await db.insert(serviceRecords).values({ providerId: provider.id, externalId: item.externalId, slug: item.slug, platform: item.platform, category: item.category, name: item.name, status: "active", pricePerThousandUsd: item.price.toFixed(4), minOrder: item.min, maxOrder: item.max, sourceUpdatedAt: new Date() }).onDuplicateKeyUpdate({ set: { name: item.name, platform: item.platform, category: item.category, pricePerThousandUsd: item.price.toFixed(4), minOrder: item.min, maxOrder: item.max, sourceUpdatedAt: new Date() } });
    const [service] = await db.select({ id: serviceRecords.id }).from(serviceRecords).where(and(eq(serviceRecords.providerId, provider.id), eq(serviceRecords.slug, item.slug))).limit(1);
    if (service) await db.insert(priceSnapshots).values({ serviceId: service.id, pricePerThousandUsd: item.price.toFixed(4) });
  }
  const [integration] = await db.select().from(providerIntegrations).where(and(eq(providerIntegrations.providerId, provider.id), eq(providerIntegrations.baseUrl, endpoint.toString()))).limit(1);
  if (integration) await db.update(providerIntegrations).set({ status: "active", lastSyncedAt: new Date(), lastError: null }).where(eq(providerIntegrations.id, integration.id));
  else await db.insert(providerIntegrations).values({ providerId: provider.id, name: `${provider.name} SMM API`, baseUrl: endpoint.toString(), credentialReference: "one-time-manual-sync", status: "active", lastSyncedAt: new Date() });
  await writeAudit({ actorUserId: input.actorUserId, action: "integration.services.sync", entityType: "provider", entityId: String(provider.id), summary: `Imported ${normalized.length} services from provider API`, metadata: { importedCount: normalized.length, host: endpoint.host } });
  return { success: true, importedCount: normalized.length, providerName: provider.name };
}
export async function writeAudit(input: { actorUserId?: number; action: string; entityType: string; entityId: string; summary: string; metadata?: Record<string, unknown>; ipAddress?: string }) {
  const db = await getDb(); if (!db) return;
  await db.insert(auditEntries).values({ actorUserId: input.actorUserId, action: input.action, entityType: input.entityType, entityId: input.entityId, summary: input.summary, metadata: input.metadata, ipAddress: input.ipAddress });
}
