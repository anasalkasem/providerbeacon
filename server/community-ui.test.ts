import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  locale: "ar" as "ar" | "en" | "es" | "hi" | "zh",
}));
vi.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: state.locale }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    community: {
      providers: { useQuery: () => ({ data: [], isError: false }) },
    },
  },
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) =>
    React.createElement("a", { href, ...props }, children),
}));
import { CommunityCard, GroupForm } from "../client/src/components/CommunityUi";
import { communityCopy } from "../client/src/i18n/community";
const group = {
  id: 1,
  name: "<script>alert('untrusted')</script>",
  description: "A group for learning from other providers.",
  url: "https://t.me/test_community",
  platform: "telegram" as const,
  topic: "learning" as const,
  language: "ar" as const,
  reviewedAt: new Date("2026-09-15T08:00:00Z"),
  provider: null,
  evidenceUrl: null,
};
describe("community cards and submission forms", () => {
  it("escapes submitted text and separates a reviewed link from provider association", () => {
    const html = renderToStaticMarkup(
      React.createElement(CommunityCard, { group, onReport: () => {} })
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('rel="noopener noreferrer nofollow ugc"');
    expect(html).toContain(communityCopy.ar.reviewed);
    expect(html).toContain(communityCopy.ar.independent);
    expect(html).not.toContain(communityCopy.ar.association);
  });
  it("shows provider and evidence links only when an association was supplied by the server", () => {
    const html = renderToStaticMarkup(
      React.createElement(CommunityCard, {
        group: {
          ...group,
          provider: { id: 2, slug: "test-provider", name: "Test Provider" },
          evidenceUrl: "https://provider.example/community",
        },
        onReport: () => {},
      })
    );
    expect(html).toContain("/providers/test-provider");
    expect(html).toContain("https://provider.example/community");
    expect(html).toContain(communityCopy.ar.association);
    expect(html).not.toContain(communityCopy.ar.independent);
  });
  it("renders the full submission form in all five locales with the explicit re-review behavior", () => {
    for (const locale of ["ar", "en", "es", "hi", "zh"] as const) {
      state.locale = locale;
      const html = renderToStaticMarkup(
        React.createElement(GroupForm, {
          initial: {
            name: "Existing group",
            description: group.description,
            url: group.url,
          },
          onSave: () => {},
          pending: false,
        })
      );
      for (const text of [
        communityCopy[locale].editHint,
        communityCopy[locale].linkHint,
        communityCopy[locale].providerSearch,
        communityCopy[locale].save,
      ])
        expect(html).toContain(text);
      expect(html).not.toContain("undefined");
      expect(html).toContain('type="url"');
      expect(html).toContain('maxLength="600"');
    }
  });
});
