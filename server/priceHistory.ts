import { createHash } from "node:crypto";

// A price history never joins different currencies, units, names or delivery terms.
// Missing historical identities stay missing; old points are not backfilled as verified.
export function priceHistoryKey(row: Record<string, unknown>) {
  const source =
    row.reviewStatus === "pending" && row.sourceKind === "provider_api";
  return createHash("sha256")
    .update(
      JSON.stringify([
        1,
        source ? "source" : "review",
        row.sourceKind ?? null,
        source ? (row.sourcePricingIdentity ?? null) : null,
        source ? (row.sourceCurrency ?? null) : (row.priceCurrency ?? null),
        source ? (row.sourcePriceUnit ?? null) : (row.priceUnit ?? null),
        source
          ? (row.sourcePackageDescription ?? null)
          : (row.packageDescription ?? null),
        ...[
          "externalId",
          "name",
          "platform",
          "category",
          "countryCode",
          "minOrder",
          "maxOrder",
          "startMinutesMin",
          "startMinutesMax",
          "deliveryMinutesMin",
          "deliveryMinutesMax",
          "refillDays",
        ].map(key => row[key] ?? null),
        row.refillMode ?? "unknown",
        row.quality ?? "standard",
      ])
    )
    .digest("hex");
}
