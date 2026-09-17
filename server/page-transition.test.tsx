// @vitest-environment jsdom
import React, { act, lazy } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PageTransition,
  useDisplayedPagePath,
} from "../client/src/components/PageTransition";

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  window.history.replaceState({}, "", "/");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
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
