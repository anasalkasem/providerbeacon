// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  data: undefined as any,
  error: false,
  input: undefined as any,
  locale: "ar",
  submit: vi.fn(),
  withdraw: vi.fn(),
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      business: {
        vip: { mine: { invalidate: vi.fn() }, list: { invalidate: vi.fn() } },
      },
    }),
    business: {
      vip: {
        list: {
          useQuery: (input: any) => {
            state.input = input;
            return { data: state.data, isError: state.error, refetch: vi.fn() };
          },
        },
        submit: {
          useMutation: () => ({ mutate: state.submit, isPending: false }),
        },
        withdraw: {
          useMutation: () => ({ mutate: state.withdraw, isPending: false }),
        },
      },
    },
  },
}));
import {
  VipAlbum,
  VipCard,
  type VipCardData,
} from "../client/src/components/VipAlbum";
import { VipEditor } from "../client/src/components/ProviderVip";
import { trackVipEvent } from "../client/src/lib/vipAnalytics";
let root: Root,
  container: HTMLDivElement,
  observers: IntersectionObserverCallback[];
const now = Date.parse("2026-09-16T12:00:00Z");
const card = (): VipCardData & { endsAt: Date } => ({
  providerId: 7,
  revision: 2,
  name: "Actual provider",
  slug: "actual",
  logoUrl: null,
  coverUrl: "https://providerbeacon.com/api/imported-media/cover",
  tagline: "A provider with clear service information",
  specialties: ["Telegram"],
  offer: "Limited offer",
  offerEndsAt: new Date(now + 86400000),
  ownershipVerified: true,
  endsAt: new Date(now + 86400000),
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  observers = [];
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 204 }))
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IntersectionObserverCallback) {
        observers.push(cb);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
  );
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  Object.defineProperty(navigator, "webdriver", {
    configurable: true,
    get: () => false,
  });
  Object.defineProperty(navigator, "doNotTrack", {
    configurable: true,
    get: () => null,
  });
  localStorage.clear();
  state.error = false;
  state.locale = "ar";
  state.data = { items: [card()], total: 1, page: 1, pages: 1, rotation: 20 };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("VIP visitor album and provider preview", () => {
  it.each([true, false])(
    "provides a separate ratings link on public VIP cards (compact: %s)",
    async compact => {
      await act(() =>
        root.render(React.createElement(VipCard, { card: card(), compact }))
      );
      const ratings = container.querySelector(
        'a[href="/providers/actual#visitor-ratings"]'
      );
      expect(ratings?.textContent).toContain("قيّم المزود");
      expect(ratings?.parentElement?.closest("a")).toBeNull();
      await act(() =>
        root.render(
          React.createElement(VipCard, { card: card(), compact, preview: true })
        )
      );
      expect(
        container.querySelector('a[href="/providers/actual#visitor-ratings"]')
      ).toBeNull();
    }
  );
  it("labels paid placement and ownership separately and links to the local provider profile", async () => {
    await act(() => root.render(React.createElement(VipAlbum)));
    expect(container.textContent).toContain("ظهور مدفوع");
    expect(container.textContent).toContain("ملكية موثّقة");
    expect(
      container.querySelector('a[href="/providers/actual"]')
    ).not.toBeNull();
    expect(container.querySelector('a[href="/vip"]')).not.toBeNull();
    expect(container.querySelectorAll("article")).toHaveLength(1);
  });
  it("does not expose expired cards, expired offers or cached cards after a failed refresh", async () => {
    state.data.items = [
      { ...card(), offerEndsAt: new Date(now - 1) },
      { ...card(), providerId: 9, endsAt: new Date(now - 1) },
    ];
    await act(() => root.render(React.createElement(VipAlbum)));
    expect(container.querySelectorAll("article")).toHaveLength(1);
    expect(container.textContent).not.toContain("Limited offer");
    state.error = true;
    await act(() => root.render(React.createElement(VipAlbum)));
    expect(container.querySelectorAll("article")).toHaveLength(0);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
  it("measures only cards visible for a full second and counts once", async () => {
    await act(() =>
      root.render(React.createElement(VipCard, { card: card() }))
    );
    observers[0](
      [{ isIntersecting: true, intersectionRatio: 0.49 }] as any,
      {} as any
    );
    await act(() => vi.advanceTimersByTime(2000));
    expect(fetch).not.toHaveBeenCalled();
    observers[0](
      [{ isIntersecting: true, intersectionRatio: 0.75 }] as any,
      {} as any
    );
    await act(() => vi.advanceTimersByTime(999));
    expect(fetch).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTime(1));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse((vi.mocked(fetch).mock.calls[0][1] as any).body)
    ).toMatchObject({ providerId: 7, revision: 2, kind: "impression" });
    await act(() => vi.advanceTimersByTime(10000));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("cancels the visibility timer when the tab is hidden", async () => {
    await act(() =>
      root.render(React.createElement(VipCard, { card: card() }))
    );
    observers[0](
      [{ isIntersecting: true, intersectionRatio: 1 }] as any,
      {} as any
    );
    await act(() => vi.advanceTimersByTime(500));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await act(() => vi.advanceTimersByTime(1500));
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps previews and privacy-opted-out browsers out of measurements", async () => {
    await act(() =>
      root.render(React.createElement(VipCard, { card: card(), preview: true }))
    );
    expect(observers).toHaveLength(0);
    expect(container.querySelector('a[href="/providers/actual"]')).toBeNull();
    Object.defineProperty(navigator, "doNotTrack", {
      configurable: true,
      get: () => "1",
    });
    trackVipEvent(7, 2, "click");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("offers a real submission route when no reviewed cards are available", async () => {
    state.data.items = [];
    state.data.total = 0;
    await act(() => root.render(React.createElement(VipAlbum)));
    expect(container.querySelectorAll("article")).toHaveLength(0);
    expect(
      container.querySelector('a[href="/account/provider?tab=vip"]')
    ).not.toBeNull();
  });
  it("preserves the rotation between pages", async () => {
    state.locale = "en";
    state.data.pages = 2;
    state.data.total = 9;
    await act(() => root.render(React.createElement(VipAlbum, { full: true })));
    const next = Array.from(container.querySelectorAll("button")).find(
      x => x.textContent === "Next cards"
    )!;
    await act(() => next.click());
    expect(state.input).toMatchObject({ page: 2, rotation: 20 });
  });
  it("locks expired members out of submission while retaining the withdrawal action", async () => {
    state.locale = "en";
    const saved = {
      ...card(),
      coverId: "a".repeat(64),
      ownerMemberId: 1,
      websiteHost: "provider.example",
      status: "approved",
      reviewNote: null,
      reviewedAt: new Date(now),
      createdAt: new Date(now),
      updatedAt: new Date(now),
    } as any;
    const owned = {
      provider: {
        id: 7,
        name: "Actual provider",
        slug: "actual",
        logoUrl: null,
      },
      ownershipValid: true,
    } as any;
    await act(() =>
      root.render(
        React.createElement(VipEditor, { card: saved, owned, active: false })
      )
    );
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(
      buttons.find(x => x.textContent === "Submit for review")?.disabled
    ).toBe(true);
    expect(buttons.find(x => x.textContent === "Hide my card")?.disabled).toBe(
      false
    );
    expect(observers).toHaveLength(0);
  });
});
