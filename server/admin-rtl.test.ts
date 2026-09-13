import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ locale: "ar" as "ar" | "en" }));
vi.mock("@/contexts/LocaleContext", async original => ({ ...await original<any>(), useLocale: () => ({ locale: state.locale, dir: state.locale === "ar" ? "rtl" : "ltr", setLocale: () => {} }) }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "Test operator" }, loading: false, logout: () => {} }) }));
vi.mock("@/hooks/useMobile", () => ({ useIsMobile: () => false }));
vi.mock("wouter", () => ({ useLocation: () => ["/admin", () => {}] }));
vi.mock("@/lib/trpc", () => ({ trpc: { admin: { access: { useQuery: () => ({ data: { role: "owner", permissions: ["services.read"] } }) } } } }));
import DashboardLayout from "../client/src/components/DashboardLayout";

beforeEach(() => vi.stubGlobal("localStorage", { getItem: () => "280", setItem: () => {} }));
afterEach(() => vi.unstubAllGlobals());
describe("shared dashboard in English and Arabic", () => {
  it.each([["ar", "right", "الخدمات", "اللغة"], ["en", "left", "Services", "Language"]] as const)("keeps the %s navigation on the correct side", (locale, side, services, language) => {
    state.locale = locale;
    const html = renderToStaticMarkup(React.createElement(DashboardLayout, { children: React.createElement("h1", null, "Content") }));
    expect(html).toContain(`data-side="${side}"`);
    expect(html).toContain(locale === "ar" ? "مراجعة الخدمات" : "Service review");
    expect(html).toContain(services); expect(html).toContain(`aria-label="${language}"`);
    expect(html).toContain("min-w-0"); expect(html).toContain("Content");
  });
});
