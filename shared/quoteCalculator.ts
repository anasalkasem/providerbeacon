import type { PriceUnit } from "./pricing";
// Explicit user-entered quotes for a common scope, unit and currency. No vendor prices or FX.
export function quoteTotal(
  amount: string,
  quantity: number,
  unit: PriceUnit
): number | null {
  if (!/^\d{1,7}(\.\d{1,4})?$/.test(amount.trim())) return null;
  const value = Number(amount);
  if (
    value > 1000000 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 1000000
  )
    return null;
  const [whole, fraction = ""] = amount.trim().split(".");
  const scaled = BigInt(whole!) * BigInt(10000) + BigInt(fraction.padEnd(4, "0"));
  const total = unit === "package" ? scaled : scaled * BigInt(quantity);
  return Number(total) / (unit === "per_1000" ? 10000000 : 10000);
}
