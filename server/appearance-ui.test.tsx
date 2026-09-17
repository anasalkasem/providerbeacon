// @vitest-environment jsdom
import type { SiteThemeId } from "../shared/siteThemes";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  role: "owner",
  settings: {
    edgeGlowEnabled: true,
    theme: "copper" as SiteThemeId,
    revision: 1,
  },
  publicSettings: { edgeGlowEnabled: true, theme: "copper" as SiteThemeId },
  error: false,
  pending: false,
  save: vi.fn(),
  options: null as any,
  publicCache: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: "ar" }),
}));
vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: any) => children,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      admin: {
        appearance: {
          get: {
            setData: (_: any, value: any) => {
              state.settings = value;
            },
          },
        },
        audit: { list: { invalidate: vi.fn() } },
      },
      appearance: { public: { setData: state.publicCache } },
    }),
    appearance: {
      public: { useQuery: () => ({ data: state.publicSettings }) },
    },
    admin: {
      access: {
        useQuery: () => ({ data: { role: state.role, permissions: [] } }),
      },
      overview: { useQuery: () => ({ data: {} }) },
      audit: { list: { useQuery: () => ({ data: [] }) } },
      appearance: {
        get: {
          useQuery: () => ({
            data: state.settings,
            isError: state.error,
            refetch: state.refetch,
          }),
        },
        update: {
          useMutation: (options: any) => {
            state.options = options;
            return { mutate: state.save, isPending: state.pending };
          },
        },
      },
    },
  },
}));
import Admin from "../client/src/pages/Admin";
import { SiteAppearanceProvider } from "../client/src/contexts/SiteAppearanceContext";
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.role = "owner";
  state.settings = { edgeGlowEnabled: true, theme: "copper", revision: 1 };
  state.publicSettings = { edgeGlowEnabled: true, theme: "copper" };
  state.publicCache.mockImplementation((_: any, value: any) => {
    state.publicSettings = value;
  });
  state.error = false;
  state.pending = false;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});
const render = () =>
  act(async () =>
    root.render(
      <SiteAppearanceProvider>
        <Admin />
      </SiteAppearanceProvider>
    )
  );
const toggle = () =>
  container.querySelector<HTMLButtonElement>('[role="switch"]');
describe("owner appearance panel", () => {
  it("previews every theme privately, cancels cleanly and clears preview on loss of owner access", async () => {
    await render();
    expect(container.querySelectorAll("[data-theme-option]")).toHaveLength(4);
    for (const theme of ["summer", "midnight", "pearl"]) {
      await act(() =>
        container
          .querySelector<HTMLButtonElement>(`[data-theme-option="${theme}"]`)!
          .click()
      );
      expect(document.documentElement.dataset.siteTheme).toBe(theme);
      expect(document.documentElement.classList.contains("dark")).toBe(
        theme === "midnight"
      );
      expect(
        container
          .querySelector("[data-beacon-glow]")
          ?.getAttribute("data-beacon-glow")
      ).toBe("on");
      expect(container.querySelector("[data-apply-theme]")).not.toBeNull();
      expect(state.publicSettings.theme).toBe("copper");
    }
    await act(() =>
      container.querySelector<HTMLButtonElement>("[data-cancel-theme]")!.click()
    );
    expect(document.documentElement.dataset.siteTheme).toBe("copper");
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-theme-option="summer"]')!
        .click()
    );
    state.role = "administrator";
    await render();
    expect(document.documentElement.dataset.siteTheme).toBe("copper");
    expect(state.save).not.toHaveBeenCalled();
  });
  it("saves only the chosen theme, preserves the glow and retains the choice after reload", async () => {
    state.settings.edgeGlowEnabled = false;
    state.publicSettings.edgeGlowEnabled = false;
    await render();
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-theme-option="pearl"]')!
        .click()
    );
    await act(() =>
      container.querySelector<HTMLButtonElement>("[data-apply-theme]")!.click()
    );
    expect(state.save).toHaveBeenCalledWith({ theme: "pearl", revision: 1 });
    expect(state.publicSettings.theme).toBe("copper");
    state.pending = true;
    await render();
    expect(
      container.querySelector<HTMLButtonElement>("[data-apply-theme]")!.disabled
    ).toBe(true);
    expect(toggle()!.disabled).toBe(true);
    state.pending = false;
    await act(() =>
      state.options.onSuccess(
        { theme: "pearl", edgeGlowEnabled: false, revision: 2 },
        { theme: "pearl", revision: 1 }
      )
    );
    await render();
    expect(container.querySelector("[data-apply-theme]")).toBeNull();
    expect(document.documentElement.dataset.siteTheme).toBe("pearl");
    expect(state.publicCache).toHaveBeenCalledWith(undefined, {
      theme: "pearl",
      edgeGlowEnabled: false,
    });
    expect(container.querySelector(".beacon-edge-glow")).toBeNull();
    await act(() => root.unmount());
    root = createRoot(container);
    await render();
    expect(document.documentElement.dataset.siteTheme).toBe("pearl");
    expect(
      container
        .querySelector('[data-theme-option="pearl"]')
        ?.getAttribute("aria-pressed")
    ).toBe("true");
  });
  it("keeps failed saves private, refetches conflicts and uses the latest revision on retry", async () => {
    await render();
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-theme-option="summer"]')!
        .click()
    );
    await act(() => state.options.onError({ data: { code: "CONFLICT" } }));
    expect(state.refetch).toHaveBeenCalled();
    expect(state.publicCache).not.toHaveBeenCalled();
    state.settings = { theme: "midnight", edgeGlowEnabled: false, revision: 3 };
    state.publicSettings = { theme: "midnight", edgeGlowEnabled: false };
    await render();
    expect(document.documentElement.dataset.siteTheme).toBe("summer");
    await act(() =>
      container.querySelector<HTMLButtonElement>("[data-apply-theme]")!.click()
    );
    expect(state.save).toHaveBeenLastCalledWith({
      theme: "summer",
      revision: 3,
    });
    await act(() =>
      container.querySelector<HTMLButtonElement>("[data-cancel-theme]")!.click()
    );
    expect(document.documentElement.dataset.siteTheme).toBe("midnight");
    state.error = true;
    await render();
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-theme-option="summer"]')!
        .click()
    );
    expect(
      container.querySelector<HTMLButtonElement>("[data-apply-theme]")!.disabled
    ).toBe(true);
  });
  it("mounts on the dashboard for the owner and is absent for other staff", async () => {
    await render();
    expect(container.textContent).toContain("مظهر الموقع");
    expect(toggle()?.getAttribute("aria-checked")).toBe("true");
    state.role = "administrator";
    await render();
    expect(toggle()).toBeNull();
    expect(container.textContent).not.toContain("مظهر الموقع");
  });
  it("waits for a saved response and updates the public setting after success", async () => {
    await render();
    await act(() => toggle()!.click());
    expect(state.save).toHaveBeenCalledWith({
      edgeGlowEnabled: false,
      revision: 1,
    });
    expect(toggle()?.getAttribute("aria-checked")).toBe("true");
    state.pending = true;
    await render();
    expect(toggle()?.disabled).toBe(true);
    state.pending = false;
    await act(() =>
      state.options.onSuccess(
        { edgeGlowEnabled: false, theme: "copper", revision: 2 },
        { edgeGlowEnabled: false, revision: 1 }
      )
    );
    await render();
    expect(toggle()?.getAttribute("aria-checked")).toBe("false");
    expect(state.publicCache).toHaveBeenCalledWith(undefined, {
      edgeGlowEnabled: false,
      theme: "copper",
    });
    expect(container.querySelector(".beacon-edge-glow")).toBeNull();
    expect(
      container
        .querySelector("[data-beacon-glow]")
        ?.getAttribute("data-beacon-glow")
    ).toBe("off");
  });
  it("does not offer a guessed toggle on a load error, and preview never saves", async () => {
    vi.useFakeTimers();
    state.error = true;
    state.publicSettings = { edgeGlowEnabled: false, theme: "copper" };
    await render();
    expect(toggle()).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "تعذّر تحميل"
    );
    const preview = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent?.includes("معاينة الإضاءة")
    )!;
    await act(() => preview.click());
    expect(container.querySelectorAll(".beacon-edge-glow")).toHaveLength(1);
    await act(() => vi.advanceTimersByTime(60_000));
    expect(container.querySelectorAll(".beacon-edge-glow")).toHaveLength(1);
    expect(preview.getAttribute("aria-pressed")).toBe("true");
    await act(() => preview.click());
    expect(container.querySelector(".beacon-edge-glow")).toBeNull();
    await act(() => preview.click());
    state.role = "administrator";
    await render();
    expect(container.querySelector(".beacon-edge-glow")).toBeNull();
    expect(
      container
        .querySelector("[data-beacon-glow]")
        ?.getAttribute("data-beacon-glow")
    ).toBe("off");
    expect(state.save).not.toHaveBeenCalled();
  });
});
