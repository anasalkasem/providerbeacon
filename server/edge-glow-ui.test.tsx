// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  data: { edgeGlowEnabled: true } as { edgeGlowEnabled: boolean } | undefined,
  error: false,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    appearance: {
      public: {
        useQuery: () => ({ data: state.data, isError: state.error }),
      },
    },
  },
}));
import { SiteAppearanceProvider } from "../client/src/contexts/SiteAppearanceContext";

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  state.data = { edgeGlowEnabled: true };
  state.error = false;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});
const render = (page = "home") =>
  act(async () => {
    root.render(
      <SiteAppearanceProvider>
        <main key={page}>
          <article className="vip-card">
            <a href="/providers/example">{page}</a>
          </article>
        </main>
      </SiteAppearanceProvider>
    );
  });
const glow = () => container.querySelector(".beacon-edge-glow");
const scope = () => container.querySelector("[data-beacon-glow]");

describe("continuous site and VIP illumination", () => {
  it("stays mounted across time, page changes and a failed background refresh", async () => {
    await render();
    const original = glow();
    expect(original?.getAttribute("aria-hidden")).toBe("true");
    expect(original?.querySelector("button, a, input, [tabindex]")).toBeNull();
    expect(scope()?.getAttribute("data-beacon-glow")).toBe("on");
    expect(scope()?.querySelector(".vip-card")).not.toBeNull();
    await act(() => vi.advanceTimersByTime(120_000));
    expect(glow()).toBe(original);
    state.error = true;
    await render("vip");
    expect(glow()).toBe(original);
    expect(scope()?.getAttribute("data-beacon-glow")).toBe("on");
    expect(container.querySelector("main")?.textContent).toBe("vip");
  });

  it("removes the frame and VIP illumination together when the owner disables it", async () => {
    await render();
    state.data = { edgeGlowEnabled: false };
    await render();
    expect(glow()).toBeNull();
    expect(scope()?.getAttribute("data-beacon-glow")).toBe("off");
    expect(container.querySelector(".vip-card a")).not.toBeNull();
    await act(() => vi.advanceTimersByTime(120_000));
    expect(glow()).toBeNull();
    state.data = { edgeGlowEnabled: true };
    await render();
    expect(glow()).not.toBeNull();
    expect(scope()?.getAttribute("data-beacon-glow")).toBe("on");
  });

  it("does not guess the setting during initial loading or a failed initial request", async () => {
    state.data = undefined;
    await render();
    expect(glow()).toBeNull();
    expect(scope()?.getAttribute("data-beacon-glow")).toBe("off");
    state.error = true;
    await render();
    expect(glow()).toBeNull();
  });
});
