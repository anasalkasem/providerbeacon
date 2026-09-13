import { describe, expect, it } from "vitest";
import {
  catalogueSource,
  classifyService,
  isStale,
  normalizeApiService,
  reviewBlockers,
} from "./serviceNormalizer";
import { reviewBatchInput, reviewEditInput } from "../shared/serviceReview";

const row = {
  service: 100,
  name: "TikTok Views",
  category: "Views",
  rate: "1.00",
  min: "100",
  max: "1000",
};
describe("conservative catalogue normalization", () => {
  it("separates target countries from platforms and ignores website referrer lists", () => {
    expect(
      classifyService({
        name: "MALAYSIA Website Iphone 14 Traffic",
        category: "Website traffic",
      })
    ).toMatchObject({
      platform: "Website",
      category: "Website traffic",
      countryCode: "MY",
    });
    expect(
      classifyService({
        name: "🇻🇳 VIETNAM Website Traffic [FB, IG, YT, Tiktok, Google, Reddit]",
      })
    ).toMatchObject({
      platform: "Website",
      category: "Website traffic",
      countryCode: "VN",
    });
    expect(
      classifyService({ name: "YouTube Subscribers - India" })
    ).toMatchObject({
      platform: "YouTube",
      category: "Subscribers",
      countryCode: "IN",
    });
  });
  it("flags ambiguous platforms/countries rather than inventing a match", () => {
    const result = classifyService({
      name: "Instagram TikTok Views - US 🇺🇸 🇨🇦",
    });
    expect(result.platform).toBe("Unknown");
    expect(result.countryCode).toBeNull();
    expect(result.notes).toContain("ambiguous_platform");
    expect(result.notes).toContain("ambiguous_country");
    expect(
      classifyService({ name: "Arabic Instagram Followers" }).countryCode
    ).toBeNull();
  });
  it("never derives refill duration from the API boolean", () => {
    expect(classifyService({ ...row, refill: true })).toMatchObject({
      refillMode: "manual",
      refillDays: null,
    });
    expect(classifyService({ ...row, refill: false })).toMatchObject({
      refillMode: "none",
      refillDays: null,
    });
    expect(classifyService(row)).toMatchObject({
      refillMode: "unknown",
      refillDays: null,
    });
    expect(
      classifyService({ name: "TikTok Views - 30 days refill", refill: true })
    ).toMatchObject({ refillMode: "manual", refillDays: 30 });
    expect(
      classifyService({ name: "TikTok Views - 30 days refill", refill: false })
        .notes
    ).toContain("refill_conflict");
  });
  it("keeps source catalogue values while omitting credentials and arbitrary fields", () => {
    const source = catalogueSource({
      ...row,
      key: "secret",
      apiKey: "secret",
      token: "secret",
      authorization: "secret",
      nested: { key: "secret" },
    });
    expect(source).toEqual(row);
    expect(normalizeApiService(row, 0)).toMatchObject({
      externalId: "100",
      priceAmount: "1.0000",
      minOrder: 100,
      maxOrder: 1000,
      platform: "TikTok",
    });
  });
  it.each([
    { rate: "" },
    { rate: null },
    { rate: false },
    { rate: "NaN" },
    { min: undefined },
    { min: 0 },
    { max: 10 },
    { service: "" },
    { rate: 0 },
    { max: 2147483648 },
  ])("rejects invalid rows atomically: %j", patch => {
    expect(() => normalizeApiService({ ...row, ...patch }, 2)).toThrow("row 3");
  });
  it("treats a recent unchanged API sync as fresh but does not invent absent evidence", () => {
    expect(
      isStale({ priceCheckedAt: new Date(0), sourceUpdatedAt: new Date() })
    ).toBe(false);
    expect(isStale({ priceCheckedAt: null, sourceUpdatedAt: null })).toBe(true);
    expect(
      isStale({ priceCheckedAt: new Date(0), sourceUpdatedAt: new Date(0) })
    ).toBe(true);
  });
  it("requires pricing evidence and eligibility, and caps batches with unique IDs", () => {
    expect(
      reviewBlockers({
        platform: "TikTok",
        category: "Views",
        pricingConfirmed: false,
        policyReviewed: false,
        evidenceUrl: null,
        normalizationVersion: 1,
        priceAmount: "1",
        minOrder: 100,
        maxOrder: 1000,
        available: true,
      })
    ).toEqual(["pricing_unconfirmed", "policy_check", "evidence_missing"]);
    expect(
      reviewBatchInput.safeParse({
        items: Array.from({ length: 51 }, (_, i) => ({
          id: i + 1,
          revision: 1,
        })),
        reason: "Evidence checked",
      }).success
    ).toBe(false);
    expect(
      reviewBatchInput.safeParse({
        items: [
          { id: 1, revision: 1 },
          { id: 1, revision: 1 },
        ],
        reason: "Evidence checked",
      }).success
    ).toBe(false);
    const edit = {
      id: 1,
      revision: 1,
      platform: "TikTok",
      category: "Views",
      countryCode: null,
      price: 1,
      minOrder: 100,
      maxOrder: 1000,
      refillMode: "unknown",
      refillDays: null,
      evidenceUrl: null,
      pricingConfirmed: false,
      policyReviewed: false,
      reason: "Classification checked",
    };
    expect(reviewEditInput.safeParse(edit).success).toBe(true);
    expect(
      reviewEditInput.safeParse({ ...edit, pricingConfirmed: true }).success
    ).toBe(false);
    expect(
      reviewEditInput.safeParse({
        ...edit,
        evidenceUrl: "https://example.com/api?key=secret",
      }).success
    ).toBe(false);
  });
});
