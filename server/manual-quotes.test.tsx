// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ locale: "en" }));
vi.mock("@/contexts/LocaleContext", () => ({ useLocale: () => state }));
vi.mock("@/components/SiteChrome", () => ({
  PublicLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("wouter", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
import QuoteWorkbench from "../client/src/pages/QuoteWorkbench";

it.each(["en", "ar"])(
  "compares complete manual quote totals without a multiplier in %s",
  async locale => {
    state.locale = locale;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => root.render(<QuoteWorkbench />));
      expect(host.querySelectorAll("select")).toHaveLength(1);
      expect(host.textContent).not.toMatch(/وحدة|Sale unit|per 1,000/);
      const fields = host.querySelectorAll<HTMLInputElement>(
        'section input[type="number"]'
      );
      expect(fields).toHaveLength(3);
      for (const [index, amount] of Array.from(["1000", "375", "0.0001"].entries())) {
        await act(async () => {
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
          )!.set!.call(fields[index], amount);
          fields[index]!.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      const totals = Array.from(host.querySelectorAll("output")).map(
        node => node.textContent
      );
      expect(totals).toEqual(
        [1000, 375, 0.0001].map(
          amount =>
            `USD ${amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 7 })}`
        )
      );
      await act(async () =>
        host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
      );
      expect(host.querySelectorAll("section")[2]!.textContent).toContain(
        locale === "ar" ? "أقل إجمالي مُدخل" : "Lowest entered total"
      );
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  }
);
