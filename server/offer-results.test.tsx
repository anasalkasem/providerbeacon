// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CatalogueInput } from "../shared/catalogueQuery";
import type { Service } from "../client/src/data/marketplace";
import { providers, services } from "./testFixtures";
import SmmOfferTable from "../client/src/components/SmmOfferTable";
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
      member: { me: { useQuery: () => ({ data: { member: null } }) } },
      workspace: {
        ids: { useQuery: () => ({ data: [] }) },
        watch: { useMutation: () => ({}) },
      },
      useUtils: () => ({ workspace: { invalidate: async () => {} } }),
    },
  };
});

const provider = { ...providers[0], id: "provider-20", slug: "real-provider" };
const offer = (
  id: string,
  amount: number,
  patch: Partial<Service> = {}
): Service => ({
  ...services[0],
  id,
  providerId: provider.id,
  name: `${id}: full service name with conditions`,
  priceAmount: amount,
  priceCurrency: "USD",
  priceUnit: "per_1000",
  countryCode: "US",
  refill: "No refill",
  min: 100,
  max: 10000,
  featured: false,
  sourceUrl: "https://provider.example/services",
  terms: "Full provider terms",
  ...patch,
});
const firstRows = [
  offer("service-100", 4, { featured: true }),
  offer("service-99", 2),
  offer("service-98", 0.1, {
    priceUnit: null,
    catalogueListing: "api_source",
    sourceRate: "0.100000000000000001",
  }),
  offer("service-97", 3),
  offer("service-96", 5),
];
function pageData(last = false) {
  return {
    source: "database",
    providers: [provider],
    services: last ? [offer("service-95", 1)] : firstRows,
    pagination: { total: 6, nextCursor: last ? null : { id: 96, rank: 0 } },
  };
}
function Results({
  priceSorted = false,
  quantity,
}: {
  priceSorted?: boolean;
  quantity?: number;
}) {
  const data = useMarketplaceData();
  const [selected, setSelected] = useState<Service[]>([]);
  return (
    <>
      <button onClick={() => data.setFilters({ q: "different service" })}>
        Change search
      </button>
      <SmmOfferTable
        services={data.services}
        selected={selected}
        pageSize={5}
        quantity={quantity}
        priceSorted={priceSorted}
        toggle={service =>
          setSelected(current =>
            current.some(row => row.id === service.id)
              ? current.filter(row => row.id !== service.id)
              : [...current, service]
          )
        }
      />
    </>
  );
}
let host: HTMLDivElement, root: Root, client: QueryClient;
let scroll: ReturnType<typeof vi.fn>;
async function render(priceSorted = false, quantity?: number) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MarketplaceDataProvider>
          <Results priceSorted={priceSorted} quantity={quantity} />
        </MarketplaceDataProvider>
      </QueryClientProvider>
    )
  );
}
async function settle(data: any = pageData()) {
  await act(async () => state.requests.at(-1)!.resolve(data));
  await act(async () => {
    await new Promise(done => setTimeout(done, 0));
  });
}
function button(text: string, last = false) {
  return Array.from(host.querySelectorAll("button"))
    .filter(item => item.textContent === text)
    .at(last ? -1 : 0)!;
}
function row(id: string) {
  return host.querySelector(`[data-offer-id="${id}"]`)!;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scroll,
  });
  window.history.replaceState({}, "", "/services");
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

it("preserves server order without page-local lowest claims or promoting sponsored offers", async () => {
  await render();
  await settle();
  expect(host.querySelectorAll("table")).toHaveLength(1);
  expect(
    Array.from(host.querySelectorAll(".offer-results-row")).map(row =>
      row.getAttribute("data-offer-id")
    )
  ).toEqual(firstRows.map(row => row.id));
  expect(host.querySelector("[data-lowest]")).toBeNull();
  expect(host.querySelector('[aria-sort="ascending"]')).toBeNull();
  expect(row("service-98").textContent).toContain("USD 0.100000000000000001");
  expect(
    host.querySelectorAll('a[href="/providers/real-provider"]')
  ).toHaveLength(5);
  await render(true);
  expect(host.querySelector('[aria-sort="ascending"]')).not.toBeNull();
  expect(
    Array.from(host.querySelectorAll(".offer-results-row")).map(row =>
      row.getAttribute("data-offer-id")
    )
  ).toEqual(firstRows.map(row => row.id));
  expect(host.textContent).toContain("Advertising does not change this order.");
});

it.each([false, true])(
  "opens Arabic details and only quotes an explicitly supplied quantity (%s)",
  async withQuantity => {
    state.locale = "ar";
    await render(false, withQuantity ? 1000 : undefined);
    await settle();
    const control = row("service-99").querySelector<HTMLButtonElement>(
      ".offer-results-name"
    )!;
    expect(control.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector(".offer-results-detail")).toBeNull();
    await act(async () => control.click());
    const detail = document.getElementById(
      control.getAttribute("aria-controls")!
    )!;
    expect(detail.hidden).toBe(false);
    expect(detail.querySelector("h3")!.textContent).toBe(firstRows[1].name);
    expect(detail.textContent).toContain("Full provider terms");
    expect(detail.textContent!.includes("تكلفة الكمية المحددة")).toBe(
      withQuantity
    );
    expect(
      detail.querySelector('a[href="https://provider.example/services"]')
    ).not.toBeNull();
    expect(
      detail.querySelector(
        withQuantity
          ? 'a[href="/sign-in?next=%2Fservices%3Fquantity%3D1000"]'
          : 'a[href="/compare?services=service-99"]'
      )
    ).not.toBeNull();
    await act(async () =>
      row("service-98")
        .querySelector<HTMLButtonElement>(".offer-results-name")!
        .click()
    );
    expect(detail.hidden).toBe(true);
    expect(
      host.querySelectorAll(".provider-catalogue-detail-row:not([hidden])")
    ).toHaveLength(1);
    expect(
      host.querySelector(".offer-results-detail")!.textContent!.includes("تكلفة الكمية المحددة")
    ).toBe(withQuantity);
  }
);

it("caps selection at four without preventing deselection, and retains selected offers across pages", async () => {
  await render();
  await settle();
  for (const id of ["service-100", "service-99", "service-98", "service-97"])
    await act(async () =>
      row(id)
        .querySelector<HTMLButtonElement>(".offer-results-compare")!
        .click()
    );
  expect(
    row("service-96").querySelector<HTMLButtonElement>(
      ".offer-results-compare"
    )!.disabled
  ).toBe(true);
  expect(
    host.querySelectorAll('.offer-results-compare[aria-pressed="true"]')
  ).toHaveLength(4);
  await act(async () => button("Next").click());
  await settle(pageData(true));
  expect(
    row("service-95").querySelector<HTMLButtonElement>(
      ".offer-results-compare"
    )!.disabled
  ).toBe(true);
  await act(async () => button("Previous").click());
  expect(
    host.querySelectorAll('.offer-results-compare[aria-pressed="true"]')
  ).toHaveLength(4);
  await act(async () =>
    row("service-99")
      .querySelector<HTMLButtonElement>(".offer-results-compare")!
      .click()
  );
  expect(
    row("service-96").querySelector<HTMLButtonElement>(
      ".offer-results-compare"
    )!.disabled
  ).toBe(false);
});

it("keeps rows during Next, focuses new results on a short page and never scrolls on background refresh", async () => {
  await render();
  await settle();
  const heading = host.querySelector("h2")!;
  await act(async () =>
    row("service-99")
      .querySelector<HTMLButtonElement>(".offer-results-name")!
      .click()
  );
  await act(async () => button("Next", true).click());
  expect(state.requests.at(-1)!.input.cursor).toEqual({ id: 96, rank: 0 });
  expect(host.querySelectorAll(".offer-results-row")).toHaveLength(5);
  expect(host.querySelector("h2")).toBe(heading);
  expect(host.querySelector(".offer-results-detail")).toBeNull();
  expect(button("Next").disabled).toBe(true);
  expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
  await settle(pageData(true));
  expect(host.querySelectorAll(".offer-results-row")).toHaveLength(1);
  expect(document.activeElement).toBe(heading);
  expect(scroll).toHaveBeenLastCalledWith({
    block: "start",
    behavior: "instant",
  });
  expect(host.textContent).toContain("Page 2 / 2");
  expect(host.querySelector("[data-lowest]")).toBeNull();
  await act(async () => button("Previous", true).click());
  expect(host.querySelectorAll(".offer-results-row")).toHaveLength(5);
  expect(document.activeElement).toBe(heading);
  scroll.mockClear();
  await act(async () => {
    void client.invalidateQueries();
  });
  await settle();
  expect(scroll).not.toHaveBeenCalled();
});

it("clears previous search results while a new filter loads and resets its cursor", async () => {
  await render();
  await settle();
  await act(async () => button("Next").click());
  await settle(pageData(true));
  await act(async () => button("Change search").click());
  expect(state.requests.at(-1)!.input.q).toBe("different service");
  expect(state.requests.at(-1)!.input.cursor).toBeUndefined();
  expect(host.querySelector(".offer-results-row")).toBeNull();
  await settle({
    ...pageData(),
    services: [],
    pagination: { total: 0, nextCursor: null },
  });
  expect(host.querySelector("[data-lowest]")).toBeNull();
});

it("leaves Previous available after a failed next page", async () => {
  await render();
  await settle();
  await act(async () => button("Next").click());
  await act(async () => state.requests.at(-1)!.reject(new Error("offline")));
  await act(async () => {
    await new Promise(done => setTimeout(done, 0));
  });
  expect(host.querySelectorAll(".offer-results-row")).toHaveLength(0);
  expect(button("Previous").disabled).toBe(false);
  await act(async () => button("Previous").click());
  expect(host.querySelectorAll(".offer-results-row")).toHaveLength(5);
});
