import type { Service } from "../client/src/data/marketplace";
import { hasPricingBasis, quantityQuoteExact } from "./pricing";

export function comparisonGroup(service: Service) {
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
export function comparisonFacts(services: Service[], quantity: number) {
  return {
    pricingMissing: services.some(s => !hasPricingBasis(s)),
    quantityInvalid: services.some(
      s => quantityQuoteExact(s, quantity) == null
    ),
    termsMissing: services.some(s => !comparisonGroup(s)),
    differingFields: (
      [
        "platform",
        "category",
        "countryCode",
        "refill",
        "quality",
      ] as const
    ).filter(field => new Set(services.map(s => s[field] ?? null)).size > 1),
  };
}
