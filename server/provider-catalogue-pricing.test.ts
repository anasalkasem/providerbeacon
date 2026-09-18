import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectProviderPriceSummaries, displayDecimal, type ProviderPriceGroup } from "../shared/providerCataloguePricing";
import { invalidateCatalogueCaches } from "./catalogueCache";

const state = vi.hoisted(() => ({ groups: [] as ProviderPriceGroup[], reads: 0, fail: false, available: true }));
vi.mock("./db", () => ({ getDb: async () => state.available ? {
  select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ groupBy: () => ({ limit: async () => {
    state.reads++;
    if (state.fail) throw new Error("test database unavailable");
    return state.groups;
  } }) }) }) }) }),
} : null }));
import { getProviderCataloguePricing } from "./providerCataloguePricing";

const group = (patch: Partial<ProviderPriceGroup> = {}): ProviderPriceGroup => ({ providerId: 1, currency: "USD", unit: "per_1000", minimum: "0.123456000000000000000000000000", maximum: "4.250000000000000000000000000000", services: 250, ...patch });

describe("source-backed provider price summaries", () => {
  beforeEach(() => { invalidateCatalogueCaches(); state.groups = [group()]; state.reads = 0; state.fail = false; state.available = true; });

  it("preserves decimal source precision without Number rounding", () => {
    expect(displayDecimal("0.000123456789123456789000000000")).toBe("0.000123456789123456789");
    expect(displayDecimal("8.2500000000")).toBe("8.25");
    for (const value of [null, "", "NaN", "-1", "0", "1e-4", "0.0000"]) expect(displayDecimal(value)).toBeNull();
  });
  it("keeps providers, currencies and units independent and retains full-catalogue counts", () => {
    const result = collectProviderPriceSummaries([1, 2], [group(), group({ providerId: 2, minimum: "2.50", maximum: "3.00" }), group({ currency: "EUR", unit: "per_item", minimum: "8.25", maximum: "8.25", services: 2 })]);
    expect(result["provider-1"].ranges).toHaveLength(2);
    expect(result["provider-1"].ranges[0]).toMatchObject({ minimum: "0.123456", maximum: "4.25", services: 250 });
    expect(result["provider-2"].ranges[0].minimum).toBe("2.5");
  });
  it("never groups unknown currencies or units into misleading ranges", () => {
    const result = collectProviderPriceSummaries([1], [group({ currency: null }), group({ unit: null, services: 7 }), group({ providerId: 999 })]);
    expect(result["provider-1"]).toEqual({ ranges: [], additionalGroups: 0, unconfirmedServices: 257 });
    expect(result["provider-999"]).toBeUndefined();
  });
  it("bounds returned groups and distinguishes empty providers", () => {
    const result = collectProviderPriceSummaries([1, 2], ["USD", "EUR", "GBP", "CAD"].map(currency => group({ currency })));
    expect(result["provider-1"].ranges).toHaveLength(3);
    expect(result["provider-1"].additionalGroups).toBe(1);
    expect(result["provider-2"]).toEqual({ ranges: [], additionalGroups: 0, unconfirmedServices: 0 });
  });
  it("batches provider reads, coalesces equal scopes and invalidates on catalogue changes", async () => {
    await Promise.all([getProviderCataloguePricing([2, 1]), getProviderCataloguePricing([1, 2, 1])]);
    expect(state.reads).toBe(1);
    invalidateCatalogueCaches();
    await getProviderCataloguePricing([1, 2]);
    expect(state.reads).toBe(2);
  });
  it("does not cache a failed read as zero prices", async () => {
    state.fail = true;
    expect(await getProviderCataloguePricing([1])).toBeNull();
    state.fail = false;
    expect((await getProviderCataloguePricing([1]))?.["provider-1"].ranges[0].minimum).toBe("0.123456");
    expect(state.reads).toBe(2);
  });
  it("rejects invalid scopes and avoids database reads for empty scopes", async () => {
    expect(await getProviderCataloguePricing([])).toEqual({});
    expect(state.reads).toBe(0);
    await expect(getProviderCataloguePricing([0])).rejects.toThrow("Invalid provider");
    await expect(getProviderCataloguePricing(Array.from({length: 101}, (_, i) => i + 1))).rejects.toThrow("Invalid provider");
  });
});
