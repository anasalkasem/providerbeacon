// @vitest-environment jsdom
import React, { act, lazy } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useRoute, useSearch } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PageTransition,
  useDisplayedPagePath,
} from "../client/src/components/PageTransition";
import {
  MarketplaceDataProvider,
  useMarketplaceData,
} from "../client/src/contexts/MarketplaceDataContext";

const snapshot = vi.hoisted(() => vi.fn());
vi.mock("@/lib/trpc", () => ({
  trpc: {
    marketplace: {
      snapshot: {
        useQuery: (input: any, options: any) => {
          snapshot(input, options);
          return {
            data: options.enabled
              ? {
                  source: "database",
                  providers: [],
                  services: [],
                  pagination: { total: 0 },
                }
              : undefined,
            isLoading: false,
            isFetching: false,
            isError: false,
          };
        },
      },
    },
  },
}));

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  window.history.replaceState({}, "", "/");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  snapshot.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});
function Current() {
  return <p>Visible {useDisplayedPagePath("/")}</p>;
}

describe("Orbit page continuity", () => {
  it("keeps catalogue data on the displayed page until the AI search page is ready", async () => {
    let resolve!: (value: { default: () => React.ReactNode }) => void;
    const Next = lazy(
      () =>
        new Promise<{ default: () => React.ReactNode }>(done => {
          resolve = done;
        })
    );
    function Catalogue() {
      return <p>Home catalogue: {useMarketplaceData().source}</p>;
    }
    const render = (path: string) => (
      <PageTransition
        path={path}
        enabled
        label="Opening page"
        fallback={<p>Fallback</p>}
      >
        {shown => (
          <MarketplaceDataProvider>
            {shown === "/" ? <Catalogue /> : <Next />}
          </MarketplaceDataProvider>
        )}
      </PageTransition>
    );
    await act(async () => root.render(render("/")));
    expect(container.textContent).toContain("Home catalogue: database");
    await act(async () => {
      window.history.pushState({}, "", "/find?q=5000+TikTok+views");
      root.render(render("/find"));
    });
    expect(container.textContent).toContain("Home catalogue: database");
    expect(container.textContent).not.toContain("unavailable");
    // New query text must never be sent as a filter for the outgoing home page.
    expect(
      snapshot.mock.calls.some(([input, options]) => input.q && options.enabled)
    ).toBe(false);
    await act(async () =>
      resolve({ default: () => <p>Search {useSearch()}</p> })
    );
    expect(container.textContent).toBe("Search q=5000+TikTok+views");
  });
  it("retains route parameters in a provider page while a different page loads", async () => {
    let resolve!: (value: { default: () => React.ReactNode }) => void;
    const Next = lazy(
      () =>
        new Promise<{ default: () => React.ReactNode }>(done => {
          resolve = done;
        })
    );
    function Provider() {
      const [, params] = useRoute("/providers/:slug");
      return (
        <p>
          Provider {params?.slug ?? "missing"} {useSearch()}
        </p>
      );
    }
    const render = (path: string) => (
      <PageTransition
        path={path}
        enabled
        label="Opening page"
        fallback={<p>Fallback</p>}
      >
        {shown => (shown.startsWith("/providers/") ? <Provider /> : <Next />)}
      </PageTransition>
    );
    window.history.replaceState({}, "", "/providers/example?q=retained");
    await act(async () => root.render(render("/providers/example")));
    await act(async () => {
      window.history.pushState({}, "", "/services?q=new-query");
      root.render(render("/services"));
    });
    expect(container.textContent).toContain("Provider example");
    expect(container.textContent).toContain("q=retained");
    expect(container.textContent).not.toContain("new-query");
    expect(container.textContent).not.toContain("missing");
    await act(async () => resolve({ default: () => <p>Services</p> }));
    expect(container.textContent).toBe("Services");
  });
  it("retains the current page and its displayed path until an uncached route is ready", async () => {
    let resolve!: (value: { default: () => React.ReactNode }) => void;
    const Next = lazy(
      () =>
        new Promise<{ default: () => React.ReactNode }>(done => {
          resolve = done;
        })
    );
    const render = (path: string) => (
      <PageTransition
        path={path}
        enabled
        label="Opening page"
        fallback={<p>Full-page fallback</p>}
      >
        {shown => (shown === "/" ? <Current /> : <Next />)}
      </PageTransition>
    );
    await act(async () => root.render(render("/")));
    await act(async () => root.render(render("/services")));
    expect(container.textContent).toContain("Visible /");
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Opening page"
    );
    expect(container.textContent).not.toContain("Full-page fallback");
    expect(window.scrollTo).not.toHaveBeenCalled();
    await act(async () =>
      resolve({ default: () => <p>Services {useDisplayedPagePath("/")}</p> })
    );
    expect(container.textContent).toBe("Services /services");
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "instant",
    });
  });
  it("does not reset browser history scrolling or hash destinations", async () => {
    const render = (path: string) => (
      <PageTransition path={path} enabled label="Opening page" fallback={null}>
        {() => <Current />}
      </PageTransition>
    );
    await act(async () => root.render(render("/")));
    await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
    await act(async () => root.render(render("/services")));
    expect(window.scrollTo).not.toHaveBeenCalled();
    window.history.replaceState({}, "", "/providers#join");
    await act(async () => root.render(render("/providers")));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
