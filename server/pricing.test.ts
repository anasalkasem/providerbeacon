import { describe, expect, it } from "vitest";
import { catalogueInput } from "../shared/catalogueQuery";
import { comparablePrices } from "../shared/pricing";
import { reviewEditInput } from "../shared/serviceReview";
import { formatPrice, unitLabel } from "../client/src/i18n/pricing";
import { classifyService, normalizeApiService } from "./serviceNormalizer";

const pricing = {
  priceCurrency: "USD",
  priceUnit: "per_1000",
  platform: "Website",
  category: "SEO",
  countryCode: "US",
};
const edit = {
  id: 1,
  revision: 1,
  ...pricing,
  price: 1,
  minOrder: 1,
  maxOrder: 1000,
  refillMode: "none",
  refillDays: null,
  evidenceUrl: "https://provider.example/offer",
  pricingConfirmed: true,
  policyReviewed: true,
  reason: "Service-specific evidence checked",
};
describe("explicit pricing", () => {
  it("requires a supported currency and unit before confirmation", () => {
    expect(reviewEditInput.safeParse(edit).success).toBe(true);
    for (const patch of [
      { priceCurrency: null },
      { priceCurrency: "ZZZ" },
      { priceUnit: null },
    ])
      expect(reviewEditInput.safeParse({ ...edit, ...patch }).success).toBe(
        false
      );
    expect(
      reviewEditInput.safeParse({
        ...edit,
        priceCurrency: null,
        priceUnit: null,
        pricingConfirmed: false,
      }).success
    ).toBe(true);
  });
  it("requires package contents and accepts evidenced per-item pricing", () => {
    expect(
      reviewEditInput.safeParse({ ...edit, priceUnit: "package" }).success
    ).toBe(false);
    expect(
      reviewEditInput.safeParse({
        ...edit,
        priceUnit: "package",
        packageDescription: "One technical SEO review",
      }).success
    ).toBe(true);
    expect(
      reviewEditInput.safeParse({
        ...edit,
        priceUnit: "per_item",
        priceCurrency: "INR",
      }).success
    ).toBe(true);
  });
  it("rejects mixed-basis price sorting at the API boundary", () => {
    for (const fields of [
      {},
      { priceCurrency: "USD" },
      { priceCurrency: "USD", priceUnit: "package" },
    ])
      expect(
        catalogueInput.safeParse({
          scope: "services",
          sort: "price",
          ...fields,
        }).success
      ).toBe(false);
    expect(
      catalogueInput.safeParse({
        scope: "services",
        sort: "price",
        priceCurrency: "INR",
        priceUnit: "per_item",
      }).success
    ).toBe(true);
  });
  it("only assigns a lowest price to compatible offers with a specified market", () => {
    expect(comparablePrices([pricing, pricing])).toBe(true);
    for (const patch of [
      { priceCurrency: "EUR" },
      { priceUnit: "per_item" },
      { priceUnit: "package", packageDescription: "SEO campaign" },
      { category: "Views" },
      { platform: "TikTok" },
      { countryCode: "CA" },
      { countryCode: null },
    ])
      expect(comparablePrices([pricing, { ...pricing, ...patch }])).toBe(false);
    expect(
      comparablePrices([
        { ...pricing, countryCode: null },
        { ...pricing, countryCode: null },
      ])
    ).toBe(false);
  });
  it("keeps exact provider rates without interpreting currency or unit", () => {
    const row = normalizeApiService(
      {
        service: 1,
        name: "Website SEO audit",
        rate: "1.234567",
        currency: "INR",
        unit: "each",
        min: 1,
        max: 1,
      },
      0
    );
    expect(row.sourceRate).toBe("1.234567");
    expect(row.sourceData).toMatchObject({
      rate: "1.234567",
      currency: "INR",
      unit: "each",
    });
    expect(row).not.toHaveProperty("priceCurrency");
    expect(row).not.toHaveProperty("priceUnit");
  });
  it("retains four-decimal prices and labels Arabic units without a dollar assumption", () => {
    expect(
      formatPrice("en", {
        ...pricing,
        priceAmount: 0.0001,
        priceCurrency: "INR",
      })
    ).toBe("INR 0.0001");
    expect(unitLabel("ar", { priceUnit: "per_item" })).toBe("للوحدة الواحدة");
    expect(
      formatPrice("ar", { priceAmount: 1, priceCurrency: null })
    ).not.toContain("$");
  });
  it("classifies explicit popup website traffic while retaining ambiguous destinations", () => {
    expect(
      classifyService({
        name: "Canada Mainstream Traffic from iPhone Devices [RPA - Popup Ads]",
      })
    ).toMatchObject({
      platform: "Website",
      category: "Website traffic",
      countryCode: "CA",
    });
    expect(
      classifyService({ name: "Instagram and TikTok traffic" }).platform
    ).toBe("Unknown");
  });
});
