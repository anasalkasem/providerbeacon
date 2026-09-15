import { createHash } from "node:crypto";
import { parse, type DefaultTreeAdapterTypes } from "parse5";
import type { ProviderPricingSnapshot } from "../shared/providerPricing";

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
const LIMIT = 2 * 1024 * 1024;

export function publicRateTableUrl(endpoint: URL) {
  if (
    endpoint.protocol !== "https:" ||
    endpoint.pathname !== "/api/v2" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    return null;
  // This provider publishes its canonical English-labelled table at /en/services.
  return new URL(
    endpoint.hostname === "foollo.com" ? "/en/services" : "/services",
    endpoint
  ).href;
}

function children(node: Node): Node[] {
  return "childNodes" in node ? node.childNodes : [];
}
function tag(node: Node) {
  return "tagName" in node ? node.tagName : "";
}
function content(node: Node): string {
  const parts: string[] = [];
  const stack = [node];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.nodeName === "#text")
      parts.push((current as DefaultTreeAdapterTypes.TextNode).value);
    else if (!["script", "style", "template"].includes(tag(current)))
      stack.push(...children(current).slice().reverse());
  }
  return parts.join("").normalize("NFKC").replace(/\s+/g, " ").trim();
}
export function serviceNameFingerprint(name: string) {
  return createHash("sha256")
    .update(name.normalize("NFKC").replace(/\s+/g, " ").trim())
    .digest("hex");
}

// Parse inert HTML, never scripts. Headings alone cannot qualify another row,
// package or service whose identity differs from the authenticated catalogue.
export function extractPerThousandRows(html: string): Record<string, string> {
  if (Buffer.byteLength(html) > LIMIT) return {};
  const names: Record<string, string> = {};
  const seen = new Set<string>();
  const stack: Node[] = [parse(html)];
  while (stack.length) {
    const node = stack.pop()!;
    if (tag(node) !== "table") {
      stack.push(...children(node).slice().reverse());
      continue;
    }
    let columns: { id: number; name: number; rate: number } | null = null;
    const rows = [...children(node)].reverse();
    while (rows.length) {
      const row = rows.pop()!;
      if (tag(row) === "table") continue; // Nested descriptions are not catalogue rows.
      if (tag(row) !== "tr") {
        rows.push(...children(row).slice().reverse());
        continue;
      }
      const cells = children(row).filter(cell =>
        ["td", "th"].includes(tag(cell))
      ) as Element[];
      if (cells.some(cell => tag(cell) === "th")) {
        const labels = cells.map(cell => content(cell).toLowerCase());
        const id = labels.indexOf("id"),
          name = labels.indexOf("service");
        const rate = labels.findIndex(label => /^rate per 1,?000$/.test(label));
        columns = id >= 0 && name >= 0 ? { id, name, rate } : null;
        continue;
      }
      if (
        !columns ||
        cells.length <= Math.max(columns.id, columns.name, columns.rate)
      )
        continue;
      const id = content(cells[columns.id]!);
      if (!/^\d{1,64}$/.test(id)) continue;
      // Even identical duplicate IDs are ambiguous. Never let the last row win.
      if (seen.has(id)) {
        delete names[id];
        continue;
      }
      seen.add(id);
      if (columns.rate < 0) continue;
      const name = content(cells[columns.name]!);
      const rate = content(cells[columns.rate]!);
      const rateTitle = cells[columns.rate]!.attrs.find(
        attr => attr.name === "data-title"
      )?.value;
      if (
        !name ||
        name.length > 2000 ||
        !/^\d+(?:\.\d+)?(?:\s+[A-Z]{3})?$/i.test(rate) ||
        (rateTitle && !/^rate per 1,?000$/i.test(rateTitle.trim()))
      )
        continue;
      names[id] = serviceNameFingerprint(name);
    }
  }
  return names;
}

// The integration endpoint has passed assertPublicHttpsUrl before this call.
// Same origin only, no redirects or account credentials on the public request.
export async function fetchPublicRateTable(
  endpoint: URL
): Promise<ProviderPricingSnapshot["perThousandRows"]> {
  const url = publicRateTableUrl(endpoint);
  if (!url) return undefined;
  try {
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
    if (
      !response.ok ||
      !response.body ||
      Number(response.headers.get("content-length")) > LIMIT
    ) {
      await response.body?.cancel();
      return undefined;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > LIMIT) return undefined; // Never trust a truncated table.
        chunks.push(value);
      }
      const names = extractPerThousandRows(
        Buffer.concat(chunks).toString("utf8")
      );
      return Object.keys(names).length ? { url, names } : undefined;
    } finally {
      await reader.cancel().catch(() => {});
    }
  } catch {
    /* Missing public evidence does not prevent catalogue import. */
  }
  return undefined;
}
