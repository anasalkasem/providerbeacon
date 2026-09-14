export type ExchangeTable = {
  asOf: number;
  nextUpdate: number;
  rates: Record<string, string>;
};
export type ExactFraction = { numerator: bigint; denominator: bigint };

function decimal(value: string): ExactFraction | null {
  if (!/^\d{1,35}(\.\d{1,35})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return {
    numerator: BigInt(whole + fraction),
    denominator: BigInt("1" + "0".repeat(fraction.length)),
  };
}

export function convertedAmount(
  amount: string,
  from: string,
  to: string,
  table: ExchangeTable | null
): ExactFraction | null {
  const value = decimal(amount);
  if (!value) return null;
  if (from === to) return value;
  if (!table) return null;
  const source = decimal(table.rates[from] ?? "");
  const target = decimal(table.rates[to] ?? "");
  if (
    !source ||
    !target ||
    source.numerator <= BigInt(0) ||
    target.numerator <= BigInt(0)
  )
    return null;
  return {
    numerator: value.numerator * target.numerator * source.denominator,
    denominator: value.denominator * target.denominator * source.numerator,
  };
}

export function compareFractions(a: ExactFraction, b: ExactFraction) {
  const left = a.numerator * b.denominator;
  const right = b.numerator * a.denominator;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function formatConvertedAmount(value: ExactFraction) {
  const scale = BigInt("1000000000000");
  const rounded =
    (value.numerator * scale * BigInt(2) + value.denominator) /
    (value.denominator * BigInt(2));
  if (rounded === BigInt(0) && value.numerator > BigInt(0))
    return "<0.000000000001";
  const digits = rounded.toString().padStart(13, "0");
  return `${digits.slice(0, -12)}.${digits.slice(-12).replace(/0+$/, "").padEnd(2, "0")}`;
}
