import { z } from "zod";

// Supported settlement currencies. No exchange-rate conversion is performed.
export const priceCurrencies = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "INR",
  "CNY",
  "PAB",
  "MXN",
  "BRL",
  "COP",
  "ARS",
  "CLP",
  "PEN",
  "AED",
  "SAR",
  "TRY",
  "JPY",
  "KRW",
  "IDR",
  "VND",
  "PKR",
  "BDT",
  "NGN",
  "EGP",
  "ZAR",
  "CHF",
  "SGD",
  "HKD",
  "NZD",
] as const;
export const priceUnits = ["per_1000", "per_item", "package"] as const;
export type PriceCurrency = (typeof priceCurrencies)[number];
export type PriceUnit = (typeof priceUnits)[number];
export const pricingFields = {
  priceCurrency: z.enum(priceCurrencies).nullable().default(null),
  priceUnit: z.enum(priceUnits).nullable().default(null),
  packageDescription: z
    .string()
    .trim()
    .min(8)
    .max(300)
    .nullable()
    .default(null),
};
export type PricingMetadata = {
  priceCurrency?: string | null;
  priceUnit?: string | null;
  packageDescription?: string | null;
};
export function hasPricingBasis(row: PricingMetadata) {
  return (
    priceCurrencies.includes(row.priceCurrency as PriceCurrency) &&
    priceUnits.includes(row.priceUnit as PriceUnit) &&
    (row.priceUnit !== "package" ||
      (row.packageDescription?.trim().length ?? 0) >= 8)
  );
}

// Package contents and unspecified markets cannot be assumed equivalent.
export function comparablePrices(
  rows: (PricingMetadata & {
    platform: string;
    category: string;
    countryCode?: string | null;
    refill?: string;
  })[]
) {
  const first = rows[0];
  return (
    rows.length > 1 &&
    !!first &&
    !!first.countryCode &&
    rows.every(
      row =>
        hasPricingBasis(row) &&
        row.priceUnit !== "package" &&
        row.priceCurrency === first.priceCurrency &&
        row.priceUnit === first.priceUnit &&
        row.platform === first.platform &&
        row.category === first.category &&
        row.countryCode === first.countryCode &&
        row.refill === first.refill &&
        row.refill !== "—"
    )
  );
}

// A quote is arithmetic on a published unit price, not an order or a delivery guarantee.
export function quantityQuote(
  row: PricingMetadata & { priceAmount: number; min: number; max: number },
  quantity: number
) {
  if (
    !hasPricingBasis(row) ||
    row.priceUnit === "package" ||
    !Number.isSafeInteger(quantity) ||
    quantity < row.min ||
    quantity > row.max ||
    !Number.isFinite(row.priceAmount) ||
    row.priceAmount < 0
  )
    return null;
  return (
    (row.priceAmount * quantity) / (row.priceUnit === "per_1000" ? 1000 : 1)
  );
}
