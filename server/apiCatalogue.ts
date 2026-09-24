import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  notInArray,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { providerRecords, serviceRecords } from "../drizzle/schema";
import { approvedService } from "./catalogueRules";
import { NORMALIZATION_VERSION } from "./serviceNormalizer";
import { retiredDemoSlugs } from "./retiredDemoProviders";
import { priceCurrencies } from "../shared/pricing";

// Legacy API rows adopt the same fixed SMM basis as new imports. Explicit
// packages keep their own price; raw amounts and historical evidence are retained.
export const sourceRateUnit = () => {
  const claim = sql`lower(trim(coalesce(json_unquote(json_extract(${serviceRecords.sourceData}, '$.unit')), '')))`;
  return sql<
    "per_1000" | "per_item" | "package"
  >`coalesce(${serviceRecords.sourcePriceUnit}, case
    when lower(coalesce(json_unquote(json_extract(${serviceRecords.sourceData}, '$.type')), '')) regexp 'package|subscription'
      or ${claim} regexp 'month|package|flat|fixed'
      or (${claim} = '' and ${serviceRecords.minOrder} = 1 and ${serviceRecords.maxOrder} = 1) then 'package'
    when ${claim} in ('per_item', 'per item', 'each') then 'per_item'
    else 'per_1000' end)`;
};
export function confirmedSourcePricing() {
  return and(
    inArray(serviceRecords.sourceCurrency, priceCurrencies),
    or(
      sql`${sourceRateUnit()} <> 'package'`,
      sql`char_length(trim(${serviceRecords.sourcePackageDescription})) >= 8`
    )
  );
}
export const rawCataloguePriceUnit = () =>
  sql<
    "per_1000" | "per_item" | "package"
  >`case when ${serviceRecords.reviewStatus} = 'pending' then ${sourceRateUnit()} else coalesce(${serviceRecords.priceUnit}, 'per_1000') end`;
export const cataloguePriceUnit = () =>
  sql<
    "per_1000" | "package"
  >`case when ${rawCataloguePriceUnit()} = 'package' then 'package' else 'per_1000' end`;
export const cataloguePriceAmount = () =>
  sql<string>`(case when ${serviceRecords.reviewStatus} = 'pending' then cast(${serviceRecords.sourceRate} as decimal(65,30)) else ${serviceRecords.priceAmount} end) * (case when ${rawCataloguePriceUnit()} = 'per_item' then 1000 else 1 end)`;

// A source catalogue is opt-in. It does not approve services or verify their quality.
// Credentials and account data never enter public queries or responses.
export function syncedApiConnection() {
  return sql`exists (
    select 1 from provider_integrations api_connection
    where api_connection.providerId = ${providerRecords.id}
      and api_connection.status = 'active'
      and api_connection.lastSyncedAt is not null
      and api_connection.credentialCiphertext is not null
  )`;
}

export function connectedApiCatalogue() {
  return and(
    eq(providerRecords.apiCataloguePublished, true),
    syncedApiConnection()
  );
}

export function sourceCatalogueRecord() {
  return and(
    ne(serviceRecords.screeningStatus, "held"),
    eq(serviceRecords.sourceKind, "provider_api"),
    eq(serviceRecords.reviewStatus, "pending"),
    inArray(serviceRecords.status, ["draft", "active"]),
    eq(serviceRecords.available, true),
    isNotNull(serviceRecords.externalId),
    isNotNull(serviceRecords.sourceUpdatedAt),
    gte(serviceRecords.normalizationVersion, NORMALIZATION_VERSION),
    gte(serviceRecords.priceAmount, "0.0001"),
    lte(serviceRecords.priceAmount, "100000"),
    gte(serviceRecords.minOrder, 1),
    gte(serviceRecords.maxOrder, serviceRecords.minOrder),
    sql`${serviceRecords.sourceRate} regexp ${"^[0-9]+([.][0-9]+)?$"}`,
    sql`cast(${serviceRecords.sourceRate} as decimal(20,10)) between 0.0001 and 100000`
  );
}

export function sourceCatalogueService() {
  return and(connectedApiCatalogue(), sourceCatalogueRecord());
}

export function hasSourceCatalogueRecords() {
  return sql`exists (select 1 from ${serviceRecords}
    where ${serviceRecords.providerId} = ${providerRecords.id}
      and ${sourceCatalogueRecord()})`;
}

export function visibleCatalogueService() {
  return or(approvedService(), sourceCatalogueService());
}

export function visibleCatalogueProvider() {
  return and(
    eq(providerRecords.isReviewWorkspace, false),
    eq(providerRecords.status, "active"),
    or(
      eq(providerRecords.apiCataloguePublished, false),
      connectedApiCatalogue()
    ),
    notInArray(providerRecords.slug, [...retiredDemoSlugs])
  );
}
