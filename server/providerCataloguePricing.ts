import { and, count, eq, inArray, sql } from "drizzle-orm";
import { providerRecords, serviceRecords } from "../drizzle/schema";
import { collectProviderPriceSummaries } from "../shared/providerCataloguePricing";
import { priceCurrencies, priceUnits } from "../shared/pricing";
import { cataloguePriceAmount, cataloguePriceUnit, visibleCatalogueProvider, visibleCatalogueService } from "./apiCatalogue";
import { AsyncResultCache, registerCatalogueCache } from "./catalogueCache";
import { getDb } from "./db";

type Summaries = ReturnType<typeof collectProviderPriceSummaries>;
const cache = new AsyncResultCache<Summaries | null>();
registerCatalogueCache(() => cache.clear());

export async function getProviderCataloguePricing(providerIds: readonly number[]): Promise<Summaries | null> {
  const ids = [...new Set(providerIds)].sort((a, b) => a - b);
  if (!ids.length) return {};
  if (ids.length > 100 || ids.some(id => !Number.isSafeInteger(id) || id < 1)) throw new Error("Invalid provider price-summary scope");
  return cache.get(ids.join(","), async () => {
    const db = await getDb();
    if (!db) return null;
    try {
      const sourceCurrency = sql<string | null>`case when ${serviceRecords.reviewStatus} = 'pending' then ${serviceRecords.sourceCurrency} else ${serviceRecords.priceCurrency} end`;
      const currency = sql<string | null>`case when ${inArray(sourceCurrency, [...priceCurrencies])} then ${sourceCurrency} else null end`;
      const unit = cataloguePriceUnit();
      const amount = cataloguePriceAmount();
      // Aggregate the entire eligible catalogue for the visible providers, not
      // just the current 25-service page. No external API calls or private data.
      const groups = await db.select({
        providerId: serviceRecords.providerId,
        currency,
        unit,
        minimum: sql<string | null>`min(${amount})`,
        maximum: sql<string | null>`max(${amount})`,
        services: count(),
      }).from(serviceRecords)
        .innerJoin(providerRecords, eq(providerRecords.id, serviceRecords.providerId))
        .where(and(inArray(providerRecords.id, ids), visibleCatalogueProvider(), visibleCatalogueService()))
        .groupBy(serviceRecords.providerId, currency, unit)
        .limit(ids.length * (priceCurrencies.length + 1) * (priceUnits.length + 1));
      return collectProviderPriceSummaries(ids, groups);
    } catch {
      console.warn("[Marketplace] Provider price summaries unavailable");
      return null;
    }
  }, result => result !== null);
}
