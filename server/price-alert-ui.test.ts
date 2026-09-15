import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  verified: true,
  enabled: true,
  locale: "en",
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) =>
    React.createElement("a", { href, ...props }, children),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    member: {
      me: {
        useQuery: () => ({
          data: {
            member: { emailVerified: state.verified },
            emailEnabled: state.enabled,
          },
        }),
      },
    },
    workspace: {
      target: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
    useUtils: () => ({ workspace: { invalidate: vi.fn() } }),
  },
}));
import PriceTargetForm, {
  type PriceTargetProps,
} from "../client/src/components/PriceTargetForm";
const props: PriceTargetProps = {
  id: 1,
  target: "12",
  currency: "USD",
  current: "13.00",
  canSetTarget: true,
  emailAlert: { enabled: false, status: "off", revision: 0 },
};
describe("price alert subscription controls", () => {
  beforeEach(() => {
    state.verified = true;
    state.enabled = true;
    state.locale = "en";
  });
  it("leaves email off by default and makes the exact quantity target and consent visible", () => {
    const html = renderToStaticMarkup(
      React.createElement(PriceTargetForm, props)
    );
    const checkbox = html.match(/<input[^>]*type="checkbox"[^>]*>/)![0];
    expect(checkbox).not.toContain("checked");
    expect(checkbox).not.toContain("disabled");
    expect(html).toContain("Target total for this quantity (USD)");
    expect(html).toContain(
      "Email me when this quantity costs my target or less."
    );
    expect(html).toContain("One email per target setting");
  });
  it("requires email verification but preserves saving an in-app target", () => {
    state.verified = false;
    const html = renderToStaticMarkup(
      React.createElement(PriceTargetForm, props)
    );
    expect(html.match(/<input[^>]*type="checkbox"[^>]*>/)![0]).toContain(
      "disabled"
    );
    expect(html).toContain('href="/account/settings"');
    expect(html).toContain("Save target and preferences");
  });
  it("keeps disable available when mail is offline and the offer is hidden or changed", () => {
    state.enabled = false;
    const html = renderToStaticMarkup(
      React.createElement(PriceTargetForm, {
        ...props,
        canSetTarget: false,
        emailAlert: { enabled: true, status: "paused", revision: 1 },
      })
    );
    expect(html).toContain("Stop this email alert");
    expect(html).toContain("Email alert paused");
    expect(html).not.toContain("<form");
  });
  it.each(["ar", "es", "hi", "zh"])(
    "renders %s subscription controls without falling back to English",
    locale => {
      state.locale = locale;
      const html = renderToStaticMarkup(
        React.createElement(PriceTargetForm, props)
      );
      expect(html).not.toContain("Email me when");
      expect(html).toContain('type="checkbox"');
      expect(html).toContain("USD");
    }
  );
});
