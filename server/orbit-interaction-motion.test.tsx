// @vitest-environment jsdom
import React, { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePanelPresence } from "../client/src/hooks/usePanelPresence";
import { usePageEntrance } from "../client/src/hooks/usePageEntrance";

let container: HTMLDivElement, root: Root;
let media: EventTarget & { matches: boolean };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  media = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal("matchMedia", () => media);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function Panel({
  open,
  animated = true,
}: {
  open: boolean;
  animated?: boolean;
}) {
  const present = usePanelPresence(open, animated);
  return present ? (
    <section inert={!open} aria-hidden={!open}>
      Panel
    </section>
  ) : null;
}
function Page({ path, enabled = true }: { path: string; enabled?: boolean }) {
  const main = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState("");
  usePageEntrance(main, path, enabled);
  return (
    <main ref={main}>
      <button onClick={() => setDraft("retained")}>{draft || "draft"}</button>
    </main>
  );
}
describe("Orbit interaction motion", () => {
  it("makes the closing panel inert and removes it, without a stale timer closing a reopened panel", async () => {
    await act(async () => root.render(<Panel open />));
    await act(async () => root.render(<Panel open={false} />));
    expect(container.querySelector("section")?.hasAttribute("inert")).toBe(
      true
    );
    await act(async () => vi.advanceTimersByTime(80));
    await act(async () => root.render(<Panel open />));
    await act(async () => vi.advanceTimersByTime(200));
    expect(container.querySelector("section")?.hasAttribute("inert")).toBe(
      false
    );
    await act(async () => root.render(<Panel open={false} />));
    await act(async () => vi.advanceTimersByTime(160));
    expect(container.querySelector("section")).toBeNull();
  });
  it("dismisses immediately with reduced motion or the Classic theme", async () => {
    media.matches = true;
    await act(async () => root.render(<Panel open />));
    await act(async () => root.render(<Panel open={false} />));
    expect(container.querySelector("section")).toBeNull();
    media.matches = false;
    await act(async () => root.render(<Panel open animated={false} />));
    await act(async () => root.render(<Panel open={false} animated={false} />));
    expect(container.querySelector("section")).toBeNull();
  });
  it("animates navigation without remounting page state and cancels when motion preferences change", async () => {
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ cancel }));
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    await act(async () => root.render(<Page path="/providers/one" />));
    await act(async () => container.querySelector("button")!.click());
    const element = container.querySelector("main");
    await act(async () => root.render(<Page path="/providers/two" />));
    expect(container.querySelector("main")).toBe(element);
    expect(container.textContent).toBe("retained");
    expect(animate).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledTimes(1);
    media.matches = true;
    media.dispatchEvent(new Event("change"));
    expect(cancel).toHaveBeenCalledTimes(2);
    await act(async () => root.render(<Page path="/providers/three" />));
    expect(animate).toHaveBeenCalledTimes(2);
    delete (HTMLElement.prototype as any).animate;
  });
  it("keeps navigation functional without the animation API and leaves Classic still", async () => {
    await act(async () => root.render(<Page path="/services" />));
    expect(container.querySelector("main")).not.toBeNull();
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    await act(async () =>
      root.render(<Page path="/compare" enabled={false} />)
    );
    expect(animate).not.toHaveBeenCalled();
    delete (HTMLElement.prototype as any).animate;
  });
});
