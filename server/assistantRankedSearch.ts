import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import type { AssistantCataloguePlan } from "../shared/assistant";
import { searchPattern } from "../shared/catalogueQuery";
import { compareFractions, convertedAmount } from "../shared/exchange";
import { priceCurrencies, quantityQuoteExact } from "../shared/pricing";
import { providerRecords, serviceRecords } from "../drizzle/schema";
import {
  cataloguePriceUnit,
  confirmedSourcePricing,
  visibleCatalogueProvider,
  visibleCatalogueService,
} from "./apiCatalogue";
import { approvedService } from "./catalogueRules";
import { getDb } from "./db";
import { getAssistantExchangeTable } from "./assistantExchange";
import { assistantOffersByIds, assistantSearch } from "./assistantCatalogue";

// Search the entire eligible catalogue, keeping four cheapest rows per currency/unit.
// More expensive rows in the same bucket cannot enter a four-result cost shortlist.
// Numeric ranking is not a quality/equivalence claim; that check runs separately.
export async function assistantRankedSearch(plan: AssistantCataloguePlan) {
  if (
    plan.quantity == null ||
    plan.market !== "smm" ||
    (!plan.preferLowest && plan.budget == null)
  )
    return assistantSearch(plan);
  const db = await getDb();
  if (!db) throw new Error("CATALOGUE_UNAVAILABLE");
  // All three values are validated ASCII. Pin their collation because source
  // columns, legacy columns and numeric casts can inherit different defaults.
  const currency = sql<string>`cast(case when ${serviceRecords.reviewStatus} = 'pending' then ${serviceRecords.sourceCurrency} else ${serviceRecords.priceCurrency} end as char character set ascii) collate ascii_bin`;
  const unit = sql<string>`cast(${cataloguePriceUnit()} as char character set ascii) collate ascii_bin`;
  const rate = sql<string>`cast(case when ${serviceRecords.reviewStatus} = 'pending' then ${serviceRecords.sourceRate} else cast(${serviceRecords.priceAmount} as char) end as char character set ascii) collate ascii_bin`;
  const ranked = db
    .select({
      id: serviceRecords.id,
      currency: currency.as("currency"),
      unit: unit.as("sale_unit"),
      rate: rate.as("rate"),
      total: sql<number>`count(*) over ()`.mapWith(Number).as("total"),
      // Integer + zero-padded fractional digits preserve precision beyond DECIMAL(65,30).
      position:
        sql<number>`row_number() over (partition by ${currency}, ${unit} order by
      cast(substring_index(${rate}, '.', 1) as unsigned),
      rpad(case when locate('.', ${rate}) > 0 then substring(${rate}, locate('.', ${rate}) + 1) else '' end, 2000, '0'),
      ${serviceRecords.id} desc)`
          .mapWith(Number)
          .as("position"),
    })
    .from(serviceRecords)
    .innerJoin(
      providerRecords,
      eq(providerRecords.id, serviceRecords.providerId)
    )
    .where(
      and(
        visibleCatalogueProvider(),
        plan.providerIds?.length
          ? inArray(providerRecords.id, plan.providerIds)
          : undefined,
        visibleCatalogueService(),
        or(approvedService(), confirmedSourcePricing()),
        inArray(currency, priceCurrencies),
        inArray(unit, ["per_1000", "per_item"]),
        sql`${serviceRecords.minOrder} <= ${plan.quantity}`,
        sql`${serviceRecords.maxOrder} >= ${plan.quantity}`,
        plan.platform ? eq(serviceRecords.platform, plan.platform) : undefined,
        plan.category ? eq(serviceRecords.category, plan.category) : undefined,
        plan.countryCode
          ? eq(serviceRecords.countryCode, plan.countryCode)
          : undefined,
        plan.provider
          ? like(providerRecords.name, searchPattern(plan.provider))
          : undefined,
        plan.query
          ? or(
              like(serviceRecords.name, searchPattern(plan.query)),
              like(serviceRecords.category, searchPattern(plan.query)),
              like(serviceRecords.platform, searchPattern(plan.query))
            )
          : undefined,
        plan.refillOnly
          ? inArray(serviceRecords.refillMode, [
              "manual",
              "automatic",
              "lifetime",
            ])
          : undefined,
        plan.minRefillDays
          ? or(
              eq(serviceRecords.refillMode, "lifetime"),
              and(
                inArray(serviceRecords.refillMode, ["manual", "automatic"]),
                sql`${serviceRecords.refillDays} >= ${plan.minRefillDays}`
              )
            )
          : undefined
      )
    )
    .as("ranked_prices");
  const rows = await db
    .select()
    .from(ranked)
    .where(sql`${ranked.position} <= 4`)
    .limit(priceCurrencies.length * 2 * 4);
  // Keep unconfirmed services discoverable when no confirmed price can be ranked.
  if (!rows.length) return assistantSearch(plan);
  const displayCurrency = plan.displayCurrency ?? "USD";
  const fx = rows.some(row => row.currency !== displayCurrency)
    ? await getAssistantExchangeTable()
    : null;
  const budget =
    plan.budget != null
      ? convertedAmount(plan.budget, displayCurrency, displayCurrency, null)
      : null;
  const amounts = rows
    .flatMap(row => {
      const total = quantityQuoteExact(
        {
          priceAmount: Number(row.rate),
          catalogueListing: "api_source",
          sourceRate: row.rate,
          priceCurrency: row.currency,
          priceUnit: row.unit,
          min: 1,
          max: 2147483647,
        },
        plan.quantity!
      );
      const cost = total
        ? convertedAmount(total, row.currency, displayCurrency, fx)
        : null;
      return cost && (!budget || compareFractions(cost, budget) <= 0)
        ? [{ id: row.id, cost }]
        : [];
    })
    .sort((a, b) => compareFractions(a.cost, b.cost) || b.id - a.id);
  if (
    !amounts.length &&
    (!budget || rows.some(row => row.currency !== displayCurrency && !fx))
  )
    return assistantSearch(plan);
  const candidates = amounts.length
    ? await assistantOffersByIds(
        amounts.slice(0, 4).map(row => `service-${row.id}`)
      )
    : [];
  return {
    candidates,
    total: rows[0]?.total ?? 0,
    providerLimitReached: false,
  };
}
