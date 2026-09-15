import { describe, expect, it } from "vitest";
import {
  planIsActive,
  planState,
  providerOwnedUrl,
  providerOwnershipProofUrl,
  subscriptionInput,
  validPromotionDates,
  BUSINESS_DAY_MS,
} from "../shared/providerBusiness";
import { hasPermission } from "./authorization";

describe("provider plan boundaries", () => {
  const now = Date.parse("2026-09-16T12:00:00Z");
  it("uses a half-open subscription window and requires activation", () => {
    const plan = {
      status: "active",
      startsAt: new Date(now),
      endsAt: new Date(now + 1000),
    };
    expect(planIsActive(plan, now - 1)).toBe(false);
    expect(planState(plan, now - 1)).toBe("scheduled");
    expect(planIsActive(plan, now)).toBe(true);
    expect(planIsActive(plan, now + 999)).toBe(true);
    expect(planIsActive(plan, now + 1000)).toBe(false);
    expect(planState(plan, now + 1000)).toBe("expired");
    expect(planIsActive({ ...plan, status: "suspended" }, now)).toBe(false);
    expect(planIsActive(null, now)).toBe(false);
  });
  it("restricts ownership proof and offer destinations to the exact provider domain", () => {
    expect(
      providerOwnershipProofUrl(
        "https://provider.example/",
        "https://provider.example/"
      )
    ).toBe("https://provider.example/");
    expect(
      providerOwnershipProofUrl(
        "https://provider.example/providerbeacon-verification.txt",
        "https://provider.example/"
      )
    ).toBeTruthy();
    expect(
      providerOwnershipProofUrl(
        "https://provider.example/comments/public-post",
        "https://provider.example/"
      )
    ).toBeNull();
    expect(
      providerOwnedUrl(
        "https://www.provider.example/proof",
        "https://provider.example/"
      )
    ).toBe("https://www.provider.example/proof");
    for (const value of [
      "https://provider.example.evil.com/proof",
      "https://evil.com/provider.example",
      "https://sub.provider.example/proof",
      "https://provider.example@evil.com/",
      "javascript:alert(1)",
      "http://provider.example/proof",
      "https://provider.example/?code=token",
      "https://provider.example/#token",
    ])
      expect(providerOwnedUrl(value, "https://provider.example/")).toBeNull();
  });
  it("rejects expired and excessively long offers and unbounded activation", () => {
    expect(
      validPromotionDates(new Date(now), new Date(now + BUSINESS_DAY_MS), now)
    ).toBe(true);
    expect(validPromotionDates(new Date(now), new Date(now), now)).toBe(false);
    expect(
      validPromotionDates(
        new Date(now),
        new Date(now + 91 * BUSINESS_DAY_MS),
        now
      )
    ).toBe(false);
    expect(
      validPromotionDates(new Date("invalid"), new Date(now + 1000), now)
    ).toBe(false);
    const plan = {
      providerId: 1,
      revision: 0,
      status: "active",
      startsAt: new Date(now),
      endsAt: new Date(now + 30 * BUSINESS_DAY_MS),
      note: "Manual payment reference",
    };
    expect(subscriptionInput.safeParse(plan).success).toBe(true);
    expect(subscriptionInput.safeParse({ ...plan, endsAt: null }).success).toBe(
      false
    );
    expect(
      subscriptionInput.safeParse({
        ...plan,
        endsAt: new Date(now + 800 * BUSINESS_DAY_MS),
      }).success
    ).toBe(false);
    expect(
      subscriptionInput.safeParse({ ...plan, ownerMemberId: 12 }).success
    ).toBe(false);
  });
  it("reserves subscription and ownership management for authorised administrators", () => {
    expect(hasPermission("owner", "business.manage")).toBe(true);
    expect(hasPermission("administrator", "business.manage")).toBe(true);
    for (const role of [
      null,
      "auditor",
      "operations_manager",
      "provider_reviewer",
      "catalogue_editor",
      "translation_manager",
    ] as const)
      expect(hasPermission(role, "business.manage")).toBe(false);
  });
});
