// @vitest-environment jsdom
import type { SiteThemeId } from "../shared/siteThemes";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  role: "owner",
  settings: {
    edgeGlowEnabled: true,
    theme: "beacon" as SiteThemeId,
    revision: 1,
  },
  publicSettings: { edgeGlowEnabled: true, theme: "beacon" as SiteThemeId },
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
import AdminThemes from "../client/src/pages/AdminThemes";
import { SiteAppearanceProvider } from "../client/src/contexts/SiteAppearanceContext";
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
  state.role = "owner";
  state.settings = { edgeGlowEnabled: true, theme: "beacon", revision: 1 };
  state.publicSettings = { edgeGlowEnabled: true, theme: "beacon" };
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
        <AdminThemes />
      </SiteAppearanceProvider>
    )
  );
const toggle = () =>
  container.querySelector<HTMLButtonElement>('[role="switch"]');
describe("owner appearance panel", () => {
  it("uses the approved design for stale saved themes without offering old presets", async () => {
    await render();
    expect(container.textContent).toContain("Beacon Orbit 3D");
    expect(
      Array.from(container.querySelectorAll("[data-theme-option]")).map(el =>
        el.getAttribute("data-theme-option")
      )
    ).toEqual(["beacon", "orbit", "studio"]);
    expect(
      container.querySelector<HTMLButtonElement>('[data-apply-theme="beacon"]')
        ?.disabled
    ).toBe(true);
    for (const oldTheme of [
      "copper",
      "summer",
      "midnight",
      "pearl",
      "fire",
      "navy",
    ]) {
      state.publicSettings = {
        edgeGlowEnabled: true,
        theme: oldTheme as SiteThemeId,
      };
      await render();
      expect(document.documentElement.dataset.siteTheme).toBe("beacon");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    }
    expect(state.save).not.toHaveBeenCalled();
  });
  it.each(["orbit", "studio"] as const)(
    "only publishes %s after the owner saves successfully",
    async theme => {
      await render();
      await act(() =>
        container
          .querySelector<HTMLButtonElement>(`[data-apply-theme="${theme}"]`)!
          .click()
      );
      expect(state.save).toHaveBeenCalledWith({ theme, revision: 1 });
      expect(document.documentElement.dataset.siteTheme).toBe("beacon");
      state.pending = true;
      await render();
      expect(
        container.querySelector<HTMLButtonElement>(
          `[data-apply-theme="${theme}"]`
        )!.disabled
      ).toBe(true);
      state.pending = false;
      await act(() =>
        state.options.onSuccess(
          { edgeGlowEnabled: true, theme, revision: 2 },
          { theme, revision: 1 }
        )
      );
      await render();
      expect(document.documentElement.dataset.siteTheme).toBe(theme);
      expect(state.publicCache).toHaveBeenCalledWith(undefined, {
        edgeGlowEnabled: true,
        theme,
      });
      expect(
        container.querySelector<HTMLButtonElement>(
          `[data-apply-theme="${theme}"]`
        )!.disabled
      ).toBe(true);
      await act(() =>
        container
          .querySelector<HTMLButtonElement>('[data-apply-theme="beacon"]')!
          .click()
      );
      expect(state.save).toHaveBeenLastCalledWith({
        theme: "beacon",
        revision: 2,
      });
    }
  );
  it.each(["orbit", "studio"] as const)(
    "keeps %s previews local and exits without any write",
    async theme => {
      window.history.replaceState(null, "", `/?previewTheme=${theme}`);
      await render();
      expect(document.documentElement.dataset.siteTheme).toBe(theme);
      expect(container.textContent).toContain("في هذه النافذة فقط");
      expect(
        container.querySelector(`a[href="/?previewTheme=${theme}"]`)
      ).not.toBeNull();
      expect(state.save).not.toHaveBeenCalled();
      await act(() =>
        container
          .querySelector<HTMLButtonElement>(".theme-preview-banner button")!
          .click()
      );
      expect(document.documentElement.dataset.siteTheme).toBe("beacon");
      expect(window.location.search).toBe("");
      expect(state.save).not.toHaveBeenCalled();
    }
  );
  it("keeps a failed theme change unpublished and retries using the refreshed revision", async () => {
    await render();
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-apply-theme="orbit"]')!
        .click()
    );
    await act(() => state.options.onError({ data: { code: "CONFLICT" } }));
    expect(document.documentElement.dataset.siteTheme).toBe("beacon");
    expect(state.publicCache).not.toHaveBeenCalled();
    state.settings = { theme: "beacon", edgeGlowEnabled: false, revision: 5 };
    await render();
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-apply-theme="orbit"]')!
        .click()
    );
    expect(state.save).toHaveBeenLastCalledWith({
      theme: "orbit",
      revision: 5,
    });
  });
  it("refetches a glow conflict and uses the latest revision without changing the design", async () => {
    await render();
    await act(() => toggle()!.click());
    await act(() => state.options.onError({ data: { code: "CONFLICT" } }));
    expect(state.refetch).toHaveBeenCalled();
    expect(state.publicCache).not.toHaveBeenCalled();
    state.settings = { theme: "beacon", edgeGlowEnabled: true, revision: 3 };
    await render();
    await act(() => toggle()!.click());
    expect(state.save).toHaveBeenLastCalledWith({
      edgeGlowEnabled: false,
      revision: 3,
    });
    expect(document.documentElement.dataset.siteTheme).toBe("beacon");
  });
  it("mounts on the themes page for the owner and is absent for other staff", async () => {
    await render();
    expect(container.querySelector("h1")?.textContent).toBe("الثيمات");
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
        { edgeGlowEnabled: false, theme: "beacon", revision: 2 },
        { edgeGlowEnabled: false, revision: 1 }
      )
    );
    await render();
    expect(toggle()?.getAttribute("aria-checked")).toBe("false");
    expect(state.publicCache).toHaveBeenCalledWith(undefined, {
      edgeGlowEnabled: false,
      theme: "beacon",
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
    state.publicSettings = { edgeGlowEnabled: false, theme: "beacon" };
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
