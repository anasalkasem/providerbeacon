import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogueIndex, comparisonSelection } from "../client/src/lib/catalogue";
import { providers, services } from "../client/src/data/marketplace";

const state = vi.hoisted(() => ({ db: null as any }));
vi.mock("./db", () => ({ getDb: async () => state.db }));
import { getMarketplaceSnapshot, seedMarketplaceIfEmpty } from "./marketplaceDb";

beforeEach(() => { state.db = null; vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("MARKETPLACE_DEMO_MODE", "true"); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("public catalogue availability", () => {
  it("never returns fixtures in production, including when demo mode was accidentally enabled", async () => {
    expect(await getMarketplaceSnapshot()).toEqual({ providers: [], services: [], source: "unavailable", pagination: { total: 0, nextCursor: null } });
  });
  it("blocks the seed operation in production", async () => {
    expect(await seedMarketplaceIfEmpty()).toEqual({ seeded: false, reason: "demo_disabled" });
  });
  it("requires an explicit development demo setting", async () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("MARKETPLACE_DEMO_MODE", "false");
    expect((await getMarketplaceSnapshot()).providers).toEqual([]);
    vi.stubEnv("MARKETPLACE_DEMO_MODE", "true");
    expect((await getMarketplaceSnapshot()).source).toBe("seed");
  });
  it("distinguishes a database failure from an empty catalogue without substituting fixtures", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    state.db = { select: () => { throw new Error("isolated database failure"); } };
    expect(await getMarketplaceSnapshot()).toEqual({ providers: [], services: [], source: "unavailable", pagination: { total: 0, nextCursor: null } });
  });
});

describe("catalogue identity and comparison", () => {
  const real = { ...providers[0]!, id: "provider-20", slug: "real-provider", name: "Independent provider", score: null, verified: false };
  const offer = { ...services[0]!, id: "service-40", providerId: real.id };
  it("resolves an offer to its current provider instead of a demo provider", () => {
    expect(catalogueIndex([real], [offer]).providerFor(offer).name).toBe("Independent provider");
  });
  it("drops orphan offers and refuses to attribute one to a different provider", () => {
    const orphan = { ...offer, providerId: "suspended-provider" };
    const index = catalogueIndex([real], [orphan]);
    expect(index.services).toEqual([]);
    expect(() => index.providerFor(orphan)).toThrow("not in the current catalogue");
  });
  it("does not choose a random offer when a response contains duplicate comparison IDs", () => {
    const index = catalogueIndex([real], [offer, { ...offer, name: "Conflicting offer" }]);
    expect(index.serviceFor(offer.id)).toBeUndefined();
  });
  it("keeps explicit selections and reports missing services without substituting unrelated offers", () => {
    const index = catalogueIndex([real], [offer]);
    expect(comparisonSelection(`${offer.id},unavailable,${offer.id}`, index.serviceFor)).toEqual({ selected: [offer], missing: true });
    expect(comparisonSelection(null, index.serviceFor)).toEqual({ selected: [], missing: false });
  });
});
