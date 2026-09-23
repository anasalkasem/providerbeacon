import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogueIndex } from "../client/src/lib/catalogue";
import { providers, services } from "./testFixtures";

const state = vi.hoisted(() => ({ data: null as any, slug: "real-provider", search: "", quotes: undefined as any,
}));
vi.mock("@/lib/trpc", () => ({trpc:{marketplace:{snapshot:{useQuery:()=>({data:state.data})}},assistant:{quotes:{useQuery:()=>({data:state.quotes})}},
    ratings: { summary: { useQuery: () => ({ data: { rating: null, reviews: 0 } }) } },
    member: { me: { useQuery: () => ({ data: { member: null } }) } },
    business: {
      promotions: { list: { useQuery: () => ({ data: { items: [] } }) } },
      vip: { list: { useQuery: () => ({ data: { items: [], total: 0, page: 1, pages: 1, rotation: 0 } }) } },
    },
    workspace: {
      ids: { useQuery: () => ({ data: [] }) },
      watch: { useMutation: () => ({}) },
      saveComparison: { useMutation: () => ({}) },
    },
    useUtils: () => ({ workspace: { invalidate: async () => {} } }),
  },
}));
vi.mock("@/contexts/MarketplaceDataContext", () => ({ useMarketplaceData: () => state.data,
}));
vi.mock("@/contexts/LocaleContext", async importOriginal => ({ ...(await importOriginal<any>()), useLocale: () => ({ locale: "en", setLocale: () => {} }),
}));
vi.mock("@/components/SiteChrome", () => ({ PublicLayout: ({ children }: any) => children,
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) => React.createElement("a", { ...props, href }, children),
  useRoute: () => [true, { slug: state.slug }], useLocation: () => ["/", () => {}],
  useSearch: () => window.location.search,
}));
import { ProviderCard, ScoreRing, ServiceRow } from "../client/src/components/Marketplace";
import Home from "../client/src/pages/Home";
import Provider from "../client/src/pages/Provider";
import Compare from "../client/src/pages/Compare";
import Services from "../client/src/pages/Services";
import QuoteCost from "../client/src/components/QuoteCost";
import OfferPrice from "../client/src/components/OfferPrice";
import SmmOfferTable from "../client/src/components/SmmOfferTable";
import { DecisionOffer } from "../client/src/components/DecisionOffer";
import { FollowPrice, SaveComparison } from "../client/src/components/WorkspaceActions";
import { CatalogueNotice } from "../client/src/components/CatalogueState";

beforeEach(() => {
  const provider = { ...providers[0]!, id: "provider-20", slug: "real-provider", name: "Independent provider", score: null, verified: false, rating: null, successRate: null, updatedMinutes: null,
  };
  const service = { ...services[0]!, id: "service-40", providerId: provider.id, name: "Available real offer", featured: false, retention: null,
  };
  state.data = { ...catalogueIndex([provider], [service]), source: "database", isLoading: false, retry: () => {},
  };
  state.slug = provider.slug;
  state.quotes = undefined;
  vi.stubGlobal("window", { location: { search: "" } });
});
afterEach(() => vi.unstubAllGlobals());
const render = (component: React.ComponentType<any>, props = {}) => renderToStaticMarkup(React.createElement(component, props));

describe("public catalogue rendering", () => {
  it.each([true, false])("makes ratings discoverable on provider cards (API connected: %s)", apiConnected => {
    const provider = { ...state.data.providers[0], apiConnected, rating: null, reviews: 0 };
    const empty = render(ProviderCard, { provider });
    expect(empty).toContain('href="/providers/real-provider#visitor-ratings"');
    expect(empty).toContain("Rate provider");
    expect(empty).toContain("No ratings yet");
    expect(empty).not.toContain("0 / 5");
    const rated = render(ProviderCard, { provider: { ...provider, rating: 4.5, reviews: 12 } });
    expect(rated).toContain("4.5 / 5");
    expect(rated).toContain("12 ratings");
  });
  it("shows supplied provider images and contact links without inventing verification", () => {
    const provider = state.data.providers[0];
    Object.assign(provider, { websiteUrl: "https://provider.example/", logoUrl: "https://cdn.example.com/logo.png", websitePreviewUrl: "https://cdn.example.com/website.png", telegramUrl: "https://t.me/providersupport" });
    const html = render(Provider);
    expect(html).toContain('href="https://provider.example/"');
    expect(html).toContain('href="https://t.me/providersupport"');
    expect(html).toContain('src="https://cdn.example.com/logo.png"');
    expect(html).toContain('src="https://cdn.example.com/website.png"');
    expect(html).toContain("Identity not verified");
    expect(html).toContain('href="#provider-services"');
    expect(html).toContain('href="#visitor-ratings"');
    expect(html).toContain("Rate provider");
    expect(html).toContain('id="visitor-ratings"');
    expect(html.indexOf('id="visitor-ratings"')).toBeLessThan(html.indexOf('id="provider-services"'));
    expect(html).toContain('id="provider-services"');
    Object.assign(provider, { websiteUrl: null, logoUrl: null, websitePreviewUrl: null, telegramUrl: null });
    const empty = render(Provider);
    expect(empty).not.toContain('href="https://t.me/');
    expect(empty).not.toContain('src="https://cdn.example.com/');
    expect(empty).not.toContain("Visit website");
  });
  it("shows known currency once with neutral pricing details instead of repeated warning panels", () => {
    const service = { ...state.data.services[0], catalogueListing: "api_source", sourceRate: "3000.00", priceCurrency: "EGP", priceUnit: null, sourceUrl: "https://foollo.com", min: 1, max: 1 };
    const html = render(OfferPrice, { service, lowest: true });
    expect(html).toContain("EGP 3000.00");
    expect(html).toContain("sale unit unspecified");
    expect(html).toContain("<details");
    expect(html).toContain("Pricing details");
    expect(html).toContain("https://foollo.com");
    expect(html).not.toContain("bg-amber");
    expect(html).not.toContain(">Lowest price<");
    expect(html).not.toContain("currency unspecified");
    expect(render(QuoteCost, { service, quantity: 1, hideMissingBasis: true })).toBe("");
    const table = render(SmmOfferTable, { services: [service], selected: [], toggle: () => {}, quantity: 1 });
    expect(table).not.toContain("Cost for selected quantity");
    expect(table).not.toContain("bg-amber");
    expect(table).not.toContain("Awaiting confirmation");
  });
  it("does not mistake missing units for a failed currency conversion or hide valid quantity totals", () => {
    const service = { ...state.data.services[0], catalogueListing: "api_source", sourceRate: "32.0562", priceCurrency: "EGP", priceUnit: "per_1000", min: 10, max: 10000 };
    expect(render(QuoteCost, { service, quantity: 500, hideMissingBasis: true })).toContain("EGP 16.0281");
    const card = render(DecisionOffer, { service: { ...service, priceUnit: null }, provider: state.data.providers[0], quantity: 500, currency: "USD" });
    expect(card).not.toContain("Cost for selected quantity");
    expect(card).not.toContain("text-amber-800");
    expect(card).toContain("sale unit unspecified");
  });
  it("preserves edited quantities and comparison currency when signing in to save", () => {
    vi.stubGlobal("window", { location: { pathname: "/compare", search: "?services=service-40,service-41&quantity=1000&currency=USD" } });
    const destination = (html: string) => {
      const href = html.match(/href="([^"]+)"/)![1]!;
      return new URL(new URL(href, "https://providerbeacon.com").searchParams.get("next")!, "https://providerbeacon.com");
    };
    expect(destination(render(FollowPrice, { serviceId: "service-40", quantity: 5000 })).searchParams.get("quantity")).toBe("5000");
    const next = destination(render(SaveComparison, { serviceIds: ["service-40", "service-41"], quantity: 5000, currency: "EUR", name: "My comparison" }));
    expect(next.pathname).toBe("/compare");
    expect(next.searchParams.get("quantity")).toBe("5000");
    expect(next.searchParams.get("currency")).toBe("EUR");
    expect(next.searchParams.get("services")).toBe("service-40,service-41");
  });
  it("shows compact quantity controls, integrated comparison and default price filters", () => {
    state.data = {...state.data, setFilters:()=>{}, pagination:{total:1,page:1,hasNext:false,next:()=>{},previous:()=>{},
      },
    };
    const html=render(Services);
    expect(html).not.toContain("Service cost calculator");
    expect(html).toContain('id="service-comparison"');
    expect(html).toContain("USD · per 1,000 · low to high");
    expect(html).toContain("Comparison quantity");
    expect(html).toContain("Accepts comparison quantity only");
    expect(html).toContain("Sale unit");
  });
  it("uses exact totals and only marks the truly cheapest comparable source rate", () => {
    const a = {...state.data.services[0], catalogueListing:"api_source", sourceRate:"1.000000000000000001", priceAmount:1,priceCurrency:"USD",priceUnit:"per_1000",countryCode:"US",refill:"No refill",min:1,max:10000,
    };
    const b = {...a,id:"service-41",sourceRate:"1.000000000000000002"};
    state.data = {...state.data,...catalogueIndex(state.data.providers,[a,b]),
    };
    vi.stubGlobal("window",{location:{search:"?services=service-40,service-41&quantity=5000"},
    });
    const html = render(Compare);
    expect(html).toContain("USD 5.000000000000000005");
    expect(html).toContain("USD 5.00000000000000001");
    expect(html.split(">Lowest price<").length - 1).toBe(1);
    expect(render(QuoteCost,{service:a,quantity:10001})).toContain("Above maximum: 10,000");
    expect(render(QuoteCost,{service:{...a,priceUnit:null},quantity:1000})).toContain("Total unavailable: sale unit unspecified");
  });
  it("renders connected API rates without rounding them into a currency or inventing a quantity total", () => {
    const provider = {...state.data.providers[0], apiConnected: true, activeServicesCount: 2,
    };
    const a = {...state.data.services[0], catalogueListing: "api_source", sourceRate: "1.0123456", priceAmount: 1.0123456, priceCurrency: null, priceUnit: null, sourceUrl: "https://provider.example",
    };
    const b = {...a, id:"service-41", sourceRate:"0.12555", priceAmount:0.12555,
    };
    state.data = {...state.data, ...catalogueIndex([provider], [a,b])};
    const offer=render(DecisionOffer, { service: a, provider, quantity: 1000 });
    expect(offer).toContain("1.0123456"); expect(offer).toContain("API connected");
    expect(offer).toContain("currency unspecified"); expect(offer).not.toContain("Outside order limits");
    vi.stubGlobal("window",{location:{search:"?services=service-40,service-41"},
    });
    const comparison=render(Compare);
    expect(comparison).toContain("Total unavailable: currency unspecified");
    expect(comparison).not.toContain(">Lowest price<");
  });
  it("shows dated converted totals and a server-confirmed lowest price across currencies", () => {
    const a={...state.data.services[0],priceCurrency:"USD",priceUnit:"per_1000",priceAmount:2,
    };
    const b={...a,id:"service-41",priceCurrency:"PKR",priceAmount:280,
    };
    state.data={...state.data,...catalogueIndex(state.data.providers,[a,b]),
    };
    state.quotes={comparable:true,currency:"USD",offers:[{id:a.id,total:"2.00",convertedTotal:null,fxAsOf:null,lowest:false,
        },{id:b.id,total:"280.00",convertedTotal:"1.00",fxAsOf:1789400000000,lowest:true,
        },
      ],
    };
    vi.stubGlobal("window",{location:{search:"?services=service-40,service-41&quantity=1000&currency=USD",
      },
    });
    const html=render(Compare);
    expect(html).toContain("Estimated converted total");
    expect(html).toContain("USD 1.00");
    expect(html).toContain("https://www.exchangerate-api.com");
    expect(html.split(">Lowest price<").length-1).toBe(1);
    expect(html).not.toContain("No lowest-price ranking");
    expect(render(QuoteCost,{service:{...a,priceType:"from"},quantity:1000,
      })).toContain("Starting price; a final quote is needed");
  });
  it("uses the live provider in the actual service table row", () => {
    const html = render(ServiceRow, { service: state.data.services[0], selected: false, onToggle: () => {},
    });
    expect(html).toContain("Independent provider"); expect(html).not.toContain("Northstar");
  });
  it("makes home a real-provider directory with service comparison and detailed request search", () => {
    const html = render(Home);
    expect(html).toContain("Independent provider");
    expect(html).toContain('href="/providers/real-provider"');
    expect(html).toContain("Compare services");
    expect(html).not.toContain("Available real offer");
    expect(html).not.toContain("USD 1.00");
    expect(html).not.toContain(">Lowest price<");
    expect(html).not.toContain("Northstar");
    expect(html).toContain('href="/find"');
    state.data.source = "unavailable";
    const unavailable = render(Home);
    expect(unavailable).not.toContain("Independent provider");
    expect(unavailable).not.toContain("USD 1.00");
    expect(unavailable).toContain("Providers could not be loaded.");
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
    vi.stubGlobal("window", { location: { search: "?services=service-40,missing" },
    });
    expect(render(Compare)).toContain("Some selected services are no longer available");
  });
  it("shows the actual price unit and suppresses a cheapest badge for mixed currencies", () => {
    const provider = state.data.providers[0];
    const a = {...state.data.services[0], priceCurrency: "INR", priceUnit: "per_item", priceAmount: 0.0001,
    };
    const b = {...a, id: "service-41", priceCurrency: "USD"};
    state.data = {...state.data, ...catalogueIndex([provider], [a,b])};
    vi.stubGlobal("window", {location: {search: "?services=service-40,service-41"},
    });
    const html = render(Compare);
    expect(html).toContain("INR 0.0001"); expect(html).toContain("per item");
    expect(html).toContain("No lowest-price ranking"); expect(html).not.toContain(">Lowest price<");
    expect(render(ServiceRow, {service: a, selected: false, onToggle: () => {}})).toContain("per item");
  });
  it("compares sourced monthly packages with scope, terms and source links", () => {
    const provider = state.data.providers[0];
    const a = {...state.data.services[0], priceCurrency: "USD", priceUnit: "package", billingCycle: "monthly", packageDescription: "10 posts per month", terms: "One channel. Extra channels cost USD 10.", sourceUrl: "https://example.com/pricing", checkedAt: new Date().toISOString(),
    };
    const b = {...a, id: "service-41", priceAmount: 3000, priceType: "from"};
    state.data = {...state.data, ...catalogueIndex([provider], [a,b])};
    vi.stubGlobal("window", {location: {search: "?services=service-40,service-41"},
    });
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
