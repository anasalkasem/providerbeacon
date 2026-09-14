import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { publicEvidenceUrl, publicOfferMetadata, sameSourceHost, sourcedBatchInput } from "../shared/sourcedOffers";
import { formatPrice, unitLabel } from "../client/src/i18n/pricing";

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
    expect(unitLabel("en", row)).toContain("per month");
    expect(unitLabel("ar", row)).toContain("شهريًا");
  });
});
