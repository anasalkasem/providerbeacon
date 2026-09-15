import { afterEach, describe, expect, it, vi } from "vitest";
import {
  automaticSourcePricing,
  fetchProviderPricing,
  hasPerThousandTable,
} from "./providerPricing";

const endpoint = new URL("https://smmpanelone.com/api/v2");
const heading =
  '<table class="table" id="service-table-3"><thead><tr><th>ID</th><th>Service</th><th class="nowrap">Rate per 1000</th></tr></thead>';
const evidence = "https://smmpanelone.com/services";
afterEach(() => vi.unstubAllGlobals());

describe("source pricing evidence", () => {
  it("reads the account currency and bounded public heading without retaining or sending account details", async () => {
    const cancel = vi.fn();
    const fetcher = vi.fn(async (url: URL | string, init?: RequestInit) => {
      if (String(url).endsWith("/api/v2")) {
        expect((init!.body as URLSearchParams).get("action")).toBe("balance");
        expect(init?.redirect).toBe("error");
        return new Response(
          JSON.stringify({
            balance: "987.654",
            currency: "INR",
            privateField: "must-not-retain",
          })
        );
      }
      expect(init?.body).toBeUndefined();
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode("<!-- currency: USD -->" + heading)
            );
          },
          cancel,
        })
      );
    });
    vi.stubGlobal("fetch", fetcher);
    const snapshot = await fetchProviderPricing(
      endpoint,
      "synthetic-provider-key",
      null
    );
    expect(snapshot).toEqual({
      currency: "INR",
      perThousandEvidenceUrl: evidence,
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/987|private|synthetic/);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("does not infer currency from a dollar symbol or pricing from generic page text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async url =>
          new Response(
            String(url).endsWith("/api/v2")
              ? JSON.stringify({ balance: "100", error: "not available" })
              : "<p>Rate per 1000 $1.00</p>"
          )
      )
    );
    expect(await fetchProviderPricing(endpoint, "synthetic-key", null)).toEqual(
      { currency: null, perThousandEvidenceUrl: null }
    );
    expect(hasPerThousandTable(heading.replace("Rate per 1000", "Rate"))).toBe(
      false
    );
  });

  it("retains a previously known account currency on a temporary failure, but clears an unsupported new currency", async () => {
    const other = new URL("https://provider.example/api/v2");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("private error", { status: 503 }))
    );
    expect(
      (await fetchProviderPricing(other, "synthetic-key", "EUR")).currency
    ).toBe("EUR");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"currency":"XXX"}'))
    );
    expect(
      (await fetchProviderPricing(other, "synthetic-key", "EUR")).currency
    ).toBeNull();
  });

  it("rejects oversized account responses and stops reading a large public page", async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async url =>
        String(url).endsWith("/api/v2")
          ? new Response(" ".repeat(8193) + '{"currency":"USD"}')
          : new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(new Uint8Array(600 * 1024).fill(32));
                },
                cancel,
              })
            )
      )
    );
    expect(await fetchProviderPricing(endpoint, "synthetic-key", null)).toEqual(
      { currency: null, perThousandEvidenceUrl: null }
    );
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("applies the checked rate table only to this endpoint's standard quantity services", () => {
    const snapshot = { currency: "INR", perThousandEvidenceUrl: evidence };
    expect(
      automaticSourcePricing({ type: "Default" }, endpoint.href, snapshot)
    ).toEqual({
      currency: "INR",
      unit: "per_1000",
      evidenceUrl: evidence,
    });
    for (const patch of [
      { type: "Package" },
      { type: "Subscriptions" },
      { type: "Unknown" },
      { type: "Default", unit: "unknown" },
      { type: "Default", currency: "XXX" },
    ])
      expect(
        automaticSourcePricing(patch, endpoint.href, snapshot).unit
      ).toBeNull();
    expect(
      automaticSourcePricing(
        { type: "Default" },
        "https://other.example/api/v2",
        snapshot
      ).unit
    ).toBeNull();
    expect(
      automaticSourcePricing({ type: "Default" }, endpoint.href, {
        ...snapshot,
        perThousandEvidenceUrl: null,
      }).unit
    ).toBeNull();
    expect(
      automaticSourcePricing({ type: "Default" }, endpoint.href, {
        ...snapshot,
        currency: null,
      }).unit
    ).toBeNull();
  });

  it("uses explicit row currency and units instead of overriding them with account defaults", () => {
    const result = automaticSourcePricing(
      { currency: "EUR", unit: "each" },
      endpoint.href,
      { currency: "USD", perThousandEvidenceUrl: evidence }
    );
    expect(result).toEqual({
      currency: "EUR",
      unit: "per_item",
      evidenceUrl: endpoint.href,
    });
    expect(
      automaticSourcePricing(
        { type: "Package", currency: "EUR", unit: "each" },
        endpoint.href
      ).unit
    ).toBeNull();
  });
});
