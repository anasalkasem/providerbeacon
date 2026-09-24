import { afterEach, describe, expect, it, vi } from "vitest";
import {
  automaticSourcePricing,
  fetchProviderPricing,
} from "./providerPricing";
import {
  extractPerThousandRows,
  fetchPublicRateTable,
  publicRateTableUrl,
  serviceNameFingerprint,
} from "./publicRateTable";

const endpoint = new URL("https://foollo.com/api/v2");
const source = {
  service: 1450,
  name: "إعادة نشر & مشاركات انستجرام",
  type: "Default",
  min: "10",
  max: "1000000",
};
const header =
  '<thead><tr><td colspan="6">خدمات انستجرام</td></tr><tr><th>ID</th><th>Service</th><th>Rate per 1000</th><th>Max order</th><th>Description</th></tr></thead>';
const row =
  '<tr><td data-title="ID">1450</td><td data-title="Service">إعادة نشر &amp; مشاركات انستجرام</td><td data-title="Rate per 1000">32.0562 EGP</td><td>10 - 1000000</td><td><div class="modal">Provider terms</div></td></tr>';
const html = `<html><body><script>neverExecute()</script><p>Personal dashboard data must not be retained.</p><table>${header}<tbody>${row}</tbody></table></body></html>`;
const snapshot = () => ({
  currency: "EGP",
  perThousandEvidenceUrl: null,
  perThousandRows: {
    url: "https://foollo.com/en/services",
    names: extractPerThousandRows(html),
  },
});
afterEach(() => vi.unstubAllGlobals());

describe("service-specific public pricing evidence", () => {
  it("matches each source service by ID and decoded name, using its authenticated currency", () => {
    expect(snapshot().perThousandRows.names).toEqual({
      "1450": serviceNameFingerprint(source.name),
    });
    expect(automaticSourcePricing(source, endpoint.href, snapshot())).toEqual({
      currency: "EGP",
      unit: "per_1000",
      evidenceUrl: endpoint.href,
    });
    expect(
      automaticSourcePricing(
        { ...source, currency: "USD" },
        endpoint.href,
        snapshot()
      ).currency
    ).toBe("USD");
    expect(
      automaticSourcePricing(
        { ...source, name: "  إعادة نشر & مشاركات\n انستجرام  " },
        endpoint.href,
        snapshot()
      ).unit
    ).toBe("per_1000");
  });

  it("keeps source currency and explicit exceptions independent of optional public-table matches", () => {
    expect(automaticSourcePricing({...source, service:1588, name:"Another service"}, endpoint.href, snapshot()).unit).toBe("per_1000");
    for(const type of ["Package","Subscriptions"])
      expect(automaticSourcePricing({...source,type},endpoint.href,snapshot()).unit).toBe("package");
    expect(automaticSourcePricing({...source,unit:"each"},endpoint.href,snapshot()).unit).toBe("per_item");
    expect(automaticSourcePricing({...source,currency:"XXX"},endpoint.href,snapshot()).currency).toBeNull();
  });

  it("rejects ambiguous duplicate IDs, contradictory columns, prose and nested description tables", () => {
    expect(
      extractPerThousandRows(
        `<table>${header}<tbody>${row}${row}</tbody></table>`
      )
    ).toEqual({});
    expect(
      extractPerThousandRows(
        html.replace('data-title="Rate per 1000"', 'data-title="Rate per item"')
      )
    ).toEqual({});
    expect(
      extractPerThousandRows(
        `<p>Rate per 1000</p><table><tbody>${row}</tbody></table>`
      )
    ).toEqual({});
    expect(
      extractPerThousandRows(
        `<table><tr><td><table>${header}<tbody>${row}</tbody></table></td></tr></table>`
      )
    ).toEqual({});
    const conflicting = `<table>${header}<tbody>${row}</tbody></table><table>${header.replace("Rate per 1000", "Rate per item")}<tbody>${row}</tbody></table>`;
    expect(extractPerThousandRows(conflicting)).toEqual({});
  });

  it("reads repeated category headers and rejects only the conflicting rows", () => {
    const another = row.replaceAll("1450", "1451");
    const mixed = `<table>${header}<tbody>${row}</tbody>${header}<tbody>${another}</tbody></table>`;
    expect(Object.keys(extractPerThousandRows(mixed))).toEqual([
      "1450",
      "1451",
    ]);
  });

  it("supports matching same-origin tables for other providers without hardcoding their currency", () => {
    const other = "https://provider.example/api/v2";
    const data = {
      ...snapshot(),
      currency: "PKR",
      perThousandRows: {
        ...snapshot().perThousandRows,
        url: "https://provider.example/services",
      },
    };
    expect(automaticSourcePricing(source, other, data)).toMatchObject({
      currency: "PKR",
      unit: "per_1000",
    });
    for (const url of [
      "http://provider.example/api/v2",
      "https://provider.example/api/v1",
      "https://user:secret@provider.example/api/v2",
      "https://provider.example/api/v2?key=secret",
    ])
      expect(publicRateTableUrl(new URL(url))).toBeNull();
  });

  it("does not require fetching a public table and persists only authenticated currency", async () => {
    const fetcher = vi.fn(async (url: URL | string, init?: RequestInit) => {
      if (String(url) === endpoint.href)
        return new Response(
          '{"balance":"12345.6789","currency":"EGP","private":"sensitive"}'
        );
      expect(String(url)).toBe("https://foollo.com/en/services");
      expect(init?.body).toBeUndefined();
      expect(init?.headers).toBeUndefined();
      expect(init?.redirect).toBe("error");
      return new Response(html);
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await fetchProviderPricing(
      endpoint,
      "synthetic-secret",
      null
    );
    expect(result).toEqual({currency:"EGP",perThousandEvidenceUrl:null});
    expect(JSON.stringify(result)).not.toMatch(
      /12345|sensitive|synthetic|Personal|neverExecute|<script/
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not use partial oversized tables or follow redirects, and keeps import available", async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode(html));
                controller.enqueue(new Uint8Array(2 * 1024 * 1024));
              },
              cancel,
            })
          )
      )
    );
    expect(await fetchPublicRateTable(endpoint)).toBeUndefined();
    expect(cancel).toHaveBeenCalledOnce();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("redirect or connection failure");
      })
    );
    expect(await fetchPublicRateTable(endpoint)).toBeUndefined();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(html, {
            status: 302,
            headers: { location: "https://other.example" },
          })
      )
    );
    expect(await fetchPublicRateTable(endpoint)).toBeUndefined();
  });
});
