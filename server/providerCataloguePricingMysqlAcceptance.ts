import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { providerIntegrations, providerRecords, serviceRecords } from "../drizzle/schema";
import { invalidateCatalogueCaches } from "./catalogueCache";
import { getProviderCataloguePricing } from "./providerCataloguePricing";
import { appRouter } from "./routers";

// Registered inside the existing isolated, local-only MySQL suite so fixture
// cleanup cannot race a second test file against the shared test database.
export function providerCataloguePricingAcceptanceCases(
  database: () => any,
  providerId: () => number,
  addIntegration: () => Promise<number>
) {
  const offer = (id: number, patch: Partial<typeof serviceRecords.$inferInsert> = {}): typeof serviceRecords.$inferInsert => ({
    providerId: providerId(), slug: `price-summary-${id}`, externalId: String(id),
    platform: "TikTok", category: "Views", name: `Price summary service ${id}`,
    status: "active", reviewStatus: "approved", available: true, incomplete: false,
    normalizationVersion: 1, pricingConfirmed: true, priceCurrency: "USD", priceUnit: "per_1000",
    priceAmount: "1.0000", minOrder: 100, maxOrder: 10000,
    evidenceUrl: "https://provider.example/services", sourceUpdatedAt: new Date(),
    ...patch,
  });
  const read = () => getProviderCataloguePricing([providerId()]);

  describe("public provider price summaries against MySQL", () => {
    it("aggregates beyond a service page and separates currencies and units without exposing hidden offers", async () => {
      await database().insert(serviceRecords).values([
        ...Array.from({ length: 40 }, (_, index) => offer(index + 1, { priceAmount: (index + 1).toFixed(4) })),
        offer(41, { priceCurrency: "EUR", priceUnit: "per_item", priceAmount: "8.2500" }),
        offer(42, { priceUnit: "per_item", priceAmount: "9.5000" }),
        offer(43, { status: "paused", priceAmount: "0.0001" }),
        offer(44, { screeningStatus: "held", priceAmount: "0.0001" }),
        offer(45, { reviewStatus: "changes_requested", priceAmount: "0.0001" }),
        offer(46, { status: "draft", priceAmount: "0.0001" }),
        offer(47, { available: false, priceAmount: "0.0001" }),
      ]);
      const other = await database().insert(providerRecords).values({ slug: "price-summary-other", name: "Other provider", initials: "OP", status: "active" }).$returningId();
      await database().insert(serviceRecords).values(offer(48, { providerId: other[0].id, priceAmount: "0.0001" }));
      const summary = (await read())?.[`provider-${providerId()}`];
      expect(summary).toMatchObject({ additionalGroups: 0, unconfirmedServices: 0 });
      expect(summary?.ranges).toEqual([
        { currency: "USD", unit: "per_1000", minimum: "1.00", maximum: "40.00", services: 40 },
        { currency: "USD", unit: "per_item", minimum: "9.5", maximum: "9.5", services: 1 },
        { currency: "EUR", unit: "per_item", minimum: "8.25", maximum: "8.25", services: 1 },
      ]);
      const caller = appRouter.createCaller({ user: null, req: { headers: {}, ip: "127.0.0.1" }, res: { setHeader: vi.fn() } } as any);
      const directory = await caller.marketplace.snapshot({ scope: "providers", q: "Test provider", limit: 1 });
      expect(directory.providers).toHaveLength(1);
      expect(directory.providers[0]).toMatchObject({ id: `provider-${providerId()}`, pricingSummary: summary });
      expect(JSON.stringify(directory)).not.toMatch(/credentialCiphertext|sourceData|local-test-key/);
    });

    it("preserves exact API rates, flags unknown bases and keeps stored review decisions unchanged", async () => {
      const integration = await addIntegration();
      await database().update(providerIntegrations).set({ status: "active", lastSyncedAt: new Date() }).where(eq(providerIntegrations.id, integration));
      await database().update(providerRecords).set({ apiCataloguePublished: true }).where(eq(providerRecords.id, providerId()));
      const source = offer(100, {
        sourceKind: "provider_api", status: "draft", reviewStatus: "pending", incomplete: true, pricingConfirmed: false,
        sourceRate: "0.123456789123456789", sourceCurrency: "USD", sourcePriceUnit: "per_1000",
        sourcePricingConfirmedAt: new Date(), sourcePricingIdentity: "a".repeat(64), sourcePricingEvidenceUrl: "https://provider.example/services",
      });
      await database().insert(serviceRecords).values([
        source,
        { ...source, slug: "price-summary-unknown", externalId: "101", sourceRate: "3.1400", sourcePriceUnit: null },
        { ...source, slug: "price-summary-withdrawn", externalId: "102", sourceRate: "0.0001", reviewStatus: "changes_requested" },
        { ...source, slug: "price-summary-held", externalId: "103", sourceRate: "0.0001", screeningStatus: "held" },
      ]);
      const before = await database().select().from(serviceRecords).where(eq(serviceRecords.providerId, providerId()));
      const summary = (await read())?.[`provider-${providerId()}`];
      expect(summary).toEqual({
        ranges: [{ currency: "USD", unit: "per_1000", minimum: "0.123456789123456789", maximum: "0.123456789123456789", services: 1 }],
        additionalGroups: 0, unconfirmedServices: 1,
      });
      expect(await database().select().from(serviceRecords).where(eq(serviceRecords.providerId, providerId()))).toEqual(before);
      await database().update(providerIntegrations).set({ status: "disabled" }).where(eq(providerIntegrations.id, integration));
      invalidateCatalogueCaches();
      expect((await read())?.[`provider-${providerId()}`]).toEqual({ ranges: [], additionalGroups: 0, unconfirmedServices: 0 });
    });

    it("does not leak prices of unpublished or suspended provider profiles", async () => {
      await database().insert(serviceRecords).values(offer(1));
      expect((await read())?.[`provider-${providerId()}`].ranges).toHaveLength(1);
      for (const status of ["draft", "suspended"] as const) {
        await database().update(providerRecords).set({ status }).where(eq(providerRecords.id, providerId()));
        invalidateCatalogueCaches();
        expect((await read())?.[`provider-${providerId()}`].ranges).toEqual([]);
      }
    });
  });
}
