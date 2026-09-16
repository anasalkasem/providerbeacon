import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  budget: vi.fn(),
  model: vi.fn(),
  available: true,
  cached: [] as any[],
  writes: [] as any[],
}));
vi.mock("./publicMetadataFetch", async original => ({
  ...(await original<any>()),
  fetchPublicMetadata: state.fetch,
  resolveMetadataUrl: vi.fn(async () => ({})),
}));
vi.mock("./memberDb", () => ({ reserveMemberRequests: state.budget }));
vi.mock("./assistantModel", () => ({
  assistantAvailable: () => state.available,
  assistantJson: state.model,
}));
vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => state.cached }) }),
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => ({
        onDuplicateKeyUpdate: async () => {
          state.writes.push({ table, values });
        },
      }),
    }),
  }),
}));
import {
  importedMedia,
  linkMetadataCache,
} from "../drizzle/linkMetadataSchema";
import { previewLink, previewGroupLink } from "./linkMetadata";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6YwAAAABJRU5ErkJggg==",
  "base64"
);
const website =
  '<title>Provider</title><meta name="description" content="A public provider description"><img class="logo" src="/logo.png?version=1"><meta property="og:image" content="/marketing.jpg">';
const telegram =
  '<div class="tgme_page_title">Provider community</div><div class="tgme_page_extra">1 234 members, 3 online</div><div class="tgme_page_description">Learn about comparing service providers.</div><img class="tgme_page_photo_image" src="https://cdn1.telesco.pe/avatar.jpg?token=visible">';
beforeEach(() => {
  vi.clearAllMocks();
  state.cached = [];
  state.writes = [];
  state.available = true;
  vi.stubEnv("PUBLIC_APP_URL", "https://providerbeacon.com");
  state.budget.mockResolvedValue(undefined);
  state.model.mockResolvedValue({ topic: "learning", language: "en" });
  state.fetch.mockImplementation(
    async (url: string, options: { html?: boolean }) => ({
      url,
      body: options.html
        ? Buffer.from(url.startsWith("https://t.me/") ? telegram : website)
        : png,
      contentType: options.html ? "text/html" : "image/png",
    })
  );
});
describe("automatic import orchestration", () => {
  it("imports and caches WhatsApp channel facts under the canonical channel identity", async () => {
    const source = "https://www.whatsapp.com/channel/0029Va4K0PZ5a245NkngBA2M";
    state.fetch.mockImplementation(
      async (url: string, options: { html?: boolean }) => ({
        url,
        body: options.html
          ? Buffer.from(
              '<h1>Provider updates</h1><h5>News about comparing providers</h5><h5>Channel • 4.3M followers</h5><meta property="og:image" content="https://pps.whatsapp.net/channel.jpg?token=public">'
            )
          : png,
        contentType: options.html ? "text/html" : "image/png",
      })
    );
    const result = await previewGroupLink(
      source.replace("www.", "") + "/?lang=es"
    );
    expect(result).toMatchObject({
      kind: "whatsapp",
      sourceUrl: source,
      name: "Provider updates",
      complete: true,
      audience: { count: 4300000, kind: "followers", approximate: true },
    });
    expect(state.fetch.mock.calls[0]).toEqual([
      `${source}?lang=en`,
      { html: true, maxBytes: 1048576, timeoutMs: 10000 },
    ]);
    expect(result.avatarUrl).toContain("/api/imported-media/");
    expect(state.fetch).toHaveBeenCalledTimes(2);
    state.cached = [{ payload: result }];
    state.fetch.mockClear();
    expect(await previewGroupLink(source + "/")).toEqual(result);
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it("does not import another channel after a redirect and preserves manual entry on source failure", async () => {
    const source = "https://www.whatsapp.com/channel/0029Va4K0PZ5a245NkngBA2M";
    state.fetch.mockResolvedValue({
      url: source + "OTHER",
      contentType: "text/html",
      body: Buffer.from(
        "<h1>Other channel</h1><h5>Other news</h5><h5>Channel • 10K followers</h5>"
      ),
    });
    expect(await previewGroupLink(source)).toMatchObject({
      sourceUrl: source,
      kind: "whatsapp",
      issue: "unavailable",
      name: null,
      audience: null,
    });
    state.fetch.mockRejectedValue(new Error("metadata_protected"));
    expect(await previewGroupLink(source)).toMatchObject({
      issue: "protected",
      complete: false,
      name: null,
      audience: null,
    });
    expect(state.model).not.toHaveBeenCalled();
  });
  it("imports WhatsApp public invitation metadata and preserves signed images only in server storage", async () => {
    const source = "https://chat.whatsapp.com/AbCdEf1234567890123456";
    state.fetch.mockImplementation(
      async (url: string, options: { html?: boolean }) => ({
        url,
        body: options.html
          ? Buffer.from(
              '<meta property="og:title" content="Provider community"><meta property="og:description" content="Discuss comparing service providers here"><meta property="og:image" content="https://pps.whatsapp.net/photo.jpg?token=public">'
            )
          : png,
        contentType: options.html ? "text/html" : "image/png",
      })
    );
    const result = await previewGroupLink(source + "?mode=ac_t");
    expect(result).toMatchObject({
      kind: "whatsapp",
      sourceUrl: source,
      name: "Provider community",
      audience: null,
      complete: true,
    });
    expect(state.fetch.mock.calls[0][0]).toBe(source);
    expect(result.avatarUrl).toContain("/api/imported-media/");
    expect(result.avatarUrl).not.toContain("token=");
    expect(
      state.fetch.mock.calls.some(([url]) => String(url).includes("thum.io"))
    ).toBe(false);
    state.cached = [{ payload: result }];
    state.fetch.mockClear();
    expect(await previewGroupLink(source)).toEqual(result);
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it("imports Discord from the public invite API and retains approximate guild counts", async () => {
    state.fetch.mockImplementation(
      async (url: string, options: { json?: boolean }) => ({
        url,
        body: options.json
          ? Buffer.from(
              JSON.stringify({
                type: 0,
                code: "Beacon_Test",
                guild: {
                  id: "123456789012345678",
                  name: "Provider community",
                  description: "Discuss provider services in this community",
                  icon: "b".repeat(32),
                },
                approximate_member_count: 1200,
              })
            )
          : png,
        contentType: options.json ? "application/json" : "image/png",
      })
    );
    const result = await previewGroupLink(
      "https://discord.com/invite/Beacon_Test"
    );
    expect(result).toMatchObject({
      kind: "discord",
      sourceUrl: "https://discord.gg/Beacon_Test",
      name: "Provider community",
      audience: { count: 1200, kind: "members", approximate: true },
    });
    expect(state.fetch.mock.calls[0]).toEqual([
      "https://discord.com/api/v10/invites/Beacon_Test?with_counts=true",
      { json: true, maxBytes: 131072, timeoutMs: 10000 },
    ]);
    expect(result.avatarUrl).toContain("/api/imported-media/");
    expect(state.fetch).toHaveBeenCalledTimes(2);
    state.cached = [{ payload: result }];
    state.fetch.mockClear();
    expect(await previewGroupLink("https://discord.gg/Beacon_Test")).toEqual(
      result
    );
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it("leaves protected, expired and redirected invitations editable without importing another destination's facts", async () => {
    const source = "https://chat.whatsapp.com/AbCdEf1234567890123456";
    for (const [error, issue] of [
      ["metadata_protected", "protected"],
      ["metadata_source_busy", "source_busy"],
      ["metadata_timeout", "timeout"],
      ["metadata_response", "unavailable"],
    ]) {
      state.fetch.mockRejectedValue(new Error(error));
      expect(await previewGroupLink(source)).toMatchObject({
        kind: "whatsapp",
        issue,
        complete: false,
        name: null,
        audience: null,
      });
    }
    state.fetch.mockResolvedValue({
      url: "https://t.me/another_group",
      contentType: "text/html",
      body: Buffer.from(telegram),
    });
    expect(await previewGroupLink(source)).toMatchObject({
      issue: "unavailable",
      name: null,
      audience: null,
    });
    state.fetch.mockResolvedValue({
      url: "https://discord.com/api/v10/invites/another?with_counts=true",
      contentType: "application/json",
      body: Buffer.from("{}"),
    });
    expect(
      await previewGroupLink("https://discord.gg/Beacon_Test")
    ).toMatchObject({ issue: "unavailable", name: null, audience: null });
    state.fetch.mockClear();
    await expect(previewLink("telegram", source)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.model).not.toHaveBeenCalled();
  });
  it("captures the real homepage and serves durable content-addressed media instead of provider query URLs", async () => {
    const result = await previewLink(
      "website",
      "https://provider.com/services"
    );
    expect(result).toMatchObject({
      name: "Provider",
      sourceUrl: "https://provider.com/",
      complete: true,
    });
    expect(result.logoUrl).toMatch(
      /^https:\/\/providerbeacon.com\/api\/imported-media\/[a-f0-9]{64}$/
    );
    expect(result.websitePreviewUrl).toMatch(
      /^https:\/\/providerbeacon.com\/api\/imported-media\//
    );
    expect(
      state.fetch.mock.calls.some(
        ([url]) =>
          String(url).startsWith("https://image.thum.io/get/noanimate/") &&
          String(url).endsWith("https://provider.com/")
      )
    ).toBe(true);
    expect(
      state.fetch.mock.calls.some(([url]) =>
        String(url).includes("marketing.jpg")
      )
    ).toBe(false);
    expect(
      state.writes.filter(write => write.table === importedMedia).length
    ).toBeGreaterThan(0);
    expect(
      state.writes.find(write => write.table === linkMetadataCache).values
        .payload
    ).toEqual(result);
    expect(state.model).not.toHaveBeenCalled();
  });
  it("keeps logo and text when screenshot quota or capture fails", async () => {
    state.budget.mockImplementation(async (buckets: { key: string }[]) => {
      if (buckets[0].key === "metadata:screenshot")
        throw new Error("rate limited");
    });
    const result = await previewLink("website", "https://provider.com");
    expect(result.name).toBe("Provider");
    expect(result.logoUrl).toBeTruthy();
    expect(result.websitePreviewUrl).toBeNull();
    expect(result.complete).toBe(false);
  });
  it("does not fill a challenge screen's title as the provider name", async () => {
    state.fetch.mockResolvedValue({
      url: "https://provider.com",
      body: Buffer.from(
        "<title>Just a moment...</title><div>Checking your browser</div>"
      ),
      contentType: "text/html",
    });
    const result = await previewLink("website", "https://provider.com");
    expect(result.name).toBeNull();
    expect(result.issue).toBe("protected");
    expect(result.websitePreviewUrl).toBeNull();
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });
  it("returns a useful reason when a provider blocks metadata or times out", async () => {
    for (const issue of ["protected", "timeout", "source_busy"] as const) {
      state.fetch.mockRejectedValue(new Error(`metadata_${issue}`));
      const result = await previewLink("website", "https://provider.com/");
      expect(result).toMatchObject({
        issue,
        complete: false,
        logoUrl: null,
        websitePreviewUrl: null,
      });
    }
  });
  it("refreshes metadata produced by the old logo parser instead of serving its cached blank image", async () => {
    const result = await previewLink("website", "https://provider.com/");
    state.cached = [
      {
        payload: {
          ...result,
          parserVersion: undefined,
          name: "Old cached name",
        },
      },
    ];
    state.fetch.mockClear();
    expect((await previewLink("website", "https://provider.com/")).name).toBe(
      "Provider"
    );
    expect(state.fetch).toHaveBeenCalled();
  });
  it("lets AI suggest only topic/language and keeps Telegram's observed audience", async () => {
    const result = await previewLink("telegram", "https://t.me/provider_group");
    expect(result).toMatchObject({
      name: "Provider community",
      topic: "learning",
      language: "en",
      audience: { count: 1234, kind: "members", approximate: false },
      aiSuggested: true,
    });
    expect(state.model.mock.calls[0][3]).toBe(
      JSON.stringify({
        name: "Provider community",
        description: "Learn about comparing service providers.",
      })
    );
    expect(result.avatarUrl).toContain("/api/imported-media/");
    expect(result.avatarUrl).not.toContain("token=");
  });
  it("works without an AI key and tolerates private or broken links without fabricated fields", async () => {
    state.available = false;
    const result = await previewLink("telegram", "https://t.me/provider_group");
    expect(result.name).toBe("Provider community");
    expect(result.topic).toBeNull();
    expect(result.aiSuggested).toBe(false);
    expect(state.model).not.toHaveBeenCalled();
    state.fetch.mockRejectedValue(new Error("private or unavailable"));
    const missing = await previewLink("telegram", "https://t.me/+ABcdEFg123");
    expect(missing).toMatchObject({
      name: null,
      description: null,
      audience: null,
      avatarUrl: null,
      complete: false,
    });
  });
  it("reuses cached metadata without repeated screenshots, source requests, or AI charges", async () => {
    const result = await previewLink("telegram", "https://t.me/provider_group");
    state.cached = [{ payload: result }];
    state.fetch.mockClear();
    state.model.mockClear();
    state.budget.mockClear();
    expect(
      await previewLink("telegram", "https://telegram.me/Provider_Group/")
    ).toEqual(result);
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.model).not.toHaveBeenCalled();
    expect(state.budget).not.toHaveBeenCalled();
  });
});
