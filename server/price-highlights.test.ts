import { describe, expect, it } from "vitest";
import {
  lowestVisiblePriceIds,
  orderVisibleOffers,
} from "../client/src/lib/priceHighlights";
import type { Service } from "../client/src/data/marketplace";
import { services } from "./testFixtures";

const offer = (id: string, patch: Partial<Service> = {}): Service => ({
  ...services[0]!,
  id,
  countryCode: "US",
  refill: "No refill",
  min: 100,
  max: 10000,
  ...patch,
});

describe("price highlights in the visible catalogue", () => {
  it("moves all exact minima first without mutating rows or comparing currencies", () => {
    const rows = [
      offer("featured", { priceAmount: 3, featured: true }),
      offer("inr-high", { priceAmount: 200, priceCurrency: "INR" }),
      offer("usd-low", { priceAmount: 2 }),
      offer("unknown", { priceAmount: 0.1, priceUnit: null }),
      offer("inr-low", { priceAmount: 100, priceCurrency: "INR" }),
      offer("usd-tie", { priceAmount: 2 }),
    ];
    const original = [...rows];
    const { rows: ordered, lowest } = orderVisibleOffers(rows, 1000);
    expect(ordered.map(row => row.id)).toEqual([
      "usd-low",
      "inr-low",
      "usd-tie",
      "featured",
      "inr-high",
      "unknown",
    ]);
    expect(rows).toEqual(original);
    expect(ordered[0]).toBe(rows[2]);
    // Explicit server-side price order is respected; the evidence-based
    // highlights remain available without moving those rows.
    const explicit = orderVisibleOffers(rows, 1000, false);
    expect(explicit.rows).toEqual(original);
    expect(explicit.lowest).toEqual(lowest);
    expect(orderVisibleOffers(rows, 10001).rows).toEqual(original);
  });
  it("keeps currencies and service scopes in independent comparison groups", () => {
    const rows = [
      offer("usd-low", { priceAmount: 2 }),
      offer("usd-high", { priceAmount: 3, featured: true }),
      offer("inr-low", { priceAmount: 100, priceCurrency: "INR" }),
      offer("inr-high", { priceAmount: 200, priceCurrency: "INR" }),
      offer("different-market", { priceAmount: 0.1, countryCode: "CA" }),
      offer("different-service", { priceAmount: 0.1, category: "Views" }),
      offer("different-unit", { priceAmount: 0.1, priceUnit: "per_item" }),
      offer("different-quality", { priceAmount: 0.1, quality: "Premium" }),
      offer("different-refill", { priceAmount: 0.1, refill: "30-day refill" }),
    ];
    expect([...lowestVisiblePriceIds(rows, 1000)]).toEqual([
      "usd-low",
      "inr-low",
    ]);
    expect([...lowestVisiblePriceIds(rows.slice(1), 1000)]).toEqual([
      "inr-low",
    ]);
  });

  it("excludes unknown pricing, unknown terms and starting prices from ranking", () => {
    const unconfirmed: Partial<Service>[] = [
      { priceCurrency: null },
      { priceCurrency: "ZZZ" },
      { priceUnit: null },
      { priceUnit: "package", packageDescription: "A fixed package" },
      { countryCode: null },
      { platform: "Unknown" },
      { category: "Other" },
      { refill: "—" },
      { refill: "" },
      { refill: "Refill available; duration unspecified" },
      { priceType: "from" },
    ];
    for (const patch of unconfirmed) {
      expect(
        lowestVisiblePriceIds([offer("a", patch), offer("b", patch)], 1000).size
      ).toBe(0);
    }
  });

  it("recalculates the eligible group when the requested quantity changes", () => {
    const rows = [
      offer("small-order", { priceAmount: 1, max: 1000 }),
      offer("large-order", { priceAmount: 2, min: 1001 }),
      offer("all-orders", { priceAmount: 3 }),
    ];
    expect([...lowestVisiblePriceIds(rows, 1000)]).toEqual(["small-order"]);
    expect([...lowestVisiblePriceIds(rows, 5000)]).toEqual(["large-order"]);
    for (const quantity of [0, -1, 1.5, NaN, Infinity, 10001])
      expect(lowestVisiblePriceIds(rows, quantity).size).toBe(0);
  });

  it("uses original decimal rates and highlights every tied minimum", () => {
    const api = { catalogueListing: "api_source", priceAmount: 1 } as const;
    const rows = [
      offer("low", { ...api, sourceRate: "1.000000000000000001" }),
      offer("high", { ...api, sourceRate: "1.000000000000000002" }),
      offer("tie", { ...api, sourceRate: "1.0000000000000000010" }),
      offer("invalid", { ...api, sourceRate: "invalid" }),
    ];
    expect([...lowestVisiblePriceIds(rows, 5000)]).toEqual(["low", "tie"]);
    expect(lowestVisiblePriceIds([rows[0]!], 5000).size).toBe(0);
  });
});
