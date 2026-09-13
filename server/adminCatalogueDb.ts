import { and, count, desc, eq, like, lt, or } from "drizzle-orm";
import { auditEntries, providerRecords, serviceRecords, teamMembers } from "../drizzle/schema";
import { adminServicesInput, searchPattern, type AdminServicesInput } from "../shared/catalogueQuery";
import { getDb } from "./db";
import type { Permission } from "./authorization";

export async function listAdminServices(raw?: Partial<AdminServicesInput>) {
  const input = adminServicesInput.parse(raw);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const filter = and(
    input.providerId ? eq(serviceRecords.providerId, input.providerId) : undefined,
    input.status ? eq(serviceRecords.status, input.status) : undefined,
    input.platform ? eq(serviceRecords.platform, input.platform) : undefined,
    input.q ? or(like(serviceRecords.name, searchPattern(input.q)), like(serviceRecords.externalId, searchPattern(input.q)),
      like(providerRecords.name, searchPattern(input.q)), like(serviceRecords.category, searchPattern(input.q))) : undefined,
  );
  const [rows, totals] = await Promise.all([
    db.select({
      id: serviceRecords.id, providerId: serviceRecords.providerId, providerName: providerRecords.name,
      providerStatus: providerRecords.status, name: serviceRecords.name, externalId: serviceRecords.externalId,
      platform: serviceRecords.platform, category: serviceRecords.category, status: serviceRecords.status,
      pricePerThousandUsd: serviceRecords.pricePerThousandUsd, quality: serviceRecords.quality,
      updatedAt: serviceRecords.updatedAt,
    }).from(serviceRecords).innerJoin(providerRecords, eq(serviceRecords.providerId, providerRecords.id))
      .where(and(filter, input.cursor ? lt(serviceRecords.id, input.cursor) : undefined))
      .orderBy(desc(serviceRecords.id)).limit(input.limit + 1),
    db.select({ total: count() }).from(serviceRecords).innerJoin(providerRecords, eq(serviceRecords.providerId, providerRecords.id)).where(filter),
  ]);
  const items = rows.slice(0, input.limit);
  return { items, total: totals[0]?.total ?? 0, nextCursor: rows.length > input.limit ? items.at(-1)!.id : null };
}

export async function getAdminOverview(permissions: readonly Permission[]) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  // Each aggregate has the same server-side permission boundary as its corresponding list.
  const [providers, services, published, team, audit] = await Promise.all([
    permissions.includes("providers.read") ? db.select({ total: count() }).from(providerRecords).where(eq(providerRecords.verified, true)) : [],
    permissions.includes("services.read") ? db.select({ total: count() }).from(serviceRecords) : [],
    permissions.includes("services.read") ? db.select({ total: count() }).from(serviceRecords)
      .innerJoin(providerRecords, eq(providerRecords.id, serviceRecords.providerId))
      .where(and(eq(serviceRecords.status, "active"), eq(providerRecords.status, "active"))) : [],
    permissions.includes("team.read") ? db.select({ total: count() }).from(teamMembers) : [],
    permissions.includes("audit.read") ? db.select({ total: count() }).from(auditEntries) : [],
  ]);
  return { verifiedProviders: providers[0]?.total ?? null, totalServices: services[0]?.total ?? null,
    publishedServices: published[0]?.total ?? null, teamMembers: team[0]?.total ?? null, recordedActions: audit[0]?.total ?? null };
}

export async function getProviderForAnalysis(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [provider] = await db.select().from(providerRecords).where(eq(providerRecords.id, id)).limit(1);
  return provider;
}
