import { describe, expect, it } from "vitest";
import {
  providerMonthAnniversary,
  providerPlanPricing,
} from "../shared/providerBusinessPricing";
import { subscriptionInput } from "../shared/providerBusiness";

describe("provider monthly pricing", () => {
  const start = new Date("2026-01-31T12:45:00Z");
  it("quotes 19 USD before activation without starting the introductory clock", () => {
    expect(providerPlanPricing(null)).toMatchObject({
      currency: "USD",
      phase: "not_started",
      currentMonthlyCents: 1900,
      firstActivatedAt: null,
      introEndsAt: null,
    });
  });
  it("prices three calendar months at the introductory rate and switches exactly at the anniversary", () => {
    const change = Date.parse("2026-04-30T12:45:00Z");
    expect(providerPlanPricing(start, start.getTime() - 1).phase).toBe(
      "scheduled"
    );
    for (const at of [
      start.getTime(),
      Date.parse("2026-02-28T12:45:00Z"),
      Date.parse("2026-03-31T12:45:00Z"),
      change - 1,
    ]) {
      expect(providerPlanPricing(start, at)).toMatchObject({
        phase: "intro",
        currentMonthlyCents: 1900,
      });
    }
    expect(providerPlanPricing(start, change)).toMatchObject({
      phase: "standard",
      currentMonthlyCents: 2900,
    });
    expect(providerPlanPricing(start, change).introEndsAt!.toISOString()).toBe(
      "2026-04-30T12:45:00.000Z"
    );
  });
  it("preserves calendar anniversaries across leap years, short months and year boundaries", () => {
    expect(
      providerMonthAnniversary(
        new Date("2027-11-30T18:20:15.123Z"),
        3
      ).toISOString()
    ).toBe("2028-02-29T18:20:15.123Z");
    expect(
      providerMonthAnniversary(
        new Date("2026-11-30T18:20:15.123Z"),
        3
      ).toISOString()
    ).toBe("2027-02-28T18:20:15.123Z");
    expect(providerMonthAnniversary(start, 1).toISOString()).toBe(
      "2026-02-28T12:45:00.000Z"
    );
    expect(providerMonthAnniversary(start, 2).toISOString()).toBe(
      "2026-03-31T12:45:00.000Z"
    );
    expect(() => providerMonthAnniversary(new Date("invalid"), 3)).toThrow(
      RangeError
    );
  });
  it("rejects attempts to supply a discounted price or reset the introductory anchor", () => {
    const input = {
      providerId: 1,
      revision: 0,
      status: "active",
      startsAt: start,
      endsAt: providerMonthAnniversary(start, 1),
      note: "Recorded manual activation",
    };
    for (const extra of [
      { firstActivatedAt: start },
      { introEndsAt: start },
      { monthlyCents: 1900 },
      { currency: "EUR" },
      { pricing: {} },
    ])
      expect(subscriptionInput.safeParse({ ...input, ...extra }).success).toBe(
        false
      );
  });
});
