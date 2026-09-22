// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteThemeId } from "../shared/siteThemes";

const state = vi.hoisted(() => ({
  locale: "ar",
  appearance: { theme: "daylight", edgeGlowEnabled: false } as
    | { theme: SiteThemeId; edgeGlowEnabled: boolean }
    | undefined,
}));
vi.mock("@/contexts/LocaleContext", async original => ({
  ...(await original<any>()),
  useLocale: () => ({ locale: state.locale, setLocale: vi.fn() }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    appearance: { public: { useQuery: () => ({ data: state.appearance }) } },
    auth: { me: { useQuery: () => ({ data: null }) } },
    member: { me: { useQuery: () => ({ data: { member: null } }) } },
  },
}));
import { SiteAppearanceProvider } from "../client/src/contexts/SiteAppearanceContext";
import { SiteHeader } from "../client/src/components/SiteChrome";
import { themeModeCopy } from "../client/src/i18n/themeMode";

const preferenceKey = "providerbeacon:daylight-mode";
let host: HTMLDivElement, root: Root, meta: HTMLMetaElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState(null, "", "/?lang=ar");
  localStorage.clear();
  state.locale = "ar";
  state.appearance = { theme: "daylight", edgeGlowEnabled: false };
  host = document.createElement("div");
  document.body.append(host);
  meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = "#080b10";
  document.head.append(meta);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  meta.remove();
  vi.restoreAllMocks();
});
const render = (page = "services") =>
  act(async () =>
    root.render(
      <SiteAppearanceProvider>
        <SiteHeader />
        <main key={page}>
          <input aria-label="Search" defaultValue="Instagram followers" />
        </main>
      </SiteAppearanceProvider>
    )
  );
const button = () =>
  host.querySelector<HTMLButtonElement>(".theme-mode-toggle");
const dark = () => document.documentElement.classList.contains("dark");
const click = () => act(() => button()!.click());

describe("Daylight visitor color mode", () => {
  it("offers a visible header toggle after settings load, without persisting a guessed default", async () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    state.appearance = undefined;
    await render();
    expect(button()).toBeNull();
    state.appearance = { theme: "daylight", edgeGlowEnabled: false };
    await render();
    expect(dark()).toBe(false);
    expect(meta.content).toBe("#ffffff");
    expect(button()!.getAttribute("aria-label")).toBe("تفعيل الوضع الليلي");
    expect(button()!.closest("header")).not.toBeNull();
    expect(button()!.closest("#site-mobile-menu")).toBeNull();
    expect(write).not.toHaveBeenCalledWith(preferenceKey, expect.anything());
  });

  it("switches both ways without remounting the current page or changing the site theme", async () => {
    await render();
    const input = host.querySelector<HTMLInputElement>("main input")!;
    input.value = "5000 views";
    await click();
    expect(dark()).toBe(true);
    expect(document.documentElement.dataset.siteTheme).toBe("daylight");
    expect(meta.content).toBe("#0b1220");
    expect(button()!.getAttribute("aria-label")).toBe("تفعيل الوضع النهاري");
    expect(host.querySelector("main input")).toBe(input);
    expect(input.value).toBe("5000 views");
    expect(localStorage.getItem(preferenceKey)).toBe("dark");
    await click();
    expect(dark()).toBe(false);
    expect(meta.content).toBe("#ffffff");
    expect(localStorage.getItem(preferenceKey)).toBe("light");
  });

  it("keeps night mode across page changes, appearance refreshes and a fresh mount", async () => {
    await render();
    await click();
    state.appearance = { ...state.appearance! };
    await render("providers");
    expect(dark()).toBe(true);
    await act(() => root.unmount());
    root = createRoot(host);
    state.appearance = undefined;
    await render();
    state.appearance = { theme: "daylight", edgeGlowEnabled: false };
    await render();
    expect(dark()).toBe(true);
    expect(meta.content).toBe("#0b1220");
    expect(button()!.title).toBe("تفعيل الوضع النهاري");
  });

  it("preserves the visitor preference when the owner changes to another theme and back", async () => {
    localStorage.setItem(preferenceKey, "light");
    await render();
    state.appearance = { theme: "studio", edgeGlowEnabled: false };
    await render();
    expect(button()).toBeNull();
    expect(dark()).toBe(true);
    expect(meta.content).toBe("#000000");
    expect(localStorage.getItem(preferenceKey)).toBe("light");
    state.appearance = { theme: "daylight", edgeGlowEnabled: false };
    await render();
    expect(dark()).toBe(false);
  });

  it.each(["daylight", "studio"] as const)(
    "keeps preview mode local and restores the public %s appearance on exit",
    async publicTheme => {
      localStorage.setItem(preferenceKey, "light");
      state.appearance = { theme: publicTheme, edgeGlowEnabled: false };
      window.history.replaceState(null, "", "/?lang=ar&previewTheme=daylight");
      await render();
      await click();
      expect(dark()).toBe(true);
      expect(localStorage.getItem(preferenceKey)).toBe("light");
      await act(() =>
        host
          .querySelector<HTMLButtonElement>(".theme-preview-banner button")!
          .click()
      );
      expect(document.documentElement.dataset.siteTheme).toBe(publicTheme);
      expect(dark()).toBe(publicTheme === "studio");
      expect(meta.content).toBe(
        publicTheme === "studio" ? "#000000" : "#ffffff"
      );
      expect(window.location.search).toBe("?lang=ar");
    }
  );

  it("handles invalid preferences and unavailable browser storage without breaking the toggle", async () => {
    localStorage.setItem(preferenceKey, "invalid");
    await render();
    expect(dark()).toBe(false);
    await act(() => root.unmount());
    root = createRoot(host);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    await render();
    expect(dark()).toBe(false);
    await click();
    expect(dark()).toBe(true);
    await click();
    expect(dark()).toBe(false);
  });

  it("syncs the mode from another tab and ignores unrelated storage changes", async () => {
    await render();
    await act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: preferenceKey, newValue: "dark" })
      )
    );
    expect(dark()).toBe(true);
    await act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: "other", newValue: "light" })
      )
    );
    expect(dark()).toBe(true);
    await act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: preferenceKey, newValue: null })
      )
    );
    expect(dark()).toBe(false);
  });

  it.each(Object.entries(themeModeCopy))(
    "names the next action in %s and keeps the menu separately operable",
    async (locale, labels) => {
      state.locale = locale;
      await render();
      expect(button()!.getAttribute("aria-label")).toBe(labels.dark);
      await click();
      expect(button()!.getAttribute("aria-label")).toBe(labels.light);
      await act(() =>
        host
          .querySelector<HTMLButtonElement>(
            '[aria-controls="site-mobile-menu"]'
          )!
          .click()
      );
      expect(host.querySelector("#site-mobile-menu")).not.toBeNull();
      expect(dark()).toBe(true);
    }
  );
});
