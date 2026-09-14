import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { quoteTotal } from "../shared/quoteCalculator";
import {
  discoveryGuides,
  directoryProfiles,
} from "../client/src/data/discovery";
const state = vi.hoisted(() => ({ locale: "en", slug: "fiverr" }));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("@/contexts/MarketplaceDataContext", () => ({
  useMarketplaceData: () => ({
    services: [],
    providers: [],
    source: "database",
    isLoading: false,
  }),
}));
vi.mock("@/components/SiteChrome", () => ({
  PublicLayout: ({ children }: any) => children,
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) =>
    React.createElement("a", { href, ...props }, children),
  useLocation: () => ["/", () => {}],
  useRoute: () => [true, { slug: state.slug }],
}));
import Home from "../client/src/pages/Home";
import {
  DirectoryProfile,
  ServiceGuide,
} from "../client/src/pages/DiscoveryDetail";
const render = (C: React.ComponentType) =>
  renderToStaticMarkup(React.createElement(C));
describe("public release without approved prices", () => {
  it("keeps the full English and Arabic homepage available with zero published offers", () => {
    for (const locale of ["en", "ar"]) {
      state.locale = locale;
      const html = render(Home);
      expect(html).toContain("/services/instagram-content");
      expect(html).not.toContain("/directory/fiverr");
      expect(html).not.toContain("/directory/upwork");
      expect(html).toContain('id="methodology"');
      expect(html).not.toContain("No published services yet");
      expect(html).not.toContain("Ask Beacon AI");
    }
  });
  it("renders every linked service guide with a usable brief and every source profile with a first-party link", () => {
    for (const locale of ["en", "ar"]) {
      state.locale = locale;
      for (const guide of discoveryGuides) {
        state.slug = guide.slug;
        const html = render(ServiceGuide);
        expect(html).toContain(guide.title[locale as "en" | "ar"]);
        expect(html).toContain("/compare");
      }
      for (const profile of directoryProfiles) {
        state.slug = profile.slug;
        const html = render(DirectoryProfile);
        expect(html).toContain(profile.source);
        expect(html).toContain(profile.name);
        expect(html).toContain(
          locale === "ar"
            ? "درجة Beacon: غير متاحة"
            : "Beacon Score: not available"
        );
      }
    }
  });
});
describe("quote arithmetic", () => {
  it("calculates common units and one package without inventing missing amounts", () => {
    expect(quoteTotal("", 1000, "per_1000")).toBeNull();
    expect(quoteTotal("1.25", 10000, "per_1000")).toBe(12.5);
    expect(quoteTotal("2.5", 4, "per_item")).toBe(10);
    expect(quoteTotal("375", 999, "package")).toBe(375);
    expect(quoteTotal("0", 1, "per_item")).toBe(0);
  });
  it("rejects invalid input instead of displaying misleading totals", () => {
    for (const amount of ["-1", "NaN", "Infinity", "1000001", "1.00001"]) {
      expect(quoteTotal(amount, 1, "per_item")).toBeNull();
    }
    for (const quantity of [0, -1, 1.5, 1000001, NaN]) {
      expect(quoteTotal("1", quantity, "per_item")).toBeNull();
    }
    expect(quoteTotal("0.0001", 1, "per_1000")).toBe(0.0000001);
  });
});
