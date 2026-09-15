// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { name: "Test operator" },
    loading: false,
    logout: vi.fn(),
  }),
}));
vi.mock("@/hooks/useMobile", () => ({ useIsMobile: () => true }));
vi.mock("wouter", () => ({ useLocation: () => ["/admin/email", vi.fn()] }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      access: {
        useQuery: () => ({
          data: { role: "owner", permissions: ["emails.read", "emails.send"] },
        }),
      },
    },
  },
}));
import DashboardLayout from "../client/src/components/DashboardLayout";
import ErrorBoundary from "../client/src/components/ErrorBoundary";
import { LocaleProvider } from "../client/src/contexts/LocaleContext";

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubEnv("DEV", false);
  window.localStorage.clear();
  window.history.replaceState(null, "", "/admin/email?lang=en");
  document.documentElement.lang = "en";
  document.body.setAttribute("translate", "yes");
  document.body.className = "existing-theme";
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container, { onCaughtError: vi.fn() });
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("translate");
  document.body.className = "";
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("mobile dashboard language and recovery", () => {
  it("uses native Arabic and protects mobile portals, then restores translation on public pages", async () => {
    await act(() =>
      root.render(
        React.createElement(
          LocaleProvider,
          null,
          React.createElement(DashboardLayout, {
            children: React.createElement("h1", null, "Customer email test"),
          })
        )
      )
    );
    expect(document.body.getAttribute("translate")).toBe("no");
    expect(document.body.classList.contains("notranslate")).toBe(true);
    const language = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Language"]'
    )!;
    await act(() => {
      language.value = "ar";
      language.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(container.textContent).toContain("بريد العملاء");
    await act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-sidebar="trigger"]')!
        .click()
    );
    const mobileNavigation = document.querySelector('[role="dialog"]')!;
    expect(mobileNavigation).not.toBeNull();
    expect(mobileNavigation.closest('[translate="no"]')).not.toBeNull();
    await act(() => root.render(React.createElement("p", null, "Public page")));
    expect(document.body.getAttribute("translate")).toBe("yes");
    expect(document.body.className).toBe("existing-theme");
  });

  it("shows concise Arabic recovery without a production stack", async () => {
    window.history.replaceState(null, "", "/admin/email?lang=ar");
    function Broken(): never {
      throw new DOMException(
        "insertBefore: private diagnostic sentinel",
        "NotFoundError"
      );
    }
    await act(() =>
      root.render(
        React.createElement(ErrorBoundary, null, React.createElement(Broken))
      )
    );
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain("تعذّر عرض الصفحة");
    expect(container.textContent).toContain("إظهار الأصلي");
    expect(container.textContent).toContain("راجع سجل الرسائل");
    expect(container.querySelector("button")?.textContent).toBe(
      "إعادة تحميل الصفحة"
    );
    expect(
      container.querySelector('[dir="rtl"][translate="no"]')
    ).not.toBeNull();
    expect(container.textContent).not.toContain("private diagnostic sentinel");
    expect(container.querySelector("pre, details")).toBeNull();
  });

  it("does not attribute an unrelated error to translation", async () => {
    function Broken(): never {
      throw new Error("Unrelated application failure");
    }
    await act(() =>
      root.render(
        React.createElement(ErrorBoundary, null, React.createElement(Broken))
      )
    );
    expect(container.textContent).toContain("We couldn't display this page");
    expect(container.textContent).not.toContain("Show original");
    expect(container.textContent).not.toContain(
      "Unrelated application failure"
    );
  });
});
