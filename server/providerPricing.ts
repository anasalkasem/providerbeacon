import {
  priceCurrencies,
  sourceRateBasis,
  type PriceCurrency,
} from "../shared/pricing";
import type { ProviderPricingSnapshot } from "../shared/providerPricing";

export function sourceCurrency(value: unknown): PriceCurrency | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return priceCurrencies.includes(code as PriceCurrency)
    ? (code as PriceCurrency)
    : null;
}

export function hasPerThousandTable(html: string) {
  const table = html.match(
    /<table\b[^>]*\bid=["']service-table-3["'][^>]*>\s*<thead\b[^>]*>([\s\S]{0,8000}?)<\/thead>/i
  )?.[1];
  return Boolean(
    table &&
      /<th\b[^>]*>\s*ID\s*<\/th>/i.test(table) &&
      /<th\b[^>]*>\s*Service\s*<\/th>/i.test(table) &&
      /<th\b[^>]*>\s*Rate per 1,?000\s*<\/th>/i.test(table)
  );
}

async function accountCurrency(
  endpoint: URL,
  apiKey: string,
  previous: string | null
) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: apiKey, action: "balance" }),
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return sourceCurrency(previous);
    }
    const reader = response.body.getReader();
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8192) return sourceCurrency(previous);
        chunks.push(value);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      // Store only the currency. Balance, credentials and other account fields
      // never enter snapshots, model prompts, logs or public responses.
      if (
        body &&
        !Array.isArray(body) &&
        !body.error &&
        typeof body.currency === "string"
      )
        return sourceCurrency(body.currency);
    } finally {
      await reader.cancel().catch(() => {});
    }
  } catch {
    /* Retain a previously known currency for the same account. */
  }
  return sourceCurrency(previous);
}

export async function fetchProviderPricing(
  endpoint: URL,
  apiKey: string,
  previousCurrency: string | null
): Promise<ProviderPricingSnapshot> {
  // Account rates are authenticated. The standard SMM basis no longer depends
  // on scraping a public HTML table, which omitted most real catalogue rows.
  return {
    currency: await accountCurrency(endpoint, apiKey, previousCurrency),
    perThousandEvidenceUrl: null,
  };
}

export function automaticSourcePricing(
  source: Record<string, unknown>,
  endpoint: string,
  snapshot?: ProviderPricingSnapshot | null
) {
  const currency =
    source.currency != null
      ? sourceCurrency(source.currency)
      : sourceCurrency(snapshot?.currency);
  const unit = sourceRateBasis(source);
  return { currency, unit, evidenceUrl: endpoint };
}
