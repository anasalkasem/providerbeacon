import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogueIndex } from "../client/src/lib/catalogue";
import { providers, services } from "./testFixtures";

const state = vi.hoisted(() => ({ data: null as any, slug: "real-provider", search: "", quotes: undefined as any }));
vi.mock("@/lib/trpc", () => ({trpc:{assistant:{quotes:{useQuery:()=>({data:state.quotes})}}}}));
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
import Services from "../client/src/pages/Services";
import QuoteCost from "../client/src/components/QuoteCost";
import { CatalogueNotice } from "../client/src/components/CatalogueState";

beforeEach(() => {
  const provider = { ...providers[0]!, id: "provider-20", slug: "real-provider", name: "Independent provider", score: null, verified: false, rating: null, successRate: null, updatedMinutes: null };
  const service = { ...services[0]!, id: "service-40", providerId: provider.id, name: "Available real offer", featured: false, retention: null };
  state.data = { ...catalogueIndex([provider], [service]), source: "database", isLoading: false, retry: () => {} };
  state.slug = provider.slug;
  state.quotes = undefined;
  vi.stubGlobal("window", { location: { search: "" } });
});
afterEach(() => vi.unstubAllGlobals());
const render = (component: React.ComponentType<any>, props = {}) => renderToStaticMarkup(React.createElement(component, props));

describe("public catalogue rendering", () => {
  it("shows a visible quantity calculator and sale-unit filter in the explorer", () => {
    state.data = {...state.data, setFilters:()=>{}, pagination:{total:1,page:1,hasNext:false,next:()=>{},previous:()=>{}}};
    const html=render(Services);
    expect(html).toContain("Service cost calculator");
    expect(html).toContain("Required quantity");
    expect(html).toContain("Only show offers that accept this quantity");
    expect(html).toContain("Sale unit");
  });
  it("uses exact totals and only marks the truly cheapest comparable source rate", () => {
    const a = {...state.data.services[0], catalogueListing:"api_source", sourceRate:"1.000000000000000001", priceAmount:1,priceCurrency:"USD",priceUnit:"per_1000",countryCode:"US",refill:"No refill",min:1,max:10000};
    const b = {...a,id:"service-41",sourceRate:"1.000000000000000002"};
    state.data = {...state.data,...catalogueIndex(state.data.providers,[a,b])};
    vi.stubGlobal("window",{location:{search:"?services=service-40,service-41&quantity=5000"}});
    const html = render(Compare);
    expect(html).toContain("USD 5.000000000000000005");
    expect(html).toContain("USD 5.00000000000000001");
    expect(html.split(">Lowest price<").length - 1).toBe(1);
    expect(render(QuoteCost,{service:a,quantity:10001})).toContain("Above maximum: 10,000");
    expect(render(QuoteCost,{service:{...a,priceUnit:null},quantity:1000})).toContain("Awaiting confirmation of the sale unit");
  });
  it("renders connected API rates without rounding them into a currency or inventing a quantity total", () => {
    const provider = {...state.data.providers[0], apiConnected: true, activeServicesCount: 2};
    const a = {...state.data.services[0], catalogueListing: "api_source", sourceRate: "1.0123456", priceAmount: 1.0123456, priceCurrency: null, priceUnit: null, sourceUrl: "https://provider.example"};
    const b = {...a, id:"service-41", sourceRate:"0.12555", priceAmount:0.12555};
    state.data = {...state.data, ...catalogueIndex([provider], [a,b])};
    const home=render(Home);
    expect(home).toContain("1.0123456"); expect(home).toContain("API connected");
    expect(home).toContain("currency and unit awaiting confirmation"); expect(home).not.toContain("Outside order limits");
    expect(home).not.toContain("/directory/fiverr");
    vi.stubGlobal("window",{location:{search:"?services=service-40,service-41"}});
    const comparison=render(Compare);
    expect(comparison).toContain("Total requires confirmed currency and sale unit");
    expect(comparison).not.toContain(">Lowest price<");
  });
  it("shows dated converted totals and a server-confirmed lowest price across currencies", () => {
    const a={...state.data.services[0],priceCurrency:"USD",priceUnit:"per_1000",priceAmount:2};
    const b={...a,id:"service-41",priceCurrency:"PKR",priceAmount:280};
    state.data={...state.data,...catalogueIndex(state.data.providers,[a,b])};
    state.quotes={comparable:true,currency:"USD",offers:[{id:a.id,total:"2.00",convertedTotal:null,fxAsOf:null,lowest:false},{id:b.id,total:"280.00",convertedTotal:"1.00",fxAsOf:1789400000000,lowest:true}]};
    vi.stubGlobal("window",{location:{search:"?services=service-40,service-41&quantity=1000&currency=USD"}});
    const html=render(Compare);
    expect(html).toContain("Estimated converted total");
    expect(html).toContain("USD 1.00");
    expect(html).toContain("https://www.exchangerate-api.com");
    expect(html.split(">Lowest price<").length-1).toBe(1);
    expect(html).not.toContain("No lowest-price ranking");
    expect(render(QuoteCost,{service:{...a,priceType:"from"},quantity:1000})).toContain("Starting price; a final quote is needed");
  });
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
  it("shows the actual price unit and suppresses a cheapest badge for mixed currencies", () => {
    const provider = state.data.providers[0];
    const a = {...state.data.services[0], priceCurrency: "INR", priceUnit: "per_item", priceAmount: 0.0001};
    const b = {...a, id: "service-41", priceCurrency: "USD"};
    state.data = {...state.data, ...catalogueIndex([provider], [a,b])};
    vi.stubGlobal("window", {location: {search: "?services=service-40,service-41"}});
    const html = render(Compare);
    expect(html).toContain("INR 0.0001"); expect(html).toContain("per item");
    expect(html).toContain("No lowest-price ranking"); expect(html).not.toContain(">Lowest price<");
    expect(render(ServiceRow, {service: a, selected: false, onToggle: () => {}})).toContain("per item");
  });
  it("compares sourced monthly packages with scope, terms and source links", () => {
    const provider = state.data.providers[0];
    const a = {...state.data.services[0], priceCurrency: "USD", priceUnit: "package", billingCycle: "monthly", packageDescription: "10 posts per month", terms: "One channel. Extra channels cost USD 10.", sourceUrl: "https://example.com/pricing", checkedAt: new Date().toISOString()};
    const b = {...a, id: "service-41", priceAmount: 3000, priceType: "from"};
    state.data = {...state.data, ...catalogueIndex([provider], [a,b])};
    vi.stubGlobal("window", {location: {search: "?services=service-40,service-41"}});
    const html = render(Compare);
    expect(html).toContain("From USD 3,000.00"); expect(html).toContain("per month");
    expect(html).toContain("https://example.com/pricing"); expect(html).toContain("One channel. Extra channels cost USD 10.");
    expect(html).not.toContain(">Lowest price<");
  });
  it("marks absent scores as insufficient evidence without a positive grade", () => {
    const html = render(ScoreRing, { score: null, showLabel: true });
    expect(html).toContain("Insufficient evidence"); expect(html).not.toContain("Good"); expect(html).not.toContain("/100");
  });
  it("treats retired demo responses as unavailable and offers a retry on database failure", () => {
    state.data.source = "seed"; expect(render(CatalogueNotice)).toContain("temporarily unavailable");
    state.data.source = "unavailable"; expect(render(CatalogueNotice)).toContain("temporarily unavailable");
  });
});
