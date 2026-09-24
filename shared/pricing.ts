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
export function sourceRateBasis(source: Record<string, unknown>): PriceUnit {
  const claim =
    typeof source.unit === "string" ? source.unit.trim().toLowerCase() : "";
  if (
    (typeof source.type === "string" &&
      /package|subscription/i.test(source.type)) ||
    /month|package|flat|fixed/i.test(claim) ||
    (!claim && Number(source.min) === 1 && Number(source.max) === 1)
  )
    return "package";
  return ["per_item", "per item", "each"].includes(claim)
    ? "per_item"
    : "per_1000";
}
export const pricingFields = {
  priceCurrency: z.enum(priceCurrencies).nullable().default(null),
  priceUnit: z.enum(priceUnits).nullable().default("per_1000"),
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
// The marketplace uses a fixed SMM rate basis. Missing legacy metadata no
// longer requires an operator to choose a unit. Explicit package prices stay fixed.
export function effectivePriceUnit(row: PricingMetadata) {
  return row.priceUnit ?? "per_1000";
}

export function standardRate(amount: string, unit?: string | null): string {
  if (unit !== "per_item" || !/^\d+(\.\d+)?$/.test(amount)) return amount;
  const [whole, fraction = ""] = amount.split(".");
  const scale = Math.max(0, fraction.length - 3);
  const digits = (whole + fraction.padEnd(3, "0"))
    .replace(/^0+(?=\d)/, "")
    .padStart(scale + 1, "0");
  return scale
    ? `${digits.slice(0, -scale) || "0"}.${digits.slice(-scale)}`
    : digits;
}

export function hasPricingBasis(row: PricingMetadata) {
  return (
    priceCurrencies.includes(row.priceCurrency as PriceCurrency) &&
    priceUnits.includes(effectivePriceUnit(row) as PriceUnit) &&
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
    quantity < 1 ||
    quantity < row.min ||
    quantity > row.max ||
    !Number.isFinite(row.priceAmount) ||
    row.priceAmount < 0
  )
    return null;
  return (
    (row.priceAmount * quantity) /
    (effectivePriceUnit(row) === "per_1000" ? 1000 : 1)
  );
}

// Decimal-string arithmetic keeps tiny rates and large quantities exact.
export function quantityQuoteExact(
  row: PricingMetadata & {
    priceAmount: number;
    min: number;
    max: number;
    catalogueListing?: string;
    sourceRate?: string | null;
  },
  quantity: number
) {
  if (quantityQuote(row, quantity) == null) return null;
  const rate =
    row.catalogueListing === "api_source"
      ? row.sourceRate
      : String(row.priceAmount);
  if (!rate || !/^\d+(\.\d+)?$/.test(rate)) return null;
  const [whole, fraction = ""] = rate.split(".");
  const scale =
    fraction.length + (effectivePriceUnit(row) === "per_1000" ? 3 : 0);
  const digits = (BigInt(whole + fraction) * BigInt(quantity))
    .toString()
    .padStart(scale + 1, "0");
  const integer = scale ? digits.slice(0, -scale) : digits;
  const decimals = (scale ? digits.slice(-scale) : "")
    .replace(/0+$/, "")
    .padEnd(2, "0");
  return `${integer}.${decimals}`;
}

// Inputs are the validated non-negative decimal strings returned by quantityQuoteExact.
export function compareQuoteAmounts(left: string, right: string) {
  const [li, lf = ""] = left.split(".");
  const [ri, rf = ""] = right.split(".");
  const scale = Math.max(lf.length, rf.length);
  const a = BigInt(li + lf.padEnd(scale, "0"));
  const b = BigInt(ri + rf.padEnd(scale, "0"));
  return a < b ? -1 : a > b ? 1 : 0;
}
