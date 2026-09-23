import type { Service } from "@/data/marketplace";
import {
  comparablePrices,
  compareQuoteAmounts,
  quantityQuoteExact,
} from "../../../shared/pricing";

export function publishedRateExact(service: Service) {
  const rate =
    service.catalogueListing === "api_source"
      ? service.sourceRate
      : String(service.priceAmount);
  return rate != null && /^\d+(\.\d+)?$/.test(rate) ? rate : null;
}

// A page can contain different markets and currencies. Rank only within a
// matching group, using published rates unless a quantity is explicitly supplied.
export function lowestVisiblePriceIds(services: Service[], quantity?: number) {
  const groups = new Map<string, { service: Service; amount: string }[]>();
  for (const service of services) {
    if (
      service.platform === "Unknown" ||
      service.category === "Other" ||
      !service.refill ||
      service.refill === "—" ||
      service.refill === "Refill available; duration unspecified" ||
      service.priceType === "from"
    )
      continue;
    const amount =
      quantity === undefined
        ? publishedRateExact(service)
        : quantityQuoteExact(service, quantity);
    if (amount == null) continue;
    const key = JSON.stringify([
      service.platform,
      service.category,
      service.countryCode,
      service.refill,
      service.quality,
      service.priceCurrency,
      service.priceUnit,
      service.billingCycle,
    ]);
    const group = groups.get(key) ?? [];
    group.push({ service, amount });
    groups.set(key, group);
  }
  const lowest = new Set<string>();
  for (const group of Array.from(groups.values())) {
    if (!comparablePrices(group.map(row => row.service))) continue;
    const best = group.reduce((a, b) =>
      compareQuoteAmounts(a.amount, b.amount) <= 0 ? a : b
    );
    for (const row of group) {
      if (compareQuoteAmounts(row.amount, best.amount) === 0)
        lowest.add(row.service.id);
    }
  }
  return lowest;
}
