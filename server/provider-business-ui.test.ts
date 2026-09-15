// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "ar",
  member: null as any,
  workspace: null as any,
  analytics: undefined as any,
  analyticsError: false,
  offers: [] as any[],
  permissions: [] as string[],
  analyticsCalls: vi.fn(),
  accountCalls: vi.fn(),
}));
vi.mock("@/contexts/LocaleContext", async original => ({
  ...(await original<any>()),
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("@/hooks/useMember", () => ({
  useMember: () => ({ data: { member: state.member } }),
}));
vi.mock("@/components/SiteChrome", () => ({
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
        mine: { useQuery: () => ({ data: state.workspace }) },
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
import { AdminBusinessPanel } from "../client/src/pages/AdminProviderBusiness";
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
});
const render = (element: React.ReactNode) => act(() => root.render(element));

describe("provider package interfaces", () => {
  it("offers a real sign-in path without inventing subscription prices or an active account", async () => {
    await render(React.createElement(ProviderBusiness));
    expect(container.textContent).toContain("لوحة المزود");
    expect(
      container.querySelector('a[href="/sign-in?next=/account/provider"]')
    ).not.toBeNull();
    expect(container.textContent).not.toMatch(/\$|Stripe|checkout/i);
    expect(state.analyticsCalls).not.toHaveBeenCalled();
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
    expect(container.textContent).toContain("تحتاج باقة فعالة");
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
