// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogueIndex } from "../client/src/lib/catalogue";
import { providers, services } from "./testFixtures";

const state = vi.hoisted(() => ({
  locale: "ar",
  data: null as any,
  retry: vi.fn(),
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("@/contexts/MarketplaceDataContext", () => ({
  useMarketplaceData: () => state.data,
}));
import Component from "../client/src/components/ui/saa-s-template";

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState(null, "", "/?previewTheme=studio");
  state.locale = "ar";
  state.retry.mockReset();
  state.data = {
    ...catalogueIndex(providers, services.slice(0, 3)),
    isLoading: false,
    source: "database",
    retry: state.retry,
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
});
const mount = () => act(async () => root.render(<Component />));

describe("Studio's functional product surface", () => {
  it("submits the visitor's Arabic request without losing punctuation or quantity", async () => {
    await mount();
    const query = "٥٠٠٠ مشاهدة تيكتوك + تعويض؟";
    await act(() => {
      const input = host.querySelector<HTMLInputElement>(
        'input[type="search"]'
      )!;
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )!.set!.call(input, query);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(() =>
      host
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(window.location.pathname).toBe("/find");
    expect(new URLSearchParams(window.location.search).get("q")).toBe(query);
  });
  it("routes the primary action to the real finder and displays live catalogue content", async () => {
    await mount();
    expect(host.querySelector("h1")!.textContent).toContain("مزوّدك القادم");
    expect(host.querySelectorAll("table")).toHaveLength(1);
    expect(host.querySelector('a[href="/install"]')).not.toBeNull();
    expect(host.querySelector('a[href="#how-it-works"]')).not.toBeNull();
    await act(() =>
      host
        .querySelector<HTMLAnchorElement>('.studio-actions a[href="/find"]')!
        .click()
    );
    expect(window.location.pathname).toBe("/find");
  });
  it("keeps unavailable data honest and exposes the existing retry action", async () => {
    state.locale = "en";
    state.data.source = "unavailable";
    await mount();
    expect(host.querySelector("table")).toBeNull();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await act(() =>
      host
        .querySelector<HTMLButtonElement>(".landing-comparison button")!
        .click()
    );
    expect(state.retry).toHaveBeenCalledOnce();
  });
});
