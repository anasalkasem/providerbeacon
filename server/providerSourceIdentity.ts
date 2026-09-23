import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { providerIntegrations, providerRecords, serviceRecords } from "../drizzle/schema";
import { getDb } from "./db";
import type { SyncTransaction } from "./catalogueImport";
import { assertSameCatalogueSource, CatalogueSourceConflict, sourceHost, sourceMatchesWebsite } from "../shared/providerSourceIdentity";

const MAX_SOURCES = 100;

// Call while holding the provider lock, before saving or enqueuing a source.
export async function assertCatalogueSource(tx: SyncTransaction, providerId: number, baseUrl: string) {
  const sources = await tx.select({ url: serviceRecords.sourceUrl }).from(serviceRecords)
    .where(and(eq(serviceRecords.providerId, providerId), eq(serviceRecords.sourceKind, "provider_api"), isNotNull(serviceRecords.sourceUrl)))
    .groupBy(serviceRecords.sourceUrl).limit(MAX_SOURCES + 1);
  if (sources.length > MAX_SOURCES) throw new CatalogueSourceConflict();
  for (const source of sources) assertSameCatalogueSource(source.url, baseUrl);
}

export async function getProviderSourceIdentity(providerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [provider] = await db.select({ id: providerRecords.id, name: providerRecords.name, websiteUrl: providerRecords.websiteUrl })
    .from(providerRecords).where(eq(providerRecords.id, providerId)).limit(1);
  if (!provider) throw new Error("Provider not found");
  // Aggregates contain no raw payloads, credentials or unbounded service lists.
  const sources = await db.select({
    url: serviceRecords.sourceUrl,
    count: sql<number>`count(*)`.mapWith(Number),
    sampleId: sql<number>`min(${serviceRecords.id})`.mapWith(Number),
  }).from(serviceRecords).where(and(eq(serviceRecords.providerId, providerId), eq(serviceRecords.sourceKind, "provider_api")))
    .groupBy(serviceRecords.sourceUrl).orderBy(asc(serviceRecords.sourceUrl)).limit(MAX_SOURCES + 1);
  const connections = await db.select({ id: providerIntegrations.id, baseUrl: providerIntegrations.baseUrl }).from(providerIntegrations)
    .where(eq(providerIntegrations.providerId, providerId)).orderBy(asc(providerIntegrations.id)).limit(MAX_SOURCES + 1);
  return {
    provider: { id: provider.id, name: provider.name, websiteHost: sourceHost(provider.websiteUrl) },
    sources: sources.slice(0, MAX_SOURCES).map(row => ({
      host: sourceHost(row.url), count: row.count, sampleServiceId: row.sampleId,
      matchesWebsite: sourceMatchesWebsite(provider.websiteUrl, row.url),
    })),
    connections: connections.slice(0, MAX_SOURCES).map(row => ({ id: row.id, host: sourceHost(row.baseUrl), matchesWebsite: sourceMatchesWebsite(provider.websiteUrl, row.baseUrl) })),
    truncated: sources.length > MAX_SOURCES || connections.length > MAX_SOURCES,
    checkedAt: new Date().toISOString(),
  };
}
