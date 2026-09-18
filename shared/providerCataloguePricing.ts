import {
  priceCurrencies,
  priceUnits,
  type PriceCurrency,
  type PriceUnit,
} from "./pricing";

export type ProviderPriceRange = {
  currency: PriceCurrency;
  unit: PriceUnit;
  minimum: string;
  maximum: string;
  services: number;
};
export type ProviderCataloguePricing = {
  ranges: ProviderPriceRange[];
  additionalGroups: number;
  unconfirmedServices: number;
};
export type ProviderPriceGroup = {
  providerId: number;
  currency: string | null;
  unit: string | null;
  minimum: string | null;
  maximum: string | null;
  services: number;
};

// SQL aggregates are decimal strings. Never round source rates through Number.
export function displayDecimal(value: string | null): string | null {
  if (value == null || !/^\d{1,35}(\.\d{1,30})?$/.test(value)) return null;
  if (!/[1-9]/.test(value)) return null;
  const [integer, fraction = ""] = value.split(".");
  const whole = integer.replace(/^0+(?=\d)/, "");
  const trimmed = fraction.replace(/0+$/, "");
  return `${whole}.${trimmed || "00"}`;
}

export function collectProviderPriceSummaries(
  ids: readonly number[],
  groups: readonly ProviderPriceGroup[]
) {
  const summaries: Record<string, ProviderCataloguePricing> = Object.fromEntries(
    ids.map(id => [
      `provider-${id}`,
      { ranges: [], additionalGroups: 0, unconfirmedServices: 0 },
    ])
  );
  for (const group of groups) {
    const summary = summaries[`provider-${group.providerId}`];
    if (!summary || !Number.isSafeInteger(group.services) || group.services < 1)
      continue;
    const minimum = displayDecimal(group.minimum);
    const maximum = displayDecimal(group.maximum);
    if (
      !minimum ||
      !maximum ||
      !priceCurrencies.includes(group.currency as PriceCurrency) ||
      !priceUnits.includes(group.unit as PriceUnit)
    ) {
      summary.unconfirmedServices += group.services;
      continue;
    }
    summary.ranges.push({
      currency: group.currency as PriceCurrency,
      unit: group.unit as PriceUnit,
      minimum,
      maximum,
      services: group.services,
    });
  }
  for (const summary of Object.values(summaries)) {
    // A stable presentation order, never a cheapest-provider ranking.
    summary.ranges.sort(
      (a, b) =>
        Number(b.currency === "USD") - Number(a.currency === "USD") ||
        a.currency.localeCompare(b.currency) ||
        priceUnits.indexOf(a.unit) - priceUnits.indexOf(b.unit)
    );
    summary.additionalGroups = Math.max(0, summary.ranges.length - 3);
    summary.ranges = summary.ranges.slice(0, 3);
  }
  return summaries;
}
