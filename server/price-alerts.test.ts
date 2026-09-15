import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "./testFixtures";
import { savedPrice } from "../shared/buyerWorkspace";
import { priceAlertQuote, PRICE_ALERT_MAX_AGE_MS } from "../shared/priceAlerts";
import { renderEmail } from "./emailTemplates";
import { previewPriceTarget } from "./priceAlertEmail";
import {
  priceUnsubscribeToken,
  unsubscribeToken,
  validEmailSignature,
} from "./emailDb";

describe("price alert evidence and messages", () => {
  const now = Date.parse("2026-09-15T05:00:00Z");
  const original = {
    ...services[0]!,
    catalogueListing: "api_source" as const,
    sourceRate: "2.60",
    priceAmount: 2.6,
    historyKey: "basis",
    priceCurrency: "USD",
    priceUnit: "per_1000" as const,
    checkedAt: new Date(now).toISOString(),
  };
  beforeEach(() => {
    vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
    vi.stubEnv("AUTH_PEPPER", "local-price-unit-tests");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("compares exact quantity totals and does not trigger for an amount just above the target", () => {
    const current = { ...original, sourceRate: "2.400000000000000000001" };
    expect(
      priceAlertQuote(savedPrice(original), current, 5000, "12", now)
    ).toMatchObject({ ready: true, reached: false });
    expect(
      priceAlertQuote(
        savedPrice(original),
        { ...current, sourceRate: "2.40" },
        5000,
        "12",
        now
      )
    ).toMatchObject({ reached: true, original: "13.00", now: "12.00" });
  });
  it("pauses missing, stale, future, changed-unit, unknown and incompatible offers", () => {
    for (const patch of [
      { checkedAt: null },
      { checkedAt: new Date(now - PRICE_ALERT_MAX_AGE_MS - 1).toISOString() },
      { checkedAt: new Date(now + 120000).toISOString() },
      { historyKey: "changed" },
      { priceCurrency: "INR" },
      { priceUnit: "per_item" as const },
      { priceUnit: null },
      { priceType: "from" as const },
      { max: 100 },
    ])
      expect(
        priceAlertQuote(
          savedPrice(original),
          { ...original, ...patch },
          1000,
          "100",
          now
        ).reached
      ).toBe(false);
    expect(
      priceAlertQuote(savedPrice(original), null, 1000, "100", now).reached
    ).toBe(false);
  });
  it.each(["ar", "en", "es", "hi", "zh"])(
    "renders the complete %s price email with safe dated totals and an independent unsubscribe",
    locale => {
      const mail = renderEmail({
        kind: "price_target",
        locale,
        name: "Member",
        url: "https://providerbeacon.com/compare?services=service-42&quantity=5000&currency=USD",
        unsubscribeUrl:
          "https://providerbeacon.com/unsubscribe?scope=prices#token=preview",
        priceTarget: {
          ...previewPriceTarget,
          service: '<img src=x onerror="alert(1)">',
        },
      });
      expect(mail.html).toContain(`dir="${locale === "ar" ? "rtl" : "ltr"}"`);
      expect(mail.html).toContain("&lt;img");
      expect(mail.html).not.toMatch(/<script|<img[^>]*onerror=/);
      for (const amount of ["USD 13.00", "USD 12.00", "UTC"])
        expect(mail.text).toContain(amount);
      expect(mail.text).toContain("scope=prices");
      expect(mail.html).toContain("background:#e7f7f0");
    }
  );
  it("separates the price-alert unsubscribe signature from marketing consent", () => {
    const member = { id: 12, email: "qa@example.com" };
    const token = priceUnsubscribeToken(member),
      parts = token.split(".");
    expect(token).not.toBe(unsubscribeToken(member));
    expect(token.length).toBeLessThan(160);
    expect(
      validEmailSignature(
        parts.slice(0, -1).join("."),
        "price-unsubscribe",
        parts.at(-1)!
      )
    ).toBe(true);
    expect(
      validEmailSignature(
        parts.slice(1, -1).join("."),
        "unsubscribe",
        parts.at(-1)!
      )
    ).toBe(false);
  });
});
