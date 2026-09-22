// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { providers, services } from "./testFixtures";
import {
  providerSelection,
  providerSearchUrl,
} from "../shared/providerSelection";
import { catalogueInput } from "../shared/catalogueQuery";

const state = vi.hoisted(() => ({
  data: {} as any,
  ads: [] as any[],
  navigate: vi.fn(),
  search: "",
  chat: vi.fn(),
}));
vi.mock("@/contexts/MarketplaceDataContext", () => ({
  useMarketplaceData: () => state.data,
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: "en" }),
}));
vi.mock("@/components/SiteChrome", () => ({
  PublicLayout: ({ children }: any) => children,
}));
vi.mock("@/components/WorkspaceActions", () => ({
  SaveComparison: () => null,
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ["/", state.navigate],
  useSearch: () => state.search,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    business: {
      vip: { list: { useQuery: () => ({ data: { items: state.ads } }) } },
    },
    marketplace: { snapshot: { useQuery: () => ({ data: state.data }) } },
    assistant: {
      status: { useQuery: () => ({ data: { available: true } }) },
      chat: {
        useMutation: () => ({ mutateAsync: state.chat, isPending: false }),
      },
    },
  },
}));
import HomeDiscovery from "../client/src/components/HomeDiscovery";
import Find from "../client/src/pages/Find";
let host: HTMLDivElement, root: Root;
const card = (id: number) => ({
  ...providers[0],
  id: `provider-${id}`,
  slug: `provider-${id}`,
  name: `Provider ${id}`,
  activeServicesCount: 9876,
  logoUrl: null,
  websitePreviewUrl: null,
});
const button = (label: string) =>
  Array.from(host.querySelectorAll("button")).find(
    node =>
      node.getAttribute("aria-label") === label || node.textContent === label
  )!;
async function click(node: Element) {
  await act(async () =>
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  );
}
async function render(component = <HomeDiscovery />) {
  await act(async () => root.render(component));
}
async function input(
  node: HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      node.tagName === "INPUT"
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype,
      "value"
    )!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.data = {
    source: "database",
    isLoading: false,
    providers: Array.from({ length: 20 }, (_, i) => card(i + 1)),
    services,
    retry: vi.fn(),
    pagination: { total: 20 },
  };
  state.ads = [];
  state.search = "";
  state.navigate.mockReset();
  state.chat.mockReset().mockResolvedValue({
    answer: "What quantity?",
    offers: [],
    totalMatches: 0,
    catalogueUrl: "/services?providers=2",
    quantity: null,
    displayCurrency: "USD",
    request: {},
    explanationAvailable: true,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("shows at most 16 unique real albums and no initial services or prices", async () => {
  state.data.providers.unshift(state.data.providers[0]);
  await render();
  const albums = host.querySelectorAll("article");
  expect(albums).toHaveLength(16);
  expect(
    new Set(Array.from(albums).map(node => node.getAttribute("aria-label")))
      .size
  ).toBe(16);
  expect(albums[0].querySelector("a")?.getAttribute("href")).toBe(
    "/providers/provider-1"
  );
  expect(albums[0].textContent).toContain("9,876 published services");
  const requestPanel = host.querySelector(".home-request-panel")!;
  expect(requestPanel.querySelector(".home-choice-logo, img")).toBeNull();
  expect(requestPanel.nextElementSibling?.className).toBe("home-logo-section");
  expect(host.textContent).not.toContain(services[0].name);
  expect(host.textContent).not.toMatch(/Lowest price|Trusted|USD/);
  state.data = { ...state.data, providers: [card(1)] };
  await render();
  expect(host.querySelectorAll("article")).toHaveLength(1);
});
it("bounds provider selection and preserves the exact request and selection in search and browse", async () => {
  await render();
  for (const id of [1, 2, 3, 4]) await click(button(`Provider ${id}`));
  expect(button("Provider 5").disabled).toBe(true);
  const request = "1000 متابع + تعويض 30 يوم & شرط خاص";
  await input(host.querySelector("input")!, request);
  await click(button("Find matching offers"));
  const url = new URL(
    state.navigate.mock.calls.at(-1)![0],
    "https://providerbeacon.com"
  );
  expect(url.pathname).toBe("/find");
  expect(url.searchParams.get("q")).toBe(request);
  expect(url.searchParams.get("providers")).toBe("1,2,3,4");
  expect(
    host.querySelector('a[href="/services?providers=1,2,3,4"]')
  ).not.toBeNull();
  await click(button("All providers"));
  expect(button("Provider 5").disabled).toBe(false);
  await click(button("Find matching offers"));
  expect(
    new URL(state.navigate.mock.calls.at(-1)![0], url).searchParams.has(
      "providers"
    )
  ).toBe(false);
});
it("retains a visitor's selection across catalogue failure and retry without stale albums", async () => {
  await render();
  await click(button("Provider 2"));
  state.data = { ...state.data, source: "unavailable" };
  await render();
  expect(host.querySelectorAll("article")).toHaveLength(0);
  await click(button("Try again"));
  expect(state.data.retry).toHaveBeenCalledOnce();
  await input(host.querySelector("input")!, "1000 followers");
  await click(button("Find matching offers"));
  expect(
    new URL(
      state.navigate.mock.calls.at(-1)![0],
      "https://providerbeacon.com"
    ).searchParams.get("providers")
  ).toBe("2");
});
it("uses active paid artwork, labels it, and falls back when its image fails", async () => {
  state.data.providers = [card(1), card(2)];
  state.ads = [
    {
      providerId: 1,
      revision: 1,
      coverUrl: "https://provider.example/cover.webp",
      placement: "paid",
      endsAt: new Date(Date.now() + 60000).toISOString(),
    },
    {
      providerId: 2,
      revision: 1,
      coverUrl: "https://provider.example/expired.webp",
      placement: "paid",
      endsAt: new Date(Date.now() - 60000).toISOString(),
    },
  ];
  await render();
  const first = host.querySelector("article")!;
  const cover = first.querySelector(".home-album-cover img")!;
  expect(cover.getAttribute("src")).toContain("cover.webp");
  expect(first.querySelector(".home-album-placement")).not.toBeNull();
  expect(host.querySelector('img[src*="expired"]')).toBeNull();
  await act(async () => cover.dispatchEvent(new Event("error")));
  expect(first.querySelector(".home-album-cover img")).toBeNull();
  expect(first.textContent).toContain("Provider 1");
});
it("carries selected providers into the initial AI request, follow-ups and URL changes", async () => {
  state.search = "q=1000+followers&providers=2";
  state.data.providers = [card(2)];
  await render(<Find />);
  expect(state.chat).toHaveBeenCalledTimes(1);
  expect(state.chat.mock.calls[0][0]).toMatchObject({
    message: "1000 followers",
    context: { providerIds: [2] },
  });
  await input(host.querySelector("textarea")!, "Make that 2000 with refill");
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  );
  expect(state.chat.mock.calls[1][0]).toMatchObject({
    message: "Make that 2000 with refill",
    context: { providerIds: [2] },
  });
  state.search = "q=1000+followers&providers=3";
  await render(<Find />);
  expect(state.chat.mock.calls[2][0]).toMatchObject({
    message: "1000 followers",
    history: [],
    context: { providerIds: [3] },
  });
});
it("parses only bounded public IDs and rejects invalid API scope", () => {
  expect(providerSelection("2,2,0,-1,abc,3,4,5,6,2147483648")).toEqual([
    2, 3, 4, 5,
  ]);
  expect(providerSearchUrl("", [])).toBe("/find");
  for (const providerIds of [
    [0],
    [-1],
    [1.5],
    [2147483648],
    [1, 2, 3, 4, 5],
    ["1"],
  ])
    expect(
      catalogueInput.safeParse({ scope: "services", providerIds }).success
    ).toBe(false);
});
