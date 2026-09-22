// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { providers } from "./testFixtures";

vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: "en" }),
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
import { ProviderLogoStrip } from "../client/src/components/ProviderLogoStrip";

let host: HTMLDivElement, root: Root;
let width: number, itemWidth: number, reduced: boolean, frameId: number;
const frames = new Map<number, FrameRequestCallback>();
const cards = Array.from({ length: 4 }, (_, index) => ({
  ...providers[0],
  id: `provider-${index + 1}`,
  slug: `provider-${index + 1}`,
  name: `Provider ${index + 1}`,
  logoUrl: null,
}));
const strip = () => host.querySelector<HTMLDivElement>(".home-logo-strip")!;
async function frame(now: number) {
  await act(async () => {
    const pending = Array.from(frames.values());
    frames.clear();
    pending.forEach(callback => callback(now));
  });
}
async function toggle() {
  await act(async () => host.querySelectorAll("button")[1].click());
}
beforeEach(() => {
  width = 1216;
  itemWidth = 144;
  reduced = false;
  frameId = 0;
  frames.clear();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.stubGlobal("matchMedia", () => ({
    matches: reduced,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("getComputedStyle", () => ({ columnGap: "12px" }));
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function () {
      return width;
    }
  );
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const size =
        this.tagName === "LI"
          ? itemWidth
          : this.children.length * (itemWidth + 12);
      return {
        x: 0,
        y: 0,
        width: size,
        height: 64,
        top: 0,
        left: 0,
        right: size,
        bottom: 64,
        toJSON() {},
      };
    }
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  expect(frames.size).toBe(0);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps four providers moving on a wide screen, fills the loop and wraps without a gap", async () => {
  await act(async () => root.render(<ProviderLogoStrip providers={cards} />));
  expect(
    strip().querySelector("ul")!.getBoundingClientRect().width
  ).toBeGreaterThanOrEqual(width);
  expect(
    Array.from(strip().querySelectorAll("a")).filter(
      link => link.tabIndex === 0
    )
  ).toHaveLength(4);
  await frame(0);
  await frame(100);
  await frame(200);
  expect(strip().scrollLeft).toBeCloseTo(6.4);
  await toggle();
  expect(frames.size).toBe(0);
  strip().scrollLeft =
    strip().querySelector("ul")!.getBoundingClientRect().width - 1;
  await toggle();
  await frame(300);
  await frame(400);
  expect(strip().scrollLeft).toBeCloseTo(2.2);
  expect(strip().querySelector("a")!.getAttribute("href")).toBe(
    "/providers/provider-1"
  );

  width = 360;
  itemWidth = 120;
  await act(async () => window.dispatchEvent(new Event("resize")));
  expect(strip().querySelector("ul")!.getBoundingClientRect().width).toBe(528);
  const previous = strip().scrollLeft;
  await frame(500);
  await frame(600);
  expect(strip().scrollLeft).toBeGreaterThan(previous);
});

it("respects reduced motion and shows each provider once for manual browsing", async () => {
  reduced = true;
  await act(async () => root.render(<ProviderLogoStrip providers={cards} />));
  expect(strip().querySelectorAll("a")).toHaveLength(4);
  expect(host.querySelectorAll("button")).toHaveLength(0);
  expect(frames.size).toBe(0);
  await frame(0);
  await frame(100);
  expect(strip().scrollLeft).toBe(0);
  width = 360;
  itemWidth = 120;
  await act(async () => window.dispatchEvent(new Event("resize")));
  expect(host.querySelectorAll("button")).toHaveLength(2);
});

it("keeps autoplay paused after a touch swipe so native momentum is not overwritten", async () => {
  await act(async () => root.render(<ProviderLogoStrip providers={cards} />));
  await frame(0);
  await frame(100);
  const touch = new Event("pointerdown", { bubbles: true });
  Object.defineProperty(touch, "pointerType", { value: "touch" });
  await act(async () => strip().dispatchEvent(touch));
  await act(async () =>
    strip().dispatchEvent(new Event("pointercancel", { bubbles: true }))
  );
  await act(async () =>
    strip().dispatchEvent(new Event("pointerup", { bubbles: true }))
  );
  strip().scrollLeft = 160;
  await frame(200);
  await frame(300);
  expect(frames.size).toBe(0);
  expect(strip().scrollLeft).toBe(160);
  await toggle();
  await frame(400);
  await frame(500);
  expect(strip().scrollLeft).toBeGreaterThan(160);
});
