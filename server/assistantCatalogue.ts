import type { Provider, Service } from "../client/src/data/marketplace";
import type { AssistantPlan } from "../shared/assistant";
import {
  compareFractions,
  convertedAmount,
  formatConvertedAmount,
  type ExchangeTable,
} from "../shared/exchange";
import { hasPricingBasis, quantityQuoteExact } from "../shared/pricing";
import type { CatalogueInput } from "../shared/catalogueQuery";
import { getCachedMarketplaceSnapshot } from "./marketplaceDb";

export type AssistantCandidate = { service: Service; provider: Provider };
export type AssistantOffer = AssistantCandidate & {
  total: string | null;
  convertedTotal: string | null;
  displayCurrency: string;
  fxAsOf: number | null;
  lowest: boolean;
  budgetStatus: "within" | "above" | "unknown" | null;
};

type Snapshot = typeof getCachedMarketplaceSnapshot;
export async function assistantOffersByIds(
  ids: string[],
  snapshot: Snapshot = getCachedMarketplaceSnapshot
) {
  const page = await snapshot({
    scope: "compare",
    ids: ids.map(id => Number(id.slice(8))),
  });
  if (page.source !== "database") throw new Error("CATALOGUE_UNAVAILABLE");
  return ids.flatMap(id => {
    const service = page.services.find(row => row.id === id);
    const provider =
      service && page.providers.find(row => row.id === service.providerId);
    return service && provider ? [{ service, provider }] : [];
  });
}

export async function assistantSearch(
  plan: AssistantPlan,
  snapshot: Snapshot = getCachedMarketplaceSnapshot
) {
  const providerPage = await snapshot({
    scope: "providers",
    market: plan.market,
    q: plan.provider ?? "",
    platform: plan.platform ?? undefined,
    category: plan.category ?? undefined,
    countryCode: plan.countryCode ?? undefined,
    quantity: plan.quantity ?? undefined,
    refillOnly: plan.refillOnly,
    serviceQuery: plan.query || undefined,
    limit: 8,
  });
  if (providerPage.source !== "database")
    throw new Error("CATALOGUE_UNAVAILABLE");
  const candidates: AssistantCandidate[] = [];
  let total = 0;
  // Two bounded reads at a time prevent a public chat from flooding the SQL pool.
  for (let offset = 0; offset < providerPage.providers.length; offset += 2) {
    const pages = await Promise.all(
      providerPage.providers.slice(offset, offset + 2).map(provider =>
        snapshot({
          scope: "provider",
          slug: provider.slug,
          market: plan.market,
          platform: plan.platform ?? undefined,
          category: plan.category ?? undefined,
          countryCode: plan.countryCode ?? undefined,
          q: plan.query,
          quantity: plan.quantity ?? undefined,
          refillOnly: plan.refillOnly,
          limit: 6,
        })
      )
    );
    for (const page of pages) {
      if (page.source !== "database") throw new Error("CATALOGUE_UNAVAILABLE");
      total += page.pagination.total;
      for (const service of page.services) {
        const provider = page.providers.find(
          row => row.id === service.providerId
        );
        if (provider) candidates.push({ service, provider });
      }
    }
  }
  return {
    candidates,
    total,
    providerLimitReached: !!providerPage.pagination.nextCursor,
  };
}

function comparisonGroup(service: Service) {
  if (
    !hasPricingBasis(service) ||
    service.priceUnit === "package" ||
    service.priceType === "from" ||
    !service.countryCode ||
    service.platform === "Unknown" ||
    service.category === "Other" ||
    !service.refill ||
    service.refill === "—" ||
    service.refill === "Refill available; duration unspecified"
  )
    return null;
  return JSON.stringify([
    service.platform,
    service.category,
    service.countryCode,
    service.refill,
    service.quality,
    service.billingCycle ?? null,
  ]);
}

export function quoteAssistantOffers(
  candidates: AssistantCandidate[],
  quantity: number | null,
  currency: string,
  fx: ExchangeTable | null,
  budget: string | null = null
) {
  const quotes = candidates.map(candidate => {
    const { service } = candidate;
    const total =
      quantity == null || service.priceType === "from"
        ? null
        : quantityQuoteExact(service, quantity);
    const comparableTotal =
      total && service.priceCurrency
        ? convertedAmount(total, service.priceCurrency, currency, fx)
        : null;
    const budgetAmount =
      budget == null ? null : convertedAmount(budget, currency, currency, null);
    const converted =
      service.priceCurrency !== currency && comparableTotal != null;
    const offer: AssistantOffer = {
      ...candidate,
      total,
      convertedTotal: converted
        ? formatConvertedAmount(comparableTotal!)
        : null,
      displayCurrency: currency,
      fxAsOf: converted ? fx!.asOf : null,
      lowest: false,
      budgetStatus:
        budget == null
          ? null
          : comparableTotal && budgetAmount
            ? compareFractions(comparableTotal, budgetAmount) <= 0
              ? "within"
              : "above"
            : "unknown",
    };
    return { offer, comparableTotal, group: comparisonGroup(service) };
  });
  const groups = new Map<string, typeof quotes>();
  for (const quote of quotes) {
    if (!quote.comparableTotal || !quote.group) continue;
    const group = groups.get(quote.group) ?? [];
    group.push(quote);
    groups.set(quote.group, group);
  }
  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue;
    const best = group.reduce((a, b) =>
      compareFractions(a.comparableTotal!, b.comparableTotal!) <= 0 ? a : b
    );
    for (const quote of group)
      quote.offer.lowest =
        compareFractions(quote.comparableTotal!, best.comparableTotal!) === 0;
  }
  return quotes;
}

export function assistantCatalogueUrl(plan: AssistantPlan) {
  const params = new URLSearchParams();
  if (plan.market === "packages") params.set("market", "packages");
  if (plan.platform) params.set("platform", plan.platform);
  if (plan.category) params.set("category", plan.category);
  if (plan.provider || plan.query) params.set("q", plan.provider || plan.query);
  return `/services${params.size ? `?${params}` : ""}`;
}
