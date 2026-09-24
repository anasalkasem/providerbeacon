// @vitest-environment jsdom
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providers } from "./testFixtures";

const state = vi.hoisted(() => ({ locale: "en", providers: [] as any[] }));
vi.mock("../client/src/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("../client/src/contexts/MarketplaceDataContext", () => ({
  useMarketplaceData: () => ({ providers: state.providers, setFilters: () => {} }),
}));
vi.mock("../client/src/components/SiteChrome", () => ({
  PublicLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("../client/src/components/Marketplace", () => ({
  ProviderCard: ({ provider }: { provider: { name: string } }) => <article>{provider.name}</article>,
}));
vi.mock("../client/src/components/CataloguePagination", () => ({ CataloguePagination: () => null }));
import Providers from "../client/src/pages/Providers";

const summary = (amount: string, currency = "USD", unit = "per_1000") => ({
  ranges: [{ currency, unit, minimum: amount, maximum: amount, services: 12 }],
  additionalGroups: 0,
  unconfirmedServices: 0,
});

describe("provider directory price visibility", () => {
  beforeEach(() => {
    state.locale = "en";
    state.providers = [
      { ...providers[0], id: "provider-101", slug: "alpha", name: "Alpha", pricingSummary: summary("0.123456") },
      { ...providers[0], id: "provider-102", slug: "beta", name: "Beta", pricingSummary: summary("8.25", "EUR", "per_item") },
    ];
  });

  it("shows the independent published prices for each provider, not only a services button", () => {
    const html = renderToStaticMarkup(<Providers />);
    expect(html).toContain("USD 0.123456");
    expect(html).toContain("EUR 8.25");
    expect(html).not.toContain("per 1,000 units");
    expect(html).not.toContain("per item");
  });

  it("identifies unconfirmed pricing instead of inventing a zero or a USD basis", () => {
    state.providers = [{ ...state.providers[0], pricingSummary: { ranges: [], additionalGroups: 0, unconfirmedServices: 12 } }];
    const html = renderToStaticMarkup(<Providers />);
    expect(html).toContain("Currency not confirmed");
    expect(html).not.toContain("USD 0");
  });

  it("distinguishes a failed summary read from an empty published price list", () => {
    state.providers = [{ ...state.providers[0], pricingSummary: null }];
    expect(renderToStaticMarkup(<Providers />)).toContain("Prices temporarily unavailable");
    state.providers[0].pricingSummary = { ranges: [], additionalGroups: 0, unconfirmedServices: 0 };
    expect(renderToStaticMarkup(<Providers />)).toContain("No published prices");
  });

  it.each([
    ["ar", "أسعار الخدمات المنشورة"],
    ["es", "Precios de servicios publicados"],
    ["hi", "प्रकाशित सेवाओं की कीमतें"],
    ["zh", "已发布服务价格"],
  ])("localizes the summary in %s while preserving exact prices and provider-specific links", (locale, heading) => {
    state.locale = locale;
    const html = renderToStaticMarkup(<Providers />);
    const document = new DOMParser().parseFromString(html, "text/html");
    const alpha = document.querySelector(`section[aria-label="${heading}: Alpha"]`);
    const beta = document.querySelector(`section[aria-label="${heading}: Beta"]`);
    expect(alpha?.textContent).toContain("USD 0.123456");
    expect(alpha?.textContent).not.toContain("EUR 8.25");
    expect(beta?.textContent).toContain("EUR 8.25");
    expect(alpha?.querySelector("bdi")?.getAttribute("dir")).toBe("ltr");
    expect(alpha?.querySelector("a")?.getAttribute("href")).toBe("/providers/alpha#provider-services");
    expect(beta?.querySelector("a")?.getAttribute("href")).toBe("/providers/beta#provider-services");
  });
});
