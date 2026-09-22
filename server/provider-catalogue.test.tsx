// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CatalogueInput } from "../shared/catalogueQuery";
import { providers, services } from "./testFixtures";
import ProviderCatalogue from "../client/src/components/ProviderCatalogue";
import {
  MarketplaceDataProvider,
  useMarketplaceData,
} from "../client/src/contexts/MarketplaceDataContext";

const state = vi.hoisted(() => ({
  locale: "en",
  requests: [] as {
    input: CatalogueInput;
    resolve: (data: any) => void;
    reject: (error: Error) => void;
  }[],
}));
vi.mock("@/contexts/LocaleContext", async original => ({
  ...(await original<any>()),
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("@/lib/trpc", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  return {
    trpc: {
      marketplace: {
        snapshot: {
          useQuery: (input: CatalogueInput, options: any) =>
            useQuery({
              ...options,
              retry: false,
              queryKey: [["marketplace", "snapshot"], { input, type: "query" }],
              queryFn: () =>
                new Promise((resolve, reject) =>
                  state.requests.push({ input, resolve, reject })
                ),
            }),
        },
      },
    },
  };
});

const provider = {
  ...providers[0],
  id: "provider-20",
  slug: "large-catalogue",
  activeServicesCount: 26,
};
function pageData(last = false) {
  return {
    source: "database",
    providers: [provider],
    services: Array.from({ length: last ? 1 : 25 }, (_, i) => ({
      ...services[0],
      providerId: provider.id,
      id: `service-${last ? 1 : 100 - i}`,
      name: `${last ? "Last page" : "First page"} service ${i + 1} — full service name with detailed conditions`,
      catalogueListing: "api_source",
      sourceRate: "1.0123456789",
      priceCurrency: "EGP",
      priceUnit: null,
      sourceServiceId: `${i + 1}`,
      sourceUrl: "https://provider.example/services",
      terms: "Full provider terms",
      platform: "Unknown",
    })),
    pagination: { total: 26, nextCursor: last ? null : { id: 76, rank: 0 } },
  };
}
let host: HTMLDivElement, root: Root, client: QueryClient;
let move: (to: string) => void;
let scroll: ReturnType<typeof vi.fn>;
function Catalogue() {
  const [path, navigate] = useLocation();
  move = navigate;
  const data = useMarketplaceData();
  const found = data.providerBySlug(path.split("/").at(-1)!);
  return found ? (
    <ProviderCatalogue key={found.id} provider={found} />
  ) : (
    <p>Provider loading or missing</p>
  );
}
async function render() {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MarketplaceDataProvider>
          <Catalogue />
        </MarketplaceDataProvider>
      </QueryClientProvider>
    )
  );
}
async function settle(data: any = pageData()) {
  await act(async () => {
    state.requests.at(-1)!.resolve(data);
  });
  await act(async () => {
    await new Promise(done => setTimeout(done, 0));
  });
}
function button(text: string, last = false) {
  const matches = Array.from(host.querySelectorAll("button")).filter(
    item => item.textContent === text
  );
  return matches.at(last ? -1 : 0)!;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scroll,
  });
  window.history.replaceState({}, "", "/providers/large-catalogue");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  state.requests = [];
  state.locale = "en";
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  client.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("keeps the table mounted while Next loads, then focuses its start on a short last page and cached Previous", async () => {
  await render();
  await settle();
  const heading = host.querySelector("h2")!;
  const first = host.querySelector(".provider-catalogue-name")!.textContent;
  expect(host.querySelectorAll("tr.provider-catalogue-row")).toHaveLength(25);
  await act(async () => button("Next", true).click());
  expect(state.requests.at(-1)!.input.cursor).toEqual({ id: 76, rank: 0 });
  expect(host.querySelector("h2")).toBe(heading);
  expect(host.querySelector(".provider-catalogue-name")!.textContent).toBe(
    first
  );
  expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(button("Next").disabled).toBe(true);
  expect(scroll).toHaveBeenLastCalledWith({
    block: "start",
    behavior: "instant",
  });
  await settle(pageData(true));
  expect(host.querySelectorAll("tr.provider-catalogue-row")).toHaveLength(1);
  expect(host.textContent).toContain("Page 2 / 2");
  expect(document.activeElement).toBe(heading);
  expect(button("Next").disabled).toBe(true);
  const calls = scroll.mock.calls.length;
  await act(async () => button("Previous", true).click());
  expect(host.textContent).toContain("Page 1 / 2");
  expect(host.querySelectorAll("tr.provider-catalogue-row")).toHaveLength(25);
  expect(scroll.mock.calls.length).toBeGreaterThan(calls);
  expect(document.activeElement).toBe(heading);
  scroll.mockClear();
  await act(async () => {
    void client.invalidateQueries();
  });
  await settle();
  expect(scroll).not.toHaveBeenCalled();
});

it("reveals full names, original exact prices and source terms within one row in Arabic", async () => {
  state.locale = "ar";
  await render();
  await settle();
  expect(host.querySelector("table")).not.toBeNull();
  expect(host.textContent).toContain("EGP 1.0123456789");
  expect(host.textContent).toContain("وحدة البيع غير محددة");
  expect(host.textContent).not.toContain("Unknown");
  const controls = host.querySelectorAll<HTMLButtonElement>(
    ".provider-catalogue-name"
  );
  await act(async () => controls[0].click());
  const detail = document.getElementById(
    controls[0].getAttribute("aria-controls")!
  )!;
  expect(detail.hidden).toBe(false);
  expect(detail.querySelector("h3")!.textContent).toBe(controls[0].textContent);
  expect(detail.textContent).toContain("Full provider terms");
  expect(
    detail.querySelector('a[href="https://provider.example/services"]')
  ).not.toBeNull();
  await act(async () => controls[1].click());
  expect(detail.hidden).toBe(true);
  expect(
    host.querySelectorAll(".provider-catalogue-detail-row:not([hidden])")
  ).toHaveLength(1);
});

it("searches the full provider catalogue and resets cursors when changing the search or page size", async () => {
  await render();
  await settle();
  await act(async () => button("Next").click());
  await settle(pageData(true));
  const field = host.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!.call(field, "Telegram");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  );
  expect(state.requests.at(-1)!.input).toMatchObject({
    scope: "provider",
    slug: provider.slug,
    q: "Telegram",
    limit: 25,
  });
  expect(state.requests.at(-1)!.input.cursor).toBeUndefined();
  await settle({
    ...pageData(),
    services: [],
    pagination: { total: 0, nextCursor: null },
  });
  expect(host.textContent).toContain("No services match your search.");
  const select = host.querySelector("select")!;
  await act(async () => {
    select.value = "50";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(state.requests.at(-1)!.input).toMatchObject({
    q: "Telegram",
    limit: 50,
  });
  expect(state.requests.at(-1)!.input.cursor).toBeUndefined();
});

it("keeps the provider and offers retry after a failed next page, without inventing rows", async () => {
  await render();
  await settle();
  await act(async () => button("Next").click());
  await act(async () => state.requests.at(-1)!.reject(new Error("offline")));
  await act(async () => {
    await new Promise(done => setTimeout(done, 0));
  });
  expect(host.querySelector("h2")).not.toBeNull();
  expect(host.querySelector('[role="alert"]')!.textContent).toContain(
    "temporarily unavailable"
  );
  expect(host.querySelectorAll("tr.provider-catalogue-row")).toHaveLength(0);
  await act(async () => button("Try again").click());
  await settle(pageData(true));
  expect(host.textContent).toContain("Last page service");
});

it("never displays the previous provider when navigating to a different profile", async () => {
  await render();
  await settle();
  await act(async () => move("/providers/another-provider"));
  expect(host.textContent).toBe("Provider loading or missing");
  expect(host.querySelector("table")).toBeNull();
  expect(state.requests.at(-1)!.input.slug).toBe("another-provider");
});
