// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogueIndex } from "../client/src/lib/catalogue";
import { providers, services } from "./testFixtures";
import Compare from "../client/src/pages/Compare";
import { PageTransition } from "../client/src/components/PageTransition";

const state = vi.hoisted(() => ({ data: null as any, quote: vi.fn() }));
vi.mock("@/contexts/MarketplaceDataContext", () => ({
  useMarketplaceData: () => state.data,
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: "en", dir: "ltr" }),
}));
vi.mock("@/components/SiteChrome", () => ({
  PublicLayout: ({ children }: any) => children,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    assistant: {
      quotes: {
        useQuery: (...args: any[]) => {
          state.quote(...args);
          return { data: undefined };
        },
      },
    },
    member: { me: { useQuery: () => ({ data: { member: null } }) } },
    workspace: {
      ids: { useQuery: () => ({ data: [] }) },
      watch: { useMutation: () => ({}) },
      saveComparison: { useMutation: () => ({}) },
    },
    useUtils: () => ({ workspace: { invalidate: async () => {} } }),
  },
}));

let host: HTMLDivElement, root: Root;
const original =
  "/compare?services=service-40,service-41&quantity=5000&currency=USD&previewTheme=orbit#details";
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  window.history.replaceState({ retained: true }, "", original);
  state.data = {
    ...catalogueIndex(providers, [
      { ...services[0]!, id: "service-40" },
      { ...services[0]!, id: "service-41", priceAmount: 2 },
    ]),
    source: "database",
    isLoading: false,
  };
  state.quote.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
async function mount() {
  await act(async () =>
    root.render(
      <PageTransition
        path="/compare"
        enabled
        label="Opening page"
        fallback={null}
      >
        {() => <Compare />}
      </PageTransition>
    )
  );
}
const quantity = () =>
  host.querySelector<HTMLInputElement>('input[type="number"]')!;
const currency = () => host.querySelector<HTMLSelectElement>("select")!;
async function setQuantity(value: string) {
  await act(async () => {
    const input = quantity();
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function setCurrency(value: string) {
  await act(async () => {
    currency().value = value;
    currency().dispatchEvent(new Event("change", { bubbles: true }));
  });
}
describe("comparison journey", () => {
  it("retains edited options in the URL, quote request and every sign-in link without adding history entries", async () => {
    await mount();
    const historyLength = window.history.length;
    quantity().focus();
    await setQuantity("10000");
    expect(document.activeElement).toBe(quantity());
    await setCurrency("EUR");
    expect(quantity().value).toBe("10000");
    expect(currency().value).toBe("EUR");
    const params = new URLSearchParams(window.location.search);
    expect(params.get("quantity")).toBe("10000");
    expect(params.get("currency")).toBe("EUR");
    expect(params.get("services")).toBe("service-40,service-41");
    expect(params.get("previewTheme")).toBe("orbit");
    expect(window.location.hash).toBe("#details");
    expect(window.history.state).toEqual({ retained: true });
    expect(window.history.length).toBe(historyLength);
    expect(state.quote).toHaveBeenLastCalledWith(
      {
        serviceIds: ["service-40", "service-41"],
        quantity: 10000,
        currency: "EUR",
      },
      expect.objectContaining({ enabled: true })
    );
    const links = host.querySelectorAll<HTMLAnchorElement>(
      'a[href^="/sign-in"]'
    );
    expect(links).toHaveLength(3);
    links.forEach(link => {
      const next = new URL(
        new URL(link.href).searchParams.get("next")!,
        window.location.origin
      );
      expect(next.searchParams.get("quantity")).toBe("10000");
      expect(next.searchParams.get("currency")).toBe("EUR");
    });
    await act(async () => root.unmount());
    root = createRoot(host);
    await mount();
    expect(quantity().value).toBe("10000");
    expect(currency().value).toBe("EUR");
  });
  it("responds to history navigation while the comparison page stays mounted", async () => {
    await mount();
    await setQuantity("10000");
    await setCurrency("EUR");
    await act(async () => {
      window.history.replaceState({}, "", original);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(quantity().value).toBe("5000");
    expect(currency().value).toBe("USD");
    expect(state.quote).toHaveBeenLastCalledWith(
      expect.objectContaining({ quantity: 5000, currency: "USD" }),
      expect.objectContaining({ enabled: true })
    );
  });
  it.each(["", "0", "1.5", "2147483648"])(
    "keeps invalid quantity '%s' visible without requesting a quote or substituting 1000",
    async value => {
      await mount();
      await setQuantity(value);
      expect(quantity().value).toBe(value);
      expect(quantity().getAttribute("aria-invalid")).toBe("true");
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(
        "whole number"
      );
      expect(host.textContent).not.toContain("NaN");
      expect(host.querySelectorAll('a[href^="/sign-in"]')).toHaveLength(0);
      expect(host.querySelectorAll("button:disabled")).toHaveLength(3);
      expect(state.quote).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ enabled: false })
      );
      await setQuantity("12000");
      expect(quantity().value).toBe("12000");
      expect(quantity().getAttribute("aria-invalid")).toBe("false");
    }
  );
});
