import { describe, expect, it } from "vitest";
import { services } from "./testFixtures";
import { savedPrice, watchChange } from "../shared/buyerWorkspace";
import { priceHistoryKey } from "./priceHistory";
import { comparisonFacts, comparisonGroup } from "../shared/offerComparison";

describe("buyer price decisions", () => {
  const service = {
    ...services[0]!,
    id: "service-1",
    catalogueListing: "api_source" as const,
    sourceRate: "2.60",
    historyKey: "same-basis",
    priceAmount: 2.6,
  };
  it("calculates the saved quantity and target without floating-point rounding", () => {
    const baseline = savedPrice(service);
    expect(
      watchChange(
        baseline,
        { ...service, sourceRate: "2.40", priceAmount: 2.4 },
        5000,
        "12.00"
      )
    ).toMatchObject({
      status: "lower",
      original: "13.00",
      now: "12.00",
      targetReached: true,
    });
    const precise = {
      ...service,
      sourceRate: "1.000000000000000000002",
      priceAmount: 1,
    };
    expect(
      watchChange(
        savedPrice(precise),
        { ...precise, sourceRate: "1.000000000000000000001" },
        1000,
        "1.000000000000000000000"
      )
    ).toMatchObject({ status: "lower", targetReached: false });
  });
  it("never calls currency, unit or terms changes a discount", () => {
    for (const patch of [
      { priceCurrency: "INR" },
      { priceUnit: "per_item" as const },
      { refill: "30-day refill" },
    ])
      expect(
        watchChange(
          savedPrice(service),
          {
            ...service,
            ...patch,
            historyKey: "different",
            priceAmount: 0.1,
            sourceRate: "0.1",
          },
          1000,
          "100"
        )
      ).toMatchObject({
        status: "terms_changed",
        percentage: null,
        targetReached: false,
      });
    expect(watchChange(savedPrice(service), null, 1000, "100").status).toBe(
      "unavailable"
    );
    expect(
      watchChange(
        savedPrice({ ...service, historyKey: undefined }),
        service,
        1000,
        null
      ).status
    ).toBe("terms_changed");
  });
  it("changes the history identity for terms but not prices or sync timestamps", () => {
    const row = {
      sourceKind: "provider_api",
      reviewStatus: "pending",
      sourceCurrency: "USD",
      sourcePriceUnit: "per_1000",
      sourcePricingIdentity: "evidence",
      name: "Followers",
      refillMode: "automatic",
      refillDays: 30,
      minOrder: 100,
      maxOrder: 10000,
    };
    expect(
      priceHistoryKey({ ...row, sourceRate: "2", sourceUpdatedAt: new Date() })
    ).toBe(priceHistoryKey({ ...row, sourceRate: "1" }));
    for (const patch of [
      { sourceCurrency: "INR" },
      { refillDays: 7 },
      { name: "Views" },
      { sourcePriceUnit: "per_item" },
      { maxOrder: 20000 },
    ])
      expect(priceHistoryKey({ ...row, ...patch })).not.toBe(
        priceHistoryKey(row)
      );
  });
  it("explains known differences without inventing quality evidence", () => {
    const first = { ...service, countryCode: "WW", refill: "30-day refill" };
    const second = { ...first, refill: "No refill" };
    expect(comparisonGroup(first)).not.toBe(comparisonGroup(second));
    expect(comparisonFacts([first, second], 1000).differingFields).toEqual([
      "refill",
    ]);
    expect(comparisonGroup({ ...first, category: "Other" })).toBeNull();
    expect(
      watchChange(savedPrice(service), { ...service, priceUnit: null }, 1, null)
        .now
    ).toBeNull();
  });
});
