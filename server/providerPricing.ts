import { priceCurrencies, type PriceCurrency } from "../shared/pricing";
import type { ProviderPricingSnapshot } from "../shared/providerPricing";

export function sourceCurrency(value: unknown): PriceCurrency | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return priceCurrencies.includes(code as PriceCurrency)
    ? (code as PriceCurrency)
    : null;
}

// Only this provider's public rate table has been checked for this adapter.
// A different hostname, endpoint or service type never inherits its sale unit.
function rateTableUrl(endpoint: URL) {
  return endpoint.origin === "https://smmpanelone.com" &&
    endpoint.pathname === "/api/v2" &&
    !endpoint.search &&
    !endpoint.hash &&
    !endpoint.username &&
    !endpoint.password
    ? "https://smmpanelone.com/services"
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

async function tableEvidence(endpoint: URL): Promise<string | null> {
  const url = rateTableUrl(endpoint);
  if (!url) return null;
  try {
    // Read only the table heading, never the multi-megabyte public catalogue.
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return null;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = "",
      bytes = 0;
    try {
      while (bytes < 512 * 1024) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value.subarray(0, 512 * 1024 - bytes);
        bytes += chunk.byteLength;
        html += decoder.decode(chunk, { stream: true });
        if (hasPerThousandTable(html)) return url;
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
  } catch {
    /* Missing evidence leaves the unit unconfirmed. */
  }
  return null;
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
  const [currency, perThousandEvidenceUrl] = await Promise.all([
    accountCurrency(endpoint, apiKey, previousCurrency),
    tableEvidence(endpoint),
  ]);
  return { currency, perThousandEvidenceUrl };
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
  if (!currency) return { currency, unit: null, evidenceUrl: null };
  if (
    typeof source.type === "string" &&
    /package|subscription/i.test(source.type)
  )
    return { currency, unit: null, evidenceUrl: null };
  const claim =
    typeof source.unit === "string" ? source.unit.trim().toLowerCase() : null;
  const unit = ["per_1000", "per 1000", "per1000"].includes(claim ?? "")
    ? ("per_1000" as const)
    : ["per_item", "per item", "each"].includes(claim ?? "")
      ? ("per_item" as const)
      : null;
  if (unit) return { currency, unit, evidenceUrl: endpoint };
  // Unknown/contradictory explicit units and packages require individual review.
  if (source.unit != null) return { currency, unit: null, evidenceUrl: null };
  const tableUrl = rateTableUrl(new URL(endpoint));
  if (
    tableUrl &&
    snapshot?.perThousandEvidenceUrl === tableUrl &&
    source.type === "Default"
  )
    return { currency, unit: "per_1000" as const, evidenceUrl: tableUrl };
  return { currency, unit: null, evidenceUrl: null };
}
