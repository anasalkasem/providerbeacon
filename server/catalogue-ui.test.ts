import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogueIndex } from "../client/src/lib/catalogue";
import { providers, services } from "../client/src/data/marketplace";

const state = vi.hoisted(() => ({ data: null as any, slug: "real-provider", search: "" }));
vi.mock("@/contexts/MarketplaceDataContext", () => ({ useMarketplaceData: () => state.data }));
vi.mock("@/contexts/LocaleContext", async importOriginal => ({ ...await importOriginal<any>(), useLocale: () => ({ locale: "en", setLocale: () => {} }) }));
vi.mock("@/components/SiteChrome", () => ({ PublicLayout: ({ children }: any) => children }));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) => React.createElement("a", { ...props, href }, children),
  useRoute: () => [true, { slug: state.slug }], useLocation: () => ["/", () => {}],
}));
import { ScoreRing, ServiceRow } from "../client/src/components/Marketplace";
import Home from "../client/src/pages/Home";
import Provider from "../client/src/pages/Provider";
import Compare from "../client/src/pages/Compare";
import { CatalogueNotice } from "../client/src/components/CatalogueState";

beforeEach(() => {
  const provider = { ...providers[0]!, id: "provider-20", slug: "real-provider", name: "Independent provider", score: null, verified: false, rating: null, successRate: null, updatedMinutes: null };
  const service = { ...services[0]!, id: "service-40", providerId: provider.id, name: "Available real offer", featured: false, retention: null };
  state.data = { ...catalogueIndex([provider], [service]), source: "database", isLoading: false, retry: () => {} };
  state.slug = provider.slug;
  vi.stubGlobal("window", { location: { search: "" } });
});
afterEach(() => vi.unstubAllGlobals());
const render = (component: React.ComponentType<any>, props = {}) => renderToStaticMarkup(React.createElement(component, props));

describe("public catalogue rendering", () => {
  it("uses the live provider in the actual service table row", () => {
    const html = render(ServiceRow, { service: state.data.services[0], selected: false, onToggle: () => {} });
    expect(html).toContain("Independent provider"); expect(html).not.toContain("Northstar");
  });
  it("shows an available unfeatured service on the homepage without a verification badge", () => {
    const html = render(Home);
    expect(html).toContain("Independent provider"); expect(html).not.toContain("No published services yet");
    expect(html).not.toContain("Tier 1 Direct Source</span>");
  });
  it("does not show identity verification claims for an unverified provider", () => {
    const html = render(Provider);
    expect(html).toContain("Identity not verified"); expect(html).not.toContain("Business contact confirmed");
  });
  it("renders an unavailable provider instead of falling back to a demo profile", () => {
    state.slug = "missing-provider";
    const html = render(Provider); expect(html).toContain("This provider is not available."); expect(html).not.toContain("Northstar");
  });
  it("does not silently replace missing comparison selections", () => {
    vi.stubGlobal("window", { location: { search: "?services=service-40,missing" } });
    expect(render(Compare)).toContain("Some selected services are no longer available");
  });
  it("marks absent scores as insufficient evidence without a positive grade", () => {
    const html = render(ScoreRing, { score: null, showLabel: true });
    expect(html).toContain("Insufficient evidence"); expect(html).not.toContain("Good"); expect(html).not.toContain("/100");
  });
  it("clearly discloses demonstration data and unavailable catalogue responses", () => {
    state.data.source = "seed"; expect(render(CatalogueNotice)).toContain("fictional providers");
    state.data.source = "unavailable"; expect(render(CatalogueNotice)).toContain("temporarily unavailable");
  });
});
