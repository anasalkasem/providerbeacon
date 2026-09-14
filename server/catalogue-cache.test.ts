import { describe, expect, it, vi } from "vitest";
import { AsyncResultCache } from "./catalogueCache";
import { assertRealProviderSlug, retiredDemoSlugs } from "./retiredDemoProviders";

describe("bounded catalogue caching", () => {
  it("coalesces 100 simultaneous readers and expires the result", async () => {
    let now = 0; const cache = new AsyncResultCache<number>(10, 2, () => now);
    const read = vi.fn(async () => 42);
    expect(await Promise.all(Array.from({length: 100}, () => cache.get("page", read)))).toEqual(Array(100).fill(42));
    expect(read).toHaveBeenCalledTimes(1);
    now = 11; await cache.get("page", read); expect(read).toHaveBeenCalledTimes(2);
  });
  it("cannot restore an obsolete response after invalidation during a read", async () => {
    const cache = new AsyncResultCache<number>(); let finish!: (value: number) => void;
    const old = cache.get("page", () => new Promise(resolve => { finish = resolve; }));
    await Promise.resolve(); cache.clear();
    await cache.get("page", async () => 2); finish(1); await old;
    expect(await cache.get("page", async () => 3)).toBe(2);
  });
  it("bounds distinct cached searches and never retains failures or oversized responses", async () => {
    const cache = new AsyncResultCache<string>(1000, 2);
    await cache.get("a", async () => "a"); await cache.get("b", async () => "b"); await cache.get("c", async () => "c");
    expect(cache.size).toBe(2);
    await expect(cache.get("error", async () => { throw new Error("offline"); })).rejects.toThrow("offline");
    expect(await cache.get("error", async () => "recovered")).toBe("recovered");
    await cache.get("large", async () => "x".repeat(128001));
    expect(await cache.get("large", async () => "small")).toBe("small");
    await cache.get("unavailable", async () => "unavailable", () => false);
    expect(await cache.get("unavailable", async () => "database")).toBe("database");
  });
  it("rejects every retired fixture identity while allowing real provider slugs", () => {
    for (const slug of retiredDemoSlugs) expect(() => assertRealProviderSlug(slug.toUpperCase())).toThrow("Retired demo");
    expect(() => assertRealProviderSlug("justanotherpanel")).not.toThrow();
  });
});
