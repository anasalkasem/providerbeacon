// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ locale: "en" }));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("@/lib/vipAnalytics", () => ({
  trackVipEvent: vi.fn(),
  useVipImpression: () => ({ current: null }),
}));
import { VipRibbon } from "../client/src/components/VipRibbon";
import type { VipCardData } from "../client/src/components/VipCard";
import { VIP_RIBBON_SPEED } from "../client/src/lib/vipRibbonMotion";
const cards: VipCardData[] = Array.from({ length: 8 }, (_, index) => ({
  providerId: index + 1,
  revision: 1,
  name: `Provider ${index + 1}`,
  slug: `provider-${index + 1}`,
  coverUrl: `/api/imported-media/${index + 1}`,
  tagline: "A reviewed provider introduction",
  specialties: ["Social media"],
  offer: "",
  offerEndsAt: null,
  ownershipVerified: true,
}));
let root: Root, container: HTMLDivElement;
let inView: IntersectionObserverCallback;
let resize: () => void;
let mediaChange: () => void;
let media: {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
let viewportWidth: number, cardWidth: number, clock: number;
// jsdom has no compositor. Model the standard linear Web Animations timeline
// from the actual keyframes the component submits, independently of JS timers.
const animations = new Map<Element, TestAnimation>();
class TestAnimation {
  private heldTime = 0;
  private startedAt = clock;
  playState = "running";
  constructor(
    readonly element: Element,
    readonly keyframes: Keyframe[],
    readonly options: KeyframeAnimationOptions
  ) {}
  get currentTime() {
    return (
      this.heldTime +
      (this.playState === "running" ? clock - this.startedAt : 0)
    );
  }
  set currentTime(value: number) {
    this.heldTime = value;
    this.startedAt = clock;
  }
  pause() {
    this.heldTime = this.currentTime;
    this.playState = "paused";
  }
  play() {
    if (this.playState === "running") return;
    this.startedAt = clock;
    this.playState = "running";
  }
  cancel() {
    this.playState = "idle";
    animations.delete(this.element);
  }
  position() {
    const number = (value: unknown) =>
      Number(String(value).match(/translate3d\(([-\d.e+]+)px/)?.[1] ?? 0);
    const from = number(this.keyframes[0].transform);
    const to = number(this.keyframes[1].transform);
    const duration = Number(this.options.duration);
    return from + (to - from) * ((this.currentTime % duration) / duration);
  }
}
const slides = () =>
  Array.from(container.querySelectorAll<HTMLElement>(".vip-ribbon-slide"));
// Read compositor output when present; manual fallback uses inline transforms.
const positions = () =>
  slides().map(
    (slide, index) =>
      index * (cardWidth + 20) +
      (state.locale === "ar" ? -1 : 1) *
        (animations.get(slide)?.position() ??
          Number(
            slide.style.transform.match(/translate3d\(([-\d.e+]+)px/)?.[1] ?? 0
          ))
  );
function frame(elapsed = 20) {
  clock += elapsed;
}
async function time(count = 50) {
  await act(() => {
    for (let index = 0; index < count; index++) frame();
  });
}
const button = (label: string) =>
  container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
async function visible(value = true) {
  await act(() =>
    inView(
      [{ isIntersecting: value, intersectionRatio: value ? 1 : 0 }] as any,
      {} as any
    )
  );
}
async function mount(count = 4) {
  cardWidth = Math.max(
    viewportWidth * (viewportWidth < 640 ? 0.86 : 0.32),
    viewportWidth / (count - 1)
  );
  await act(() =>
    root.render(
      React.createElement(VipRibbon, { cards: cards.slice(0, count) })
    )
  );
}
function pointer(target: Element, type: string, x: number) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    button: 0,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  target.dispatchEvent(event);
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.locale = "en";
  viewportWidth = 960;
  clock = 0;
  animations.clear();
  media = {
    matches: false,
    addEventListener: vi.fn((_, callback) => {
      mediaChange = callback;
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
      constructor(callback: IntersectionObserverCallback) {
        inView = callback;
      }
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: function (
      this: HTMLElement,
      keyframes: Keyframe[],
      options: KeyframeAnimationOptions
    ) {
      const animation = new TestAnimation(this, keyframes, options);
      animations.set(this, animation);
      return animation;
    },
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        width: this.classList.contains("vip-ribbon-slide")
          ? cardWidth
          : viewportWidth,
      } as DOMRect;
    }
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    () => viewportWidth
  );
  const computed = window.getComputedStyle;
  vi.stubGlobal("getComputedStyle", (element: Element) =>
    element.classList.contains("vip-ribbon-track")
      ? { columnGap: "20px" }
      : computed(element)
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  expect(animations.size).toBe(0);
  delete (HTMLElement.prototype as any).animate;
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("continuous VIP ribbon", () => {
  it("keeps one real card centered without animation or duplicate links", async () => {
    await mount(1);
    await time();
    expect(container.querySelectorAll("article")).toHaveLength(1);
    const links = Array.from(container.querySelectorAll("a"));
    expect(links).toHaveLength(2);
    expect(new Set(links.map(link => link.getAttribute("href"))).size).toBe(2);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(animations.size).toBe(0);
  });
  it.each([
    [2, "en", 520],
    [2, "ar", 360],
    [3, "en", 960],
    [3, "ar", 360],
    [4, "en", 960],
    [4, "ar", 960],
    [8, "en", 360],
    [8, "ar", 960],
  ])(
    "moves %i cards in %s at width %i continuously through two complete cycles",
    async (count, locale, width) => {
      state.locale = locale as string;
      viewportWidth = width as number;
      await mount(count as number);
      await visible();
      await time(1);
      const step = VIP_RIBBON_SPEED * 0.02;
      const cycle = (cardWidth + 20) * (count as number);
      let previous = positions();
      let recycled = 0;
      await act(() => {
        for (let tick = 0; tick < Math.ceil((cycle * 2) / step); tick++) {
          frame();
          const current = positions();
          current.forEach((position, index) => {
            const movement = position - previous[index];
            if (movement > 0) {
              // Wrapping is allowed only entirely outside both viewport edges.
              expect(previous[index] + cardWidth).toBeLessThanOrEqual(0.00001);
              expect(position).toBeGreaterThanOrEqual(viewportWidth - 0.00001);
              expect(movement).toBeCloseTo(cycle - step, 5);
              recycled++;
            } else expect(movement).toBeCloseTo(-step, 5);
          });
          const visibleCards = current
            .filter(
              position => position < viewportWidth && position + cardWidth > 0
            )
            .sort((a, b) => a - b);
          expect(visibleCards[0]).toBeLessThanOrEqual(20.00001);
          expect(visibleCards.at(-1)! + cardWidth).toBeGreaterThanOrEqual(
            viewportWidth - 20.00001
          );
          for (let index = 1; index < visibleCards.length; index++)
            expect(
              visibleCards[index] - visibleCards[index - 1] - cardWidth
            ).toBeCloseTo(20, 5);
          previous = current;
        }
      });
      expect(recycled).toBeGreaterThanOrEqual((count as number) * 2);
      expect(container.querySelectorAll("article")).toHaveLength(
        count as number
      );
      const links = Array.from(container.querySelectorAll("a"));
      expect(links).toHaveLength((count as number) * 2);
      expect(new Set(links.map(link => link.getAttribute("href"))).size).toBe(
        (count as number) * 2
      );
    }
  );
  it("pauses offscreen, on hover and by request, then resumes from the same position", async () => {
    await mount();
    const start = positions();
    await time();
    expect(positions()).toEqual(start);
    await visible();
    await time();
    const moving = positions();
    expect(moving).not.toEqual(start);
    const ribbon = container.querySelector(".vip-ribbon")!;
    await act(() => pointer(ribbon, "pointerover", 10));
    await time();
    expect(positions()).toEqual(moving);
    await act(() => pointer(ribbon, "pointerout", 10));
    await time(2);
    expect(positions()[0]).toBeCloseTo(moving[0] - 1.68);
    await act(() => button("Pause movement").click());
    const paused = positions();
    await time();
    expect(positions()).toEqual(paused);
    await act(() => button("Resume movement").click());
    await time(2);
    expect(positions()[0]).toBeCloseTo(paused[0] - 1.68);
    await visible(false);
    const offscreen = positions();
    await time();
    expect(positions()).toEqual(offscreen);
  });
  it("stops for keyboard focus, reveals the focused original card and supports RTL arrows", async () => {
    state.locale = "ar";
    await mount();
    await visible();
    const last = container.querySelector<HTMLAnchorElement>(
      'a[href="/providers/provider-4"]'
    )!;
    await act(() => last.focus());
    expect(positions()[3]).toBeCloseTo(0);
    const focused = positions();
    await time();
    expect(positions()).toEqual(focused);
    await act(() =>
      last.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
      )
    );
    expect(positions()[0]).toBeCloseTo(0);
    await act(() =>
      last.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      )
    );
    expect(positions()[3]).toBeCloseTo(0);
  });
  it("respects reduced motion and background tabs without catch-up jumps", async () => {
    media.matches = true;
    await mount();
    await visible();
    const start = positions();
    await time();
    expect(positions()).toEqual(start);
    expect(button("Pause movement")).toBeNull();
    await act(() => button("Next cards").click());
    expect(positions()[1]).toBeCloseTo(0);
    media.matches = false;
    await act(() => mediaChange());
    await act(() => button("Resume movement").click());
    await time();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(() => document.dispatchEvent(new Event("visibilitychange")));
    const hidden = positions();
    await time(5000);
    expect(positions()).toEqual(hidden);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await act(() => document.dispatchEvent(new Event("visibilitychange")));
    await time(2);
    expect(positions()[1]).toBeCloseTo(hidden[1] - 1.68);
    media.matches = true;
    await act(() => mediaChange());
    const reduced = positions();
    await time();
    expect(positions()).toEqual(reduced);
  });
  it("retains progress on resize", async () => {
    await mount();
    await visible();
    await time(100);
    const progress = -positions()[0] / (cardWidth + 20);
    viewportWidth = 360;
    cardWidth = 360 * 0.86;
    await act(() => resize());
    expect(-positions()[0] / (cardWidth + 20)).toBeCloseTo(progress);
  });
  it("keeps moving without per-frame JS or style writes when JS timers are delayed", async () => {
    await mount();
    await visible();
    const initial = positions();
    const styles = slides().map(slide => slide.style.cssText);
    // Advance the compositor clock without running any scheduled JS callback.
    clock += 1200;
    positions().forEach((position, index) => {
      expect(position).toBeCloseTo(initial[index] - VIP_RIBBON_SPEED * 1.2);
    });
    expect(slides().map(slide => slide.style.cssText)).toEqual(styles);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    for (const animation of animations.values()) {
      expect(animation.options.easing).toBe("linear");
      expect(animation.options.iterations).toBe(Infinity);
      expect(
        animation.keyframes.every(
          keyframe => Object.keys(keyframe).join() === "transform"
        )
      ).toBe(true);
    }
  });
  it("keeps manual navigation usable without Web Animations support", async () => {
    delete (HTMLElement.prototype as any).animate;
    await mount();
    await visible();
    await act(() => button("Next cards").click());
    expect(positions()[1]).toBeCloseTo(0);
    expect(animations.size).toBe(0);
  });
  it("allows touch dragging without opening the card and leaves autoplay paused", async () => {
    await mount();
    await visible();
    const viewport = container.querySelector<HTMLElement>(
      ".vip-ribbon-viewport"
    )!;
    viewport.setPointerCapture = vi.fn();
    await act(() => pointer(viewport, "pointerdown", 200));
    await act(() => pointer(viewport, "pointermove", 100));
    expect(positions()[0]).toBeCloseTo(-100);
    await act(() => pointer(viewport, "pointerup", 100));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(() => container.querySelector("a")!.dispatchEvent(click));
    expect(click.defaultPrevented).toBe(true);
    await time();
    expect(positions()[0]).toBeCloseTo(-100);
    expect(button("Resume movement")).not.toBeNull();
  });
});
