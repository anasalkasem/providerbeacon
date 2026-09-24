import { afterEach, describe, expect, it, vi } from "vitest";
import {
  automaticSourcePricing,
  fetchProviderPricing,
} from "./providerPricing";
import {
  hasPricingBasis,
  standardRate,
  quantityQuoteExact,
} from "../shared/pricing";

const endpoint = new URL("https://provider.example/api/v2");
afterEach(() => vi.unstubAllGlobals());
describe("standard SMM source pricing", () => {
  it("reads only the authenticated currency, without scraping a public table or retaining account data", async () => {
    const fetcher = vi.fn(async (url: URL, init?: RequestInit) => {
      expect(String(url)).toBe(endpoint.href);
      expect((init!.body as URLSearchParams).get("action")).toBe("balance");
      expect(init?.redirect).toBe("error");
      return new Response(
        JSON.stringify({
          balance: "987.654",
          currency: "INR",
          privateField: "private",
        })
      );
    });
    vi.stubGlobal("fetch", fetcher);
    const snapshot = await fetchProviderPricing(
      endpoint,
      "synthetic-key",
      null
    );
    expect(snapshot).toEqual({ currency: "INR", perThousandEvidenceUrl: null });
    expect(JSON.stringify(snapshot)).not.toMatch(/987|private|synthetic/);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("retains a known currency on temporary failures but never invents a missing or unsupported currency", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 }))
    );
    expect((await fetchProviderPricing(endpoint, "test", "EUR")).currency).toBe(
      "EUR"
    );
    expect(
      (await fetchProviderPricing(endpoint, "test", null)).currency
    ).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"currency":"XXX"}'))
    );
    expect(
      (await fetchProviderPricing(endpoint, "test", "EUR")).currency
    ).toBeNull();
  });
  it("bounds account responses and cancels an oversized body", async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(8193).fill(32));
              },
              cancel,
            })
          )
      )
    );
    expect(
      (await fetchProviderPricing(endpoint, "test", null)).currency
    ).toBeNull();
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("uses the SMM default for any provider without requiring optional public HTML evidence", () => {
    for (const row of [
      {},
      { type: "Default" },
      { type: "Custom Comments" },
      { unit: "unknown" },
    ]) {
      const result = automaticSourcePricing(row, endpoint.href, {
        currency: "USD",
        perThousandEvidenceUrl: null,
      });
      expect(result).toEqual({
        currency: "USD",
        unit: "per_1000",
        evidenceUrl: endpoint.href,
      });
      expect(
        hasPricingBasis({
          priceCurrency: result.currency,
          priceUnit: result.unit,
        })
      ).toBe(true);
    }
    const noCurrency = automaticSourcePricing({}, endpoint.href);
    expect(noCurrency.currency).toBeNull();
    expect(
      hasPricingBasis({
        priceCurrency: noCurrency.currency,
        priceUnit: noCurrency.unit,
      })
    ).toBe(false);
  });
  it("preserves explicit currencies and fixed packages while normalizing item rates exactly for presentation", () => {
    expect(
      automaticSourcePricing({ currency: "EUR", unit: "each" }, endpoint.href, {
        currency: "USD",
        perThousandEvidenceUrl: null,
      })
    ).toEqual({
      currency: "EUR",
      unit: "per_item",
      evidenceUrl: endpoint.href,
    });
    expect(standardRate("0.00000001", "per_item")).toBe("0.00001");
    expect(standardRate("1.234567890123456789", "per_item")).toBe(
      "1234.567890123456789"
    );
    for (const type of ["Package", "Subscriptions"])
      expect(
        automaticSourcePricing({ type, currency: "USD" }, endpoint.href).unit
      ).toBe("package");
    expect(
      automaticSourcePricing(
        { unit: "per month", currency: "USD" },
        endpoint.href
      ).unit
    ).toBe("package");
    expect(
      automaticSourcePricing(
        { type: "Default", min: "1", max: "1", currency: "USD" },
        endpoint.href
      ).unit
    ).toBe("package");
  });
  it("quotes legacy SMM rows with the same exact arithmetic as current rows", () => {
    const row = {
      priceCurrency: "USD",
      priceUnit: null,
      priceAmount: 1.2346,
      sourceRate: "1.23456789",
      catalogueListing: "api_source",
      min: 1,
      max: 100000,
    };
    expect(quantityQuoteExact(row, 2500)).toBe("3.086419725");
    expect(quantityQuoteExact({ ...row, priceUnit: "per_1000" }, 2500)).toBe(
      "3.086419725"
    );
    expect(
      quantityQuoteExact({ ...row, priceCurrency: null }, 2500)
    ).toBeNull();
  });
});
