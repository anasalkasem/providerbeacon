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
async function select(index: number, value: string) {
  await act(async () => {
    const field = host.querySelectorAll<HTMLSelectElement>(
      ".home-request-form select"
    )[index];
    field.value = value;
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function submit() {
  await act(async () =>
    host
      .querySelector(".home-request-form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  );
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.data = {
    source: "database",
    isLoading: false,
    providers: Array.from({ length: 50 }, (_, i) => card(i + 1)),
    services,
    retry: vi.fn(),
    pagination: { total: 50 },
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
it("compares a service across all providers without listing the 50 provider names in search", async () => {
  await render();
  const panel = host.querySelector(".home-request-panel")!;
  expect(panel.textContent).not.toMatch(/Provider \d|select up to 4/);
  expect(panel.querySelectorAll("select")).toHaveLength(2);
  expect(panel.querySelectorAll("button")).toHaveLength(1);
  expect(panel.querySelector("img")).toBeNull();
  await select(0, "Instagram");
  await select(1, "Followers");
  const request = "عرب + تعويض & جودة";
  await input(host.querySelector("input")!, "  " + request + "  ");
  await click(button("Compare services"));
  const url = new URL(
    state.navigate.mock.calls.at(-1)![0],
    "https://providerbeacon.com"
  );
  expect(url.pathname).toBe("/services");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    q: request,
    platform: "Instagram",
    category: "Followers",
  });
  expect(panel.querySelector('a[href="/find"]')).not.toBeNull();
});
it("allows filters without a keyword and clears both filters back to the full catalogue", async () => {
  await render();
  expect(host.querySelector("input")!.required).toBe(false);
  await select(0, "TikTok");
  await select(1, "Views");
  await submit();
  expect(state.navigate).toHaveBeenLastCalledWith(
    "/services?platform=TikTok&category=Views"
  );
  await select(0, "");
  await submit();
  expect(state.navigate).toHaveBeenLastCalledWith("/services?category=Views");
  await select(1, "");
  await input(host.querySelector("input")!, "   ");
  await submit();
  expect(state.navigate).toHaveBeenLastCalledWith("/services");
});
it("keeps service filters usable across provider catalogue failure and retry", async () => {
  await render();
  await select(0, "Telegram");
  await select(1, "Subscribers");
  state.data = { ...state.data, source: "unavailable" };
  await render();
  expect(host.querySelectorAll("article")).toHaveLength(0);
  await click(button("Try again"));
  expect(state.data.retry).toHaveBeenCalledOnce();
  await submit();
  expect(state.navigate).toHaveBeenLastCalledWith(
    "/services?platform=Telegram&category=Subscribers"
  );
  state.data = { ...state.data, source: "database", isLoading: true };
  await render();
  await submit();
  expect(state.navigate).toHaveBeenLastCalledWith(
    "/services?platform=Telegram&category=Subscribers"
  );
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
