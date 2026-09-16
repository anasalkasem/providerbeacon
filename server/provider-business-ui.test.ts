// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "ar",
  member: null as any,
  workspace: null as any,
  workspaceError: false,
  overview: undefined as any,
  overviewError: false,
  analytics: undefined as any,
  analyticsError: false,
  offers: [] as any[],
  permissions: [] as string[],
  analyticsCalls: vi.fn(),
  accountCalls: vi.fn(),
  paymentCalls: vi.fn(),
}));
vi.mock("@/contexts/LocaleContext", async original => ({
  ...(await original<any>()),
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("@/hooks/useMember", () => ({
  useMember: () => ({ data: { member: state.member } }),
}));
vi.mock("@/components/SiteChrome", () => ({
  Brand: () => React.createElement("a", { href: "/" }, "ProviderBeacon"),
  PublicLayout: ({ children }: any) =>
    React.createElement("main", null, children),
}));
vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: any) => children,
}));
vi.mock("recharts", () => ({
  CartesianGrid: () => null,
  Legend: () => null,
  Line: () => null,
  LineChart: () => null,
  ResponsiveContainer: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
vi.mock("@/lib/trpc", () => {
  const mutation = {
    useMutation: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false }),
  };
  return {
    trpc: {
      useUtils: () => ({}),
      community: { providers: { useQuery: () => ({ data: [] }) } },
      business: {
        mine: {
          useQuery: () => ({
            data: state.workspace,
            isError: state.workspaceError,
            error: { message: "business_owner_required" },
          }),
        },
        overview: {
          useQuery: () => ({
            data: state.overview,
            isError: state.overviewError,
            error: { message: "business_owner_required" },
          }),
        },
        payments: {
          methods: {
            useQuery: () => ({
              data: [
                { gateway: "paypal", available: false },
                { gateway: "nowpayments", available: false },
              ],
            }),
          },
          list: {
            useQuery: () => {
              state.paymentCalls();
              return {};
            },
          },
          status: { useQuery: () => ({}) },
          checkout: mutation,
          check: mutation,
          cancel: mutation,
        },
        prepareClaim: mutation,
        submitProof: mutation,
        analytics: {
          useQuery: (input: any) => {
            state.analyticsCalls(input);
            return {
              data: state.analytics,
              isError: state.analyticsError,
              error: state.analyticsError
                ? { message: "business_subscription_required" }
                : undefined,
            };
          },
        },
        groups: {
          mine: { useQuery: () => ({ data: [] }) },
          submit: mutation,
          edit: mutation,
          withdraw: mutation,
        },
        promotions: {
          list: { useQuery: () => ({ data: { items: state.offers } }) },
          mine: {
            useQuery: () => ({
              data: { items: [], usage: { used: 0, limit: 5 } },
            }),
          },
          submit: mutation,
          edit: mutation,
          withdraw: mutation,
        },
      },
      admin: {
        access: {
          useQuery: () => ({ data: { permissions: state.permissions } }),
        },
        business: {
          setSubscription: mutation,
          revokeOwner: mutation,
          account: {
            useQuery: () => {
              state.accountCalls();
              return {};
            },
          },
        },
      },
    },
  };
});
import ProviderBusiness from "../client/src/pages/ProviderBusiness";
import {
  AdminBusinessPanel,
  SubscriptionForm,
} from "../client/src/pages/AdminProviderBusiness";
import { BusinessPricing } from "../client/src/components/BusinessPricing";
import { PublicPromotions } from "../client/src/components/BusinessUi";
import { BusinessAnalytics } from "../client/src/components/BusinessAnalytics";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.locale = "ar";
  state.member = null;
  state.workspace = null;
  state.workspaceError = false;
  state.overviewError = false;
  state.overview = {
    groups: { total: 0, live: 0, pending: 0, rejected: 0 },
    offers: {
      total: 0,
      live: 0,
      pending: 0,
      rejected: 0,
      expiring: 0,
      nextExpiry: null,
    },
    usage: { used: 0, limit: 5, resetsAt: new Date("2026-10-01") },
  };
  window.history.replaceState({}, "", "/account/provider");
  state.analytics = undefined;
  state.analyticsError = false;
  state.offers = [];
  state.permissions = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const render = (element: React.ReactNode) => act(() => root.render(element));

function paidWorkspace() {
  const now = Date.now();
  state.member = { id: 7, emailVerified: true };
  state.workspace = {
    providers: [
      {
        provider: {
          id: 4,
          name: "Provider Alpha",
          slug: "alpha",
          websiteUrl: "https://alpha.example/",
          status: "active",
        },
        ownershipValid: true,
        subscription: {
          status: "active",
          startsAt: new Date(now - 86400000),
          endsAt: new Date(now + 20 * 86400000),
          firstActivatedAt: new Date(now - 86400000),
        },
      },
    ],
    claims: [],
  };
  state.analytics = {
    collectionEnabled: true,
    from: "2026-08-18",
    to: "2026-09-16",
    totals: { views: 27, website: 9, telegram: 4 },
    daily: [
      { day: "2026-09-16", measured: true, views: 27, website: 9, telegram: 4 },
    ],
    previous: {
      from: "2026-07-19",
      to: "2026-08-17",
      fullyMeasured: false,
      totals: { views: 0, website: 0, telegram: 0 },
    },
  };
}
const button = (text: string) =>
  [...container.querySelectorAll("button")].find(b => b.textContent === text)!;

describe("provider dashboard navigation and entitlements", () => {
  it("opens the offer form from a quick action while keeping creation unavailable without a plan", async () => {
    state.locale = "en";
    paidWorkspace();
    await render(React.createElement(ProviderBusiness));
    await act(() => button("New offer").click());
    expect(window.location.search).toContain("action=create");
    expect(container.querySelector('input[maxlength="120"]')).not.toBeNull();
    state.workspace.providers[0].subscription.status = "inactive";
    await render(React.createElement(ProviderBusiness));
    expect(container.querySelector('input[maxlength="120"]')).toBeNull();
    expect(button("New offer").disabled).toBe(true);
  });
  it("opens with performance and operational tools, keeps billing separate, and restores linked sections", async () => {
    state.locale = "en";
    paidWorkspace();
    await render(React.createElement(ProviderBusiness));
    expect(container.querySelector("h1")?.textContent).toBe("Overview");
    expect(container.textContent).toContain("27");
    expect(container.textContent).toContain("Your monthly offers");
    expect(container.textContent).not.toContain("$19");
    expect(state.paymentCalls).not.toHaveBeenCalled();
    await act(() => button("Plan & payments").click());
    expect(window.location.search).toContain("tab=billing");
    expect(container.textContent).toContain("$19");
    expect(state.paymentCalls).toHaveBeenCalled();
    await act(() => {
      window.history.replaceState(
        {},
        "",
        "/account/provider?provider=4&tab=groups"
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(
      container.querySelector('nav button[aria-current="page"]')?.textContent
    ).toBe("Your provider groups");
    expect(container.querySelector("h1")?.textContent).toBe(
      "Your provider groups"
    );
  });
  it("switches the provider partition, preserves the section and removes cached tools on an ownership error", async () => {
    state.locale = "en";
    paidWorkspace();
    state.workspace.providers.push({
      ...state.workspace.providers[0],
      provider: {
        ...state.workspace.providers[0].provider,
        id: 5,
        name: "Provider Beta",
        slug: "beta",
      },
    });
    await render(React.createElement(ProviderBusiness));
    const select = container.querySelector(
      'select[aria-label="Provider"]'
    ) as HTMLSelectElement;
    await act(() => {
      select.value = "5";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(state.analyticsCalls).toHaveBeenLastCalledWith({
      accountId: 7,
      providerId: 5,
      days: 30,
    });
    expect(container.querySelector('a[href="/providers/beta"]')).not.toBeNull();
    state.workspaceError = true;
    await render(React.createElement(ProviderBusiness));
    expect(container.textContent).not.toContain("27");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
  it("removes paid analytics and disables quick actions when a plan expires while the page stays open", async () => {
    state.locale = "en";
    vi.useFakeTimers();
    paidWorkspace();
    state.workspace.providers[0].subscription.endsAt = new Date(
      Date.now() + 2000
    );
    await render(React.createElement(ProviderBusiness));
    expect(container.textContent).toContain("Your performance");
    await act(() => vi.advanceTimersByTime(5000));
    expect(container.textContent).not.toContain("Your performance");
    expect(container.textContent).toContain("Activate your provider tools");
    expect(button("New offer").disabled).toBe(true);
    expect(button("Add a group").disabled).toBe(true);
  });
  it("supports Arabic mobile navigation and focuses the selected section", async () => {
    paidWorkspace();
    await render(React.createElement(ProviderBusiness));
    expect(
      container.querySelector(".provider-dashboard")?.getAttribute("dir")
    ).toBe("rtl");
    const menu = container.querySelector(
      'button[aria-controls="provider-navigation"]'
    ) as HTMLButtonElement;
    await act(() => menu.click());
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    await act(() => button("عروضك وكوبوناتك").click());
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(container.querySelector("h1"));
  });
  it("shows real operational alerts and hides old summary values when access fails", async () => {
    state.locale = "en";
    paidWorkspace();
    state.overview.groups.pending = 3;
    state.overview.offers.rejected = 1;
    await render(React.createElement(ProviderBusiness));
    expect(container.textContent).toContain(
      "Your submissions are being reviewed"
    );
    expect(container.textContent).toContain("Review notes need a response");
    state.overviewError = true;
    await render(React.createElement(ProviderBusiness));
    expect(container.textContent).not.toContain(
      "Your submissions are being reviewed"
    );
    expect(container.textContent).not.toContain("You're up to date");
  });
});

describe("provider package interfaces", () => {
  it("discloses both approved USD monthly prices before sign-in without inventing checkout", async () => {
    await render(React.createElement(ProviderBusiness));
    expect(container.textContent).toContain("لوحة المزود");
    expect(
      container.querySelector('a[href="/sign-in?next=/account/provider"]')
    ).not.toBeNull();
    expect(container.textContent).toContain("$19");
    expect(container.textContent).toContain("$29");
    expect(container.textContent).toContain("لكل شهر من أول 3 أشهر");
    expect(container.textContent).toContain("ابتداءً من الشهر 4");
    expect(container.textContent).toContain("الخصم التلقائي غير مفعّل");
    expect(container.textContent).not.toMatch(/Stripe|checkout/i);
    expect(state.analyticsCalls).not.toHaveBeenCalled();
  });
  it("updates the displayed monthly rate at the recorded introductory expiry", async () => {
    state.locale = "en";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T12:44:59Z"));
    await render(
      React.createElement(BusinessPricing, {
        firstActivatedAt: new Date("2026-01-31T12:45:00Z"),
      })
    );
    expect(container.querySelector(".text-4xl")?.textContent).toBe("$19");
    expect(container.textContent).toContain("Apr 30, 2026");
    await act(() => vi.advanceTimersByTime(5_000));
    expect(container.querySelector(".text-4xl")?.textContent).toBe("$29");
    expect(container.textContent).toContain("Automatic billing is not enabled");
  });
  it("previews the price change before a first activation and defaults to a calendar month", async () => {
    state.locale = "en";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-31T12:45:00Z"));
    await render(
      React.createElement(SubscriptionForm, {
        data: {
          provider: { id: 1, name: "Provider" },
          owner: null,
          subscription: {
            status: "inactive",
            startsAt: null,
            endsAt: null,
            firstActivatedAt: null,
            revision: 0,
          },
        } as any,
        manage: true,
      })
    );
    const dates = container.querySelectorAll<HTMLInputElement>(
      'input[type="datetime-local"]'
    );
    expect(dates[0].value).toBe("2026-01-31T12:45");
    expect(dates[1].value).toBe("2026-02-28T12:45");
    const status = container.querySelector("select")!;
    await act(() => {
      status.value = "active";
      status.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.textContent).toContain("Schedule preview");
    expect(container.textContent).toContain("Apr 30, 2026");
    expect(container.textContent).toContain(
      "monthly rates, not a payment total"
    );
    // A month-four renewal quotes 29 even while today is in the intro window.
    await render(
      React.createElement(SubscriptionForm, {
        key: "renewal",
        data: {
          provider: { id: 1, name: "Provider" },
          owner: null,
          subscription: {
            status: "active",
            startsAt: new Date("2026-04-30T12:45:00Z"),
            endsAt: new Date("2026-05-31T12:45:00Z"),
            firstActivatedAt: new Date("2026-01-31T12:45:00Z"),
            revision: 1,
          },
        } as any,
        manage: true,
      })
    );
    expect(container.querySelector(".text-4xl")?.textContent).toBe("$29");
    expect(container.textContent).toContain("Jan 31, 2026");
    expect(container.textContent).toContain("Apr 30, 2026");
  });
  it("keeps unpaid analytics and publishing locked while allowing the owner to view saved tools", async () => {
    state.member = { id: 7, emailVerified: true };
    state.workspace = {
      providers: [
        {
          provider: {
            id: 4,
            name: "Real provider",
            slug: "real",
            websiteUrl: "https://provider.example/",
            status: "active",
          },
          subscription: {
            status: "inactive",
            state: "inactive",
            startsAt: null,
            endsAt: null,
          },
          ownershipValid: true,
        },
      ],
      claims: [],
    };
    await render(React.createElement(ProviderBusiness));
    expect(container.textContent).toContain("فعّل أدوات مزوّدك");
    expect(state.analyticsCalls).not.toHaveBeenCalled();
    const button = [...container.querySelectorAll("button")].find(
      b => b.textContent === "عروضك وكوبوناتك"
    )!;
    await act(() => button.click());
    const create = [...container.querySelectorAll("button")].find(b =>
      b.textContent?.includes("عرض جديد")
    )!;
    expect(create.disabled).toBe(true);
  });
  it("does not show stale analytics after subscription access is denied", async () => {
    state.analyticsError = true;
    state.analytics = {
      totals: { views: 987654, website: 222, telegram: 333 },
    };
    await render(
      React.createElement(BusinessAnalytics, { accountId: 7, providerId: 4 })
    );
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain("987654");
    expect(state.analyticsCalls).toHaveBeenCalledWith({
      accountId: 7,
      providerId: 4,
      days: 30,
    });
  });
  it("escapes offer text and omits expired or future offers even in a previously loaded response", async () => {
    const now = Date.now();
    const offer = {
      id: 1,
      title: '<img src=x onerror="alert(1)">',
      description: "Clear offer terms and conditions",
      provider: { id: 4, name: "Real provider", slug: "real" },
      destinationUrl: "https://provider.example/offers",
      startsAt: new Date(now - 10000),
      endsAt: new Date(now + 100000),
      couponCode: "HELLO",
    };
    state.offers = [
      offer,
      {
        ...offer,
        id: 2,
        title: "Expired offer title",
        endsAt: new Date(now - 1),
      },
      {
        ...offer,
        id: 3,
        title: "Future offer title",
        startsAt: new Date(now + 10000),
      },
    ];
    await render(React.createElement(PublicPromotions));
    expect(container.textContent).toContain(offer.title);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).not.toContain("Expired offer title");
    expect(container.textContent).not.toContain("Future offer title");
    expect(container.querySelector("h1")).not.toBeNull();
    expect(
      container
        .querySelector('a[href="https://provider.example/offers"]')
        ?.getAttribute("rel")
    ).toContain("sponsored");
  });
  it("does not load subscription records for staff without business access", async () => {
    await render(React.createElement(AdminBusinessPanel));
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(state.accountCalls).not.toHaveBeenCalled();
  });
});
