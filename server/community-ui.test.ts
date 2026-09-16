import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  locale: "ar" as "ar" | "en" | "es" | "hi" | "zh",
}));
vi.mock("../client/src/components/LinkAutofill", () => ({
  default: () => null,
  GroupSourceDetails: () => null,
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
  linkMetadata: null,
};
describe("community cards and submission forms", () => {
  it("distinguishes group, channel and server cards in every locale without guessing Telegram types", () => {
    for (const locale of ["ar", "en", "es", "hi", "zh"] as const) {
      state.locale = locale;
      const t = communityCopy[locale];
      for (const [url, platform, kind, button, audience] of [
        [
          "https://www.whatsapp.com/channel/0029Va4K0PZ5a245NkngBA2M",
          "whatsapp",
          "channel",
          t.openChannel,
          null,
        ],
        [
          "https://chat.whatsapp.com/AbCdEf1234567890123456",
          "whatsapp",
          "group",
          t.open,
          null,
        ],
        [
          "https://discord.gg/Beacon_Test",
          "discord",
          "server",
          t.openServer,
          null,
        ],
        [
          group.url,
          "telegram",
          "channel",
          t.openChannel,
          { count: 1234, kind: "subscribers", approximate: false },
        ],
      ] as const) {
        const html = renderToStaticMarkup(
          React.createElement(CommunityCard, {
            group: {
              ...group,
              url,
              platform,
              linkMetadata: {
                audience,
                avatarUrl: null,
                fetchedAt: "2026-09-16T12:00:00Z",
              },
            },
            onReport: () => {},
          })
        );
        expect(html).toContain(`>${t.kinds[kind]}</span>`);
        expect(html).toContain(button);
        expect(html).not.toContain("undefined");
      }
      const unknown = renderToStaticMarkup(
        React.createElement(CommunityCard, { group, onReport: () => {} })
      );
      expect(unknown).toContain(t.openCommunity);
      expect(unknown).not.toContain(`>${t.kinds.channel}</span>`);
    }
    state.locale = "ar";
  });
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
