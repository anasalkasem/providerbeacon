// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  locale: "en",
  api: undefined as any,
  options: undefined as any,
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("embla-carousel-react", () => ({
  default: (options: any) => {
    state.options = options;
    return [() => {}, state.api];
  },
}));
vi.mock("@/lib/vipAnalytics", () => ({
  trackVipEvent: vi.fn(),
  useVipImpression: () => ({ current: null }),
}));
import { VipRibbon } from "../client/src/components/VipRibbon";
import type { VipCardData } from "../client/src/components/VipCard";
const cards: VipCardData[] = [1, 2, 3].map(id => ({
  providerId: id,
  revision: 1,
  name: `Provider ${id}`,
  slug: `provider-${id}`,
  coverUrl: `https://providerbeacon.com/api/imported-media/${id}`,
  tagline: "A reviewed provider introduction",
  specialties: ["Social media"],
  offer: "",
  offerEndsAt: null,
  ownershipVerified: true,
}));
let root: Root, container: HTMLDivElement;
let inView: IntersectionObserverCallback;
let mediaChange: () => void;
let media: {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
const listeners = new Map<string, () => void>();
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.locale = "en";
  state.options = undefined;
  listeners.clear();
  media = {
    matches: false,
    addEventListener: vi.fn((_, fn) => {
      mediaChange = fn;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media)
  );
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IntersectionObserverCallback) {
        inView = cb;
      }
      observe() {}
      disconnect() {}
    }
  );
  state.api = {
    scrollSnapList: vi.fn(() => [0, 0.5, 1]),
    selectedScrollSnap: vi.fn(() => 0),
    canScrollNext: vi.fn(() => true),
    canScrollPrev: vi.fn(() => true),
    scrollNext: vi.fn(),
    scrollPrev: vi.fn(),
    scrollTo: vi.fn(),
    on: vi.fn((event, fn) => {
      listeners.set(event, fn);
      return state.api;
    }),
    off: vi.fn(() => state.api),
  };
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
});
async function mount() {
  await act(() => root.render(React.createElement(VipRibbon, { cards })));
}
async function visible(value = true) {
  await act(() =>
    inView(
      [{ isIntersecting: value, intersectionRatio: value ? 1 : 0 }] as any,
      {} as any
    )
  );
}
async function time(ms = 5000) {
  await act(() => vi.advanceTimersByTime(ms));
}
const button = (label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
describe("VIP ribbon movement and accessible controls", () => {
  it("keeps one provider centered without clones, timers or carousel controls", async () => {
    await act(() =>
      root.render(React.createElement(VipRibbon, { cards: [cards[0]] }))
    );
    await time(20000);
    expect(container.querySelectorAll("article")).toHaveLength(1);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(state.api.scrollNext).not.toHaveBeenCalled();
    expect(
      container.querySelector('a[href="/providers/provider-1"]')
    ).not.toBeNull();
  });
  it("advances only on screen and pauses on hover and explicit request", async () => {
    await mount();
    await time();
    expect(state.api.scrollNext).not.toHaveBeenCalled();
    await visible();
    await time(4999);
    expect(state.api.scrollNext).not.toHaveBeenCalled();
    await time(1);
    expect(state.api.scrollNext).toHaveBeenCalledTimes(1);
    const ribbon = container.querySelector(
      '[aria-roledescription="Provider carousel"]'
    )!;
    await act(() =>
      ribbon.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }))
    );
    await time();
    expect(state.api.scrollNext).toHaveBeenCalledTimes(1);
    await act(() =>
      ribbon.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }))
    );
    await time();
    expect(state.api.scrollNext).toHaveBeenCalledTimes(2);
    await act(() => button("Pause movement").click());
    await time();
    expect(state.api.scrollNext).toHaveBeenCalledTimes(2);
    await act(() => button("Resume movement").click());
    await time();
    expect(state.api.scrollNext).toHaveBeenCalledTimes(3);
    await visible(false);
    await time();
    expect(state.api.scrollNext).toHaveBeenCalledTimes(3);
    expect(container.querySelectorAll("article")).toHaveLength(3);
  });
  it("stops on keyboard focus or dragging and supports RTL manual navigation", async () => {
    state.locale = "ar";
    await mount();
    await visible();
    expect(state.options.direction).toBe("rtl");
    const link = container.querySelector<HTMLAnchorElement>(
      'a[href="/providers/provider-1"]'
    )!;
    await act(() => link.focus());
    await time();
    expect(state.api.scrollNext).not.toHaveBeenCalled();
    await act(() =>
      link.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
      )
    );
    expect(state.api.scrollNext).toHaveBeenCalledTimes(1);
    await act(() =>
      link.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      )
    );
    expect(state.api.scrollPrev).toHaveBeenCalledTimes(1);
    await act(() => button("تشغيل الحركة").click());
    await act(() => listeners.get("pointerDown")!());
    await time();
    expect(state.api.scrollNext).toHaveBeenCalledTimes(1);
  });
  it("respects reduced motion and background tabs, including live preference changes", async () => {
    media.matches = true;
    await mount();
    await visible();
    await time(20000);
    expect(state.api.scrollNext).not.toHaveBeenCalled();
    expect(button("Pause movement")).toBeNull();
    await act(() => button("Next cards").click());
    expect(state.api.scrollNext).toHaveBeenCalledWith(true);
    media.matches = false;
    await act(() => mediaChange());
    await act(() => button("Resume movement").click());
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(() => document.dispatchEvent(new Event("visibilitychange")));
    await time();
    expect(state.api.scrollNext).toHaveBeenCalledTimes(1);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await act(() => document.dispatchEvent(new Event("visibilitychange")));
    await time();
    expect(state.api.scrollNext).toHaveBeenCalledTimes(2);
  });
  it("returns to the first position when too few cards can form a seamless loop", async () => {
    state.api.canScrollNext.mockReturnValue(false);
    await mount();
    await visible();
    await time();
    expect(state.api.scrollTo).toHaveBeenCalledWith(0, false);
    expect(container.querySelectorAll("article")).toHaveLength(3);
  });
});
