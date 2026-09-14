import { eq } from "drizzle-orm";
import { assistantExchangeRates } from "../drizzle/schema";
import { type ExchangeTable } from "../shared/exchange";
import { priceCurrencies } from "../shared/pricing";
import { getDb } from "./db";
import { readLimitedJson } from "./assistantModel";

export const EXCHANGE_SOURCE = "https://www.exchangerate-api.com";
const MAX_AGE = 36 * 60 * 60 * 1000;

export function validExchangeTable(table: ExchangeTable, now = Date.now()) {
  return (
    Number.isSafeInteger(table.asOf) &&
    Number.isSafeInteger(table.nextUpdate) &&
    table.asOf <= now + 300000 &&
    now - table.asOf <= MAX_AGE &&
    table.nextUpdate > table.asOf &&
    table.nextUpdate - table.asOf <= 48 * 3600000 &&
    table.rates.USD === "1" &&
    Object.values(table.rates).every(
      rate => /^\d{1,15}(\.\d{1,15})?$/.test(rate) && Number(rate) > 0
    )
  );
}

export function parseExchangeResponse(
  value: unknown,
  now = Date.now()
): ExchangeTable | null {
  const data = value as Record<string, unknown> | null;
  if (
    !data ||
    data.result !== "success" ||
    data.base_code !== "USD" ||
    !data.rates ||
    typeof data.rates !== "object"
  )
    return null;
  const input = data.rates as Record<string, unknown>;
  const rates: Record<string, string> = {};
  for (const currency of priceCurrencies) {
    const rate = input[currency];
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0)
      rates[currency] = String(rate);
  }
  const table = {
    asOf: Number(data.time_last_update_unix) * 1000,
    nextUpdate: Number(data.time_next_update_unix) * 1000,
    rates,
  };
  return validExchangeTable(table, now) ? table : null;
}

let cached: ExchangeTable | null = null;
let inFlight: Promise<ExchangeTable | null> | null = null;
let retryAt = 0;

export async function getAssistantExchangeTable(): Promise<ExchangeTable | null> {
  const now = Date.now();
  if (cached && validExchangeTable(cached, now) && now < cached.nextUpdate)
    return cached;
  if (inFlight) return inFlight;
  if (now < retryAt)
    return cached && validExchangeTable(cached, now) ? cached : null;
  inFlight = (async () => {
    try {
      const db = await getDb();
      if (!cached && db) {
        const [stored] = await db
          .select()
          .from(assistantExchangeRates)
          .where(eq(assistantExchangeRates.baseCode, "USD"))
          .limit(1);
        if (stored && validExchangeTable(stored, now)) {
          cached = stored;
          if (now < stored.nextUpdate) return cached;
        }
      }
      retryAt = now + 3600000;
      const response = await fetch("https://open.er-api.com/v6/latest/USD", {
        redirect: "error",
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("FX unavailable");
      }
      const table = parseExchangeResponse(
        await readLimitedJson(response, 64000),
        now
      );
      if (!table) throw new Error("Invalid FX data");
      cached = table;
      if (db)
        await db
          .insert(assistantExchangeRates)
          .values({ baseCode: "USD", ...table })
          .onDuplicateKeyUpdate({ set: table });
      return table;
    } catch {
      return cached && validExchangeTable(cached, now) ? cached : null;
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
