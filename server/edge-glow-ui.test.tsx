// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantEdgeGlow } from "../client/src/components/EdgeGlow";

let root: Root, container: HTMLDivElement;
const baseline = { enabled: true, open: false, pending: false, replyId: 0 };
let props = { ...baseline };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  sessionStorage.clear();
  props = { ...baseline };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});
const render = (changes = {}) =>
  act(async () => {
    props = { ...props, ...changes };
    root.render(<AssistantEdgeGlow {...props} />);
  });
const phase = () =>
  container.querySelector(".beacon-edge-glow")?.getAttribute("data-phase");
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("edge glow tied to assistant activity", () => {
  it("welcomes once per browser session, expires and has no focusable content", async () => {
    await render();
    expect(phase()).toBe("welcome");
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe(
      "true"
    );
    expect(container.querySelector("button, a, input, [tabindex]")).toBeNull();
    await tick(3200);
    expect(phase()).toBeUndefined();
    await act(() => root.render(null));
    await render();
    expect(phase()).toBeUndefined();
  });
  it("follows opening, a long request and a successful reply without stopping mid-request", async () => {
    await render({ open: true });
    expect(phase()).toBe("opening");
    await render({ pending: true });
    await tick(20000);
    expect(phase()).toBe("thinking");
    // The response may render before React Query clears isPending.
    await render({ replyId: 2 });
    expect(phase()).toBe("thinking");
    await render({ pending: false });
    expect(phase()).toBe("reply");
    await tick(1800);
    expect(phase()).toBeUndefined();
  });
  it("fades after an error and never displays a success pulse for it", async () => {
    await render({ open: true, pending: true });
    await render({ pending: false });
    expect(phase()).toBe("leaving");
    await tick(450);
    expect(phase()).toBeUndefined();
  });
  it("obeys a disabled setting immediately, even during a request, and clears timers", async () => {
    await render({ enabled: false });
    expect(phase()).toBeUndefined();
    expect(sessionStorage.getItem("beacon-edge-welcome")).toBeNull();
    await render({ enabled: true, open: true, pending: true });
    expect(phase()).toBe("thinking");
    await render({ enabled: false });
    expect(phase()).toBeUndefined();
    await render({ pending: false, replyId: 2 });
    await tick(20000);
    expect(phase()).toBeUndefined();
  });
  it("stays quiet if a closed assistant finishes a request", async () => {
    await render({ open: true, pending: true });
    await render({ open: false });
    await tick(450);
    await render({ pending: false, replyId: 2 });
    expect(phase()).toBeUndefined();
    await render({ open: true });
    expect(phase()).toBe("opening");
  });
});
