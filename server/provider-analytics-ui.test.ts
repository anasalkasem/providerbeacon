// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  trackProviderContact,
  trackProviderEvent,
  useProviderPageView,
} from "../client/src/lib/providerAnalytics";

const state = vi.hoisted(() => ({
  locale: "en",
  permissions: ["providers.read"],
  input: {} as any,
  options: {} as any,
  data: undefined as any,
  error: false,
  refetch: vi.fn(),
}));
vi.mock("@/contexts/LocaleContext", async original => ({
  ...(await original<any>()),
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: any) => React.createElement("main", null, children),
}));
vi.mock("@/components/ProviderPicker", () => ({
  default: ({ value, onChange, emptyLabel }: any) =>
    React.createElement(
      "select",
      {
        "aria-label": "Provider picker",
        value,
        onChange: (event: any) => onChange(event.target.value),
      },
      ["", "1", "2"].map(id =>
        React.createElement("option", { key: id, value: id }, id || emptyLabel)
      )
    ),
}));
vi.mock("recharts", async original => ({
  ...(await original<any>()),
  ResponsiveContainer: ({ children }: any) =>
    React.cloneElement(children, { width: 600, height: 256 }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      access: {
        useQuery: () => ({ data: { permissions: state.permissions } }),
      },
      analytics: {
        useQuery: (input: any, options: any) => {
          state.input = input;
          state.options = options;
          return {
            data: state.data,
            isError: state.error,
            isFetching: false,
            refetch: state.refetch,
          };
        },
      },
    },
  },
}));
import { ProviderAnalyticsPanel } from "../client/src/pages/AdminProviderAnalytics";

let root: Root, container: HTMLDivElement;
const now = Date.parse("2026-09-16T12:00:00Z");
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 204 }))
  );
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  Object.defineProperty(navigator, "webdriver", {
    configurable: true,
    get: () => false,
  });
  localStorage.clear();
  state.locale = "en";
  state.permissions = ["providers.read"];
  state.error = false;
  state.data = undefined;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "webdriver");
});
const bodies = () =>
  vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
function Page({ id }: { id: string }) {
  useProviderPageView(id);
  return React.createElement(
    "a",
    {
      href: "https://provider.example",
      target: "_blank",
      rel: "noopener noreferrer",
    },
    "Visit provider"
  );
}
const render = (element: React.ReactNode) => act(() => root.render(element));

describe("public provider measurement", () => {
  it("waits for a visible page, avoids rerender duplicates and cancels unmounted or hidden views", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    await render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(Page, { id: "provider-1" })
      )
    );
    await act(() => vi.advanceTimersByTime(999));
    expect(fetch).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTime(1));
    expect(bodies().map(body => body.kind)).toEqual(["view"]);
    await render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(Page, { id: "provider-1" })
      )
    );
    await act(() => vi.advanceTimersByTime(2000));
    expect(fetch).toHaveBeenCalledTimes(1);
    await render(React.createElement(Page, { id: "provider-2" }));
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await act(() => vi.advanceTimersByTime(5000));
    expect(fetch).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await act(() => vi.advanceTimersByTime(1000));
    expect(bodies().at(-1).providerId).toBe(2);
    await render(React.createElement(Page, { id: "provider-3" }));
    await render(null);
    await act(() => vi.advanceTimersByTime(1000));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("keeps identity stable within a UTC day, rotates it later and sends no customer identity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    trackProviderEvent("provider-1", "view");
    trackProviderEvent("provider-2", "view");
    expect(bodies()[0].visitorId).toBe(bodies()[1].visitorId);
    expect(Object.keys(bodies()[0]).sort()).toEqual([
      "kind",
      "providerId",
      "visitorId",
    ]);
    vi.setSystemTime(now + 86_400_000);
    trackProviderEvent("provider-1", "view");
    expect(bodies()[2].visitorId).not.toBe(bodies()[0].visitorId);
    expect(fetch).toHaveBeenCalledWith(
      "/api/provider-analytics",
      expect.objectContaining({
        keepalive: true,
        credentials: "same-origin",
        method: "POST",
      })
    );
  });
  it("supports ordinary, keyboard and middle-button activation without intercepting navigation", async () => {
    await render(React.createElement(Page, { id: "provider-1" }));
    const event = {
      isTrusted: true,
      defaultPrevented: false,
      type: "click",
      button: 0,
    };
    trackProviderContact("provider-1", "website", event); // Includes Enter-generated trusted click.
    trackProviderContact("provider-1", "telegram", {
      ...event,
      type: "auxclick",
      button: 1,
    });
    expect(bodies().map(body => body.kind)).toEqual([
      "view",
      "website",
      "view",
      "telegram",
    ]);
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "https://provider.example"
    );
    trackProviderContact("provider-1", "website", {
      ...event,
      isTrusted: false,
    });
    trackProviderContact("provider-1", "website", {
      ...event,
      defaultPrevented: true,
    });
    trackProviderContact("provider-1", "website", {
      ...event,
      type: "auxclick",
      button: 2,
    });
    expect(fetch).toHaveBeenCalledTimes(4);
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Offline"));
    expect(() => trackProviderEvent("provider-1", "website")).not.toThrow();
    await Promise.resolve();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Blocked storage");
    });
    expect(() =>
      trackProviderContact("provider-1", "website", event)
    ).not.toThrow();
    expect(container.querySelector("a")?.getAttribute("target")).toBe("_blank");
  });
  it("honours privacy and automation flags and skips invalid/demo provider IDs", () => {
    for (const id of ["demo-1", "1", "provider--1", "provider-2147483648"])
      trackProviderEvent(id, "view");
    expect(fetch).not.toHaveBeenCalled();
    vi.spyOn(navigator, "webdriver", "get").mockReturnValue(true);
    trackProviderEvent("provider-1", "view");
    expect(fetch).not.toHaveBeenCalled();
    vi.spyOn(navigator, "webdriver", "get").mockReturnValue(false);
    vi.stubGlobal("navigator", { doNotTrack: "1" });
    trackProviderEvent("provider-1", "view");
    vi.stubGlobal("navigator", { globalPrivacyControl: true });
    trackProviderEvent("provider-1", "view");
    expect(fetch).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });
});

function report() {
  return {
    collectionEnabled: true,
    startedAt: new Date(now),
    generatedAt: new Date(now),
    from: "2026-09-10",
    to: "2026-09-16",
    totals: { views: 12, website: 7, telegram: 4 },
    daily: [
      { day: "2026-09-15", measured: false, views: 0, website: 0, telegram: 0 },
      { day: "2026-09-16", measured: true, views: 12, website: 7, telegram: 4 },
    ],
    providers: [
      {
        id: 1,
        name: "Provider One",
        slug: "one",
        views: 12,
        website: 7,
        telegram: 4,
      },
    ],
    totalProviders: 26,
    page: 1,
    pageCount: 2,
  };
}
describe("provider analytics dashboard", () => {
  it("shows channel metrics, unmeasured history and filters with pagination reset", async () => {
    state.data = report();
    await render(React.createElement(ProviderAnalyticsPanel));
    expect(container.textContent).toContain("Website clicks");
    expect(container.textContent).toContain("Telegram clicks");
    expect(container.textContent).toContain("Before measurement");
    expect(container.textContent).toContain("confirmed sales");
    const click = (text: string) =>
      act(() =>
        Array.from(container.querySelectorAll("button"))
          .find(button => button.textContent === text)!
          .click()
      );
    await click("Next");
    expect(state.input.page).toBe(2);
    const period = container.querySelectorAll("select")[1];
    await act(() => {
      period.value = "90";
      period.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(state.input).toMatchObject({ days: 90, page: 1 });
    await click("Provider One");
    expect(state.input).toMatchObject({ providerId: 1, days: 90, page: 1 });
    await click("Refresh");
    expect(state.refetch).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector("table")?.parentElement?.className
    ).toContain("overflow-auto");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("renders Arabic, zero activity and load errors without fabricating old data", async () => {
    state.locale = "ar";
    state.data = report();
    state.data.totals = { views: 0, website: 0, telegram: 0 };
    state.data.providers = [];
    await render(React.createElement(ProviderAnalyticsPanel));
    expect(container.textContent).toContain("إحصاءات المزوّدين");
    expect(container.textContent).toContain("لم يُسجّل نشاط");
    expect(container.textContent).toContain("قبل بدء القياس");
    state.error = true;
    await render(React.createElement(ProviderAnalyticsPanel));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "تعذّر تحميل الإحصاءات"
    );
    expect(container.querySelector("table")).toBeNull();
  });
  it("does not request private reports without the provider-read permission", async () => {
    state.permissions = [];
    await render(React.createElement(ProviderAnalyticsPanel));
    expect(state.options.enabled).toBe(false);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });
});
