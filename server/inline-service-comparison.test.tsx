// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { providers, services } from "./testFixtures";
import { useServiceSelection } from "../client/src/hooks/useServiceSelection";
import InlineServiceComparison from "../client/src/components/InlineServiceComparison";

const state = vi.hoisted(() => ({
  data: undefined as any,
  error: false,
  requests: [] as any[],
}));
vi.mock("@/contexts/LocaleContext", async original => ({
  ...(await original<any>()),
  useLocale: () => ({ locale: "en" }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    marketplace: {
      snapshot: {
        useQuery: (input: any) => {
          state.requests.push(input);
          return {
            data: state.data,
            isError: state.error,
            isLoading: false,
            isFetching: false,
            refetch: vi.fn(),
          };
        },
      },
    },
  },
}));

const firstProvider = {
  ...providers[0],
  id: "provider-1",
  name: "First owner",
  slug: "first-owner",
};
const secondProvider = {
  ...providers[1],
  id: "provider-2",
  name: "Second owner",
  slug: "second-owner",
};
const first = {
  ...services[0],
  id: "service-1",
  providerId: firstProvider.id,
  name: "First service",
  countryCode: "US",
  refill: "No refill",
  min: 100,
  max: 10000,
  priceCurrency: "USD",
  priceUnit: "per_1000" as const,
  priceAmount: 2,
  featured: false,
};
const second = {
  ...first,
  id: "service-2",
  providerId: secondProvider.id,
  name: "Second service",
  priceAmount: 3,
};
function Harness({ quantity }: { quantity?: number }) {
  const selection = useServiceSelection();
  return (
    <>
      <button onClick={() => selection.toggle("service-1")}>
        Choose first
      </button>
      <button onClick={() => selection.toggle("service-2")}>
        Choose second
      </button>
      <InlineServiceComparison
        ids={selection.ids}
        quantity={quantity}
        remove={selection.toggle}
        clear={selection.clear}
      />
    </>
  );
}
let root: Root, host: HTMLDivElement;
async function render(quantity?: number) {
  await act(async () => root.render(<Harness quantity={quantity} />));
}
async function click(text: string) {
  const button = Array.from(host.querySelectorAll("button")).find(
    button => button.textContent === text
  )!;
  await act(async () => button.click());
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  sessionStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  state.error = false;
  state.requests = [];
  // Reversed provider order catches position-based misattribution.
  state.data = {
    source: "database",
    providers: [secondProvider, firstProvider],
    services: [second, first],
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("restores selected offers after remount, resolves their own providers and compares equivalent prices", async () => {
  await render();
  await click("Choose first");
  await click("Choose second");
  expect(state.requests.at(-1)).toEqual({ scope: "compare", ids: [1, 2] });
  const headings = Array.from(host.querySelectorAll("thead th"));
  expect(headings[1].textContent).toContain("First owner");
  expect(headings[1].textContent).toContain("First service");
  expect(headings[2].textContent).toContain("Second owner");
  expect(headings[2].textContent).toContain("Second service");
  expect(host.querySelectorAll('[data-price-status="lowest"]')).toHaveLength(1);
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(state.requests.at(-1).ids).toEqual([1, 2]);
  expect(host.querySelectorAll("thead th")).toHaveLength(3);
  await click("Clear selection");
  expect(host.querySelector("table")).toBeNull();
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(host.querySelector("table")).toBeNull();
});

it("does not label a winner across currencies or invalid quantities, or substitute an orphan's provider", async () => {
  await render();
  await click("Choose first");
  await click("Choose second");
  state.data = {
    ...state.data,
    services: [first, { ...second, priceCurrency: "EUR" }],
  };
  await render();
  expect(host.querySelector('[data-price-status="lowest"]')).toBeNull();
  state.data = { ...state.data, services: [first, second] };
  await render(10001);
  expect(host.querySelector('[data-price-status="lowest"]')).toBeNull();
  state.data = { ...state.data, providers: [firstProvider] };
  await render();
  expect(host.querySelectorAll("thead th")[2].textContent).toContain(
    "currently unavailable"
  );
  expect(host.querySelectorAll("thead th")[2].querySelector("a")).toBeNull();
  expect(host.querySelector('[data-price-status="lowest"]')).toBeNull();
  state.error = true;
  await render();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(host.querySelector("[data-price-status]")).toBeNull();
});

it("remains usable with blocked browser storage", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  await render();
  await click("Choose first");
  expect(state.requests.at(-1).ids).toEqual([1]);
  expect(host.textContent).toContain("First owner");
});

it("compares exact published rates without applying an unselected order quantity", async () => {
  state.data.services = [
    {
      ...first,
      min: 5000,
      catalogueListing: "api_source",
      sourceRate: "1.000000000000000001",
    },
    {
      ...second,
      min: 5000,
      catalogueListing: "api_source",
      sourceRate: "1.000000000000000002",
    },
  ];
  await render();
  await click("Choose first");
  await click("Choose second");
  const lowest = host.querySelectorAll('[data-price-status="lowest"]');
  expect(lowest).toHaveLength(1);
  expect(lowest[0].textContent).toContain("1.000000000000000001");
  expect(host.textContent).not.toContain("Quantity total");
  expect(host.textContent).not.toContain("Cost for selected quantity");
  expect(host.textContent).not.toContain("Below minimum");
  expect(host.textContent).toContain("5,000");
  expect(
    host.querySelector('a[href="/compare?services=service-1,service-2"]')
  ).not.toBeNull();
  state.data.services[1].sourceRate = null;
  await render();
  expect(host.querySelector('[data-price-status="lowest"]')).toBeNull();
});
