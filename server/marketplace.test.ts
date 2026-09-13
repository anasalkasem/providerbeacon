import { describe, expect, it } from "vitest";
import {
  providerBySlug,
  providerFor,
  providers,
  serviceFor,
  services,
  type Provider,
  type Service,
} from "../client/src/data/marketplace";

describe("SMM Aggregator Marketplace Data Model", () => {
  it("contains at least 8 verified SMM providers with complete audit specifications", () => {
    expect(providers.length).toBeGreaterThanOrEqual(8);

    for (const provider of providers) {
      expect(provider.id).toBeTruthy();
      expect(provider.name).toBeTruthy();
      expect(provider.slug).toBeTruthy();
      expect(provider.tier).toBeTruthy();
      expect(provider.score).toBeGreaterThanOrEqual(80);
      expect(provider.score).toBeLessThanOrEqual(100);
      expect(provider.apiLatency).toMatch(/\d+ms/);
      expect(provider.apiUptime).toMatch(/\d+\.\d+%/);
      expect(provider.successRate).toBeGreaterThan(90);
      expect(provider.minDeposit).toMatch(/^\$\d+/);
      expect(provider.paymentMethods.length).toBeGreaterThanOrEqual(3);
      expect(provider.specialties.length).toBeGreaterThanOrEqual(2);
      expect(provider.auditSignals.apiReliability).toBeGreaterThan(80);
      expect(provider.auditSignals.priceFairness).toBeGreaterThan(80);
      expect(provider.auditSignals.refillFulfillment).toBeGreaterThan(80);
    }
  });

  it("successfully retrieves provider by slug", () => {
    const northstar = providerBySlug("northstar-social");
    expect(northstar).toBeDefined();
    expect(northstar?.name).toBe("Northstar Social");
    expect(northstar?.tier).toBe("Tier 1 Direct Source");
    expect(northstar?.score).toBe(96);

    const apex = providerBySlug("apex-smm");
    expect(apex).toBeDefined();
    expect(apex?.name).toBe("ApexSMM Direct");
    expect(apex?.apiLatency).toBe("88ms");
  });

  it("links every service to a valid provider", () => {
    expect(services.length).toBeGreaterThanOrEqual(12);

    for (const service of services) {
      const provider = providerFor(service);
      expect(provider).toBeDefined();
      expect(provider.id).toBe(service.providerId);
      expect(service.priceAmount).toBeGreaterThan(0);
      expect(service.retention).toBeGreaterThan(80);
    }
  });

  it("identifies Tier 1 Direct Source providers correctly", () => {
    const directProviders = providers.filter((p) => p.tier.includes("Direct Source"));
    expect(directProviders.length).toBeGreaterThanOrEqual(2);
    expect(directProviders.some((p) => p.slug === "northstar-social")).toBe(true);
    expect(directProviders.some((p) => p.slug === "apex-smm")).toBe(true);
  });

  it("correctly filters providers with sub-120ms API latency", () => {
    const fastProviders = providers.filter((p) => parseInt(p.apiLatency) <= 120);
    expect(fastProviders.length).toBeGreaterThanOrEqual(3);
    for (const p of fastProviders) {
      expect(parseInt(p.apiLatency)).toBeLessThanOrEqual(120);
    }
  });

  it("correctly filters providers supporting Crypto / USDT payments", () => {
    const cryptoProviders = providers.filter((p) =>
      p.paymentMethods.some((m) => m.toLowerCase().includes("crypto") || m.toLowerCase().includes("usdt"))
    );
    expect(cryptoProviders.length).toBeGreaterThanOrEqual(5);
  });

  it("correctly resolves service by ID for comparison", () => {
    const service1 = serviceFor("s1");
    expect(service1).toBeDefined();
    expect(service1?.platform).toBe("Instagram");
    expect(service1?.category).toBe("Followers");

    const nonExistent = serviceFor("non-existent-id");
    expect(nonExistent).toBeUndefined();
  });
});
