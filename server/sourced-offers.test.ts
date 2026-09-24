import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { publicEvidenceUrl, publicOfferMetadata, sameSourceHost, sourcedBatchInput } from "../shared/sourcedOffers";
import { formatPrice } from "../client/src/i18n/pricing";
import { comparablePrices, quantityQuote } from "../shared/pricing";

describe("wholesale SMM source offers", () => {
  const groups = ["follow-sale", "smmpakpanel", "smm-africa"].map(name => JSON.parse(readFileSync(`docs/catalogue/2026-09-14-smm/${name}.json`, "utf8")));
  const first = groups[0][0];
  it("preserves exact prices, source IDs and real quantity limits for all fifteen offers", () => {
    expect(groups.flat()).toHaveLength(15);
    for (const offers of groups) {
      const parsed = sourcedBatchInput.parse({ providerId: 1, offers, reason: "Official SMM source extraction" });
      parsed.offers.forEach((offer, i) => {
        expect(offer.unit).toBe("per_1000"); expect(offer.price).toBe(offers[i].price);
        expect(offer.minOrder).toBe(offers[i].minOrder); expect(offer.maxOrder).toBe(offers[i].maxOrder);
      });
    }
    expect(groups[2].every((offer: any) => !offer.sourceServiceId)).toBe(true);
  });
  it("rejects fabricated default quantities, contradictory ranges and lossy rates", () => {
    for (const patch of [{ minOrder: undefined }, { maxOrder: undefined }, { minOrder: 500, maxOrder: 100 }, { price: 0.01856 }, { refillMode: "none", refillDays: 30 }, { startMinutesMin: 10, startMinutesMax: 5 }]) {
      expect(sourcedBatchInput.safeParse({ providerId: 1, offers: [{ ...first, ...patch }], reason: "Official source review" }).success).toBe(false);
    }
  });
  it("quotes quantities without rounding to whole cents and excludes ineligible quantities", () => {
    const offer = { priceAmount: .044, priceCurrency: "USD", priceUnit: "per_1000", min: 50, max: 200000 };
    expect(quantityQuote(offer, 5000)).toBe(.22);
    for (const quantity of [49, 200001, 1.5, NaN, Infinity]) expect(quantityQuote(offer, quantity)).toBeNull();
    expect(quantityQuote({ ...offer, priceUnit: "package", packageDescription: "10 posts per month" }, 1000)).toBeNull();
  });
  it("does not rank different or unknown refill policies as equivalent", () => {
    const basis = { priceCurrency: "USD", priceUnit: "per_1000", countryCode: "WW", platform: "Instagram", category: "Followers", refill: "30-day refill" };
    expect(comparablePrices([basis, { ...basis }])).toBe(true);
    expect(comparablePrices([basis, { ...basis, refill: "No refill" }])).toBe(false);
    expect(comparablePrices([{ ...basis, refill: "—" }, { ...basis, refill: "—" }])).toBe(false);
  });
});

describe("source-attributed monthly offers", () => {
  it("validates the eleven prepared offers and does not accept review/publication flags", () => {
    let count = 0;
    for (const provider of ["99-social", "lyfe-marketing", "webfx"]) {
      const offers = JSON.parse(readFileSync(`docs/catalogue/2026-09-14/${provider}.json`, "utf8"));
      const parsed = sourcedBatchInput.parse({ providerId: 1, offers, reason: "Reviewed public source extraction", status: "active", pricingConfirmed: true });
      expect(parsed).not.toHaveProperty("status"); expect(parsed).not.toHaveProperty("pricingConfirmed");
      count += parsed.offers.length;
    }
    expect(count).toBe(11);
  });
  it("rejects credential-bearing evidence and lookalike source hosts", () => {
    for (const url of ["http://example.com/prices", "https://user:secret@example.com/prices", "https://example.com/prices?key=secret", "https://example.com:8443/prices"]) expect(publicEvidenceUrl.safeParse(url).success).toBe(false);
    expect(sameSourceHost("https://example.com", "https://www.example.com/pricing")).toBe(true);
    expect(sameSourceHost("https://example.com", "https://example.com.evil.test/pricing")).toBe(false);
  });
  it("bounds batch size and rejects duplicate offers", () => {
    const [offer] = JSON.parse(readFileSync("docs/catalogue/2026-09-14/webfx.json", "utf8"));
    const base = { providerId: 1, reason: "Public source extraction" };
    expect(sourcedBatchInput.safeParse({ ...base, offers: [offer, offer] }).success).toBe(false);
    expect(sourcedBatchInput.safeParse({ ...base, offers: Array.from({ length: 21 }, (_, i) => ({ ...offer, slug: `offer-${i}` })) }).success).toBe(false);
  });
  it("exports only whitelisted source fields and suppresses invalid source links", () => {
    const date = new Date("2026-09-14T00:00:00Z");
    const output = publicOfferMetadata({ sourceKind: "public_web", priceUnit: "package", evidenceUrl: "https://example.com/pricing", priceCheckedAt: date, sourceUpdatedAt: date, sourceData: { nameAr: "عرض", terms: "Terms", apiKey: "private", priceType: "from" } });
    expect(output).toMatchObject({ billingCycle: "monthly", priceType: "from", nameAr: "عرض", checkedAt: date.toISOString() });
    expect(JSON.stringify(output)).not.toContain("private");
    expect(publicOfferMetadata({ sourceKind: "provider_api", priceUnit: "per_1000", evidenceUrl: "https://user:secret@example.com/", priceCheckedAt: date, sourceUpdatedAt: date, sourceData: { nameAr: "unreviewed" } })).toMatchObject({ nameAr: null, billingCycle: null, sourceUrl: null });
  });
  it("labels monthly packages and starting fees explicitly in both languages", () => {
    const row = { priceAmount: 3000, priceCurrency: "USD", priceUnit: "package" as const, billingCycle: "monthly" as const, priceType: "from" as const };
    expect(formatPrice("en", row)).toBe("From USD 3,000.00");
    expect(formatPrice("ar", row)).toContain("ابتداءً من");
  });
});
