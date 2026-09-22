import type { Service } from "@/data/marketplace";
import {
  comparablePrices,
  compareQuoteAmounts,
  quantityQuoteExact,
} from "../../../shared/pricing";

// A page can contain different markets and currencies. Rank only within a
// matching group on this page, using the exact cost of an accepted quantity.
export function lowestVisiblePriceIds(services: Service[], quantity: number) {
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
    const amount = quantityQuoteExact(service, quantity);
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

// Keep each group independent: a lower number in another currency or market
// is not a better offer. Stable partitioning also preserves server cursor order
// among the remaining rows and never mutates the shared catalogue or selection.
export function orderVisibleOffers(
  services: Service[],
  quantity: number,
  prioritizeLowest = true
) {
  const lowest = lowestVisiblePriceIds(services, quantity);
  const rows = prioritizeLowest
    ? [
        ...services.filter(service => lowest.has(service.id)),
        ...services.filter(service => !lowest.has(service.id)),
      ]
    : [...services];
  return { rows, lowest };
}
