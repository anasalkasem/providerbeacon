import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  budget: vi.fn(),
  model: vi.fn(),
  available: true,
  cached: [] as any[],
  writes: [] as any[],
  repair: vi.fn(),
}));
vi.mock("./publicMetadataFetch", async original => ({
  ...(await original<any>()),
  fetchPublicMetadata: state.fetch,
  resolveMetadataUrl: vi.fn(async () => ({})),
}));
vi.mock("./memberDb", () => ({ reserveMemberRequests: state.budget }));
vi.mock("./importedLogoRepair", () => ({ repairImportedLogo: state.repair }));
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
import { previewLink } from "./linkMetadata";

const png = await sharp(
  Buffer.from(
    '<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><path fill="#245acc" d="M8 8h48v48H8z"/></svg>'
  )
)
  .png()
  .toBuffer();
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
    expect(result.websitePreviewUrl).toBeNull();
    expect(state.fetch).toHaveBeenCalledTimes(1);
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
    state.cached = [
      { payload: result, expiresAt: new Date(Date.now() + 3600000) },
    ];
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
  it("rejects a blank first logo and continues to a working source image", async () => {
    const fallback = state.fetch.getMockImplementation()!;
    state.fetch.mockImplementation(async (url, options) =>
      url.includes("/logo.png")
        ? {
            url,
            contentType: "image/svg+xml",
            body: Buffer.from(
              '<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="none"/></svg>'
            ),
          }
        : fallback(url, options)
    );
    const result = await previewLink("website", "https://provider.com");
    expect(result.logoUrl).toBeTruthy();
    expect(
      state.fetch.mock.calls.some(([url]) => url.endsWith("/favicon.ico"))
    ).toBe(true);
  });
  it("upgrades legacy logos and retains an already captured homepage without a second screenshot charge", async () => {
    const old = {
      ...(await previewLink("website", "https://provider.com")),
      version: undefined,
    };
    state.cached = [
      { payload: old, expiresAt: new Date(Date.now() + 86400000) },
    ];
    state.fetch.mockClear();
    state.budget.mockClear();
    const next = await previewLink("website", "https://provider.com");
    expect(next.version).toBe(2);
    expect(next.websitePreviewUrl).toBe(old.websitePreviewUrl);
    expect(
      state.fetch.mock.calls.some(([url]) => url.includes("thum.io"))
    ).toBe(false);
    expect(state.repair).toHaveBeenCalledWith(old, next);
  });
  it("reports restricted sources honestly and never captures a challenge page as a website", async () => {
    state.fetch.mockRejectedValue(new Error("metadata_restricted"));
    const result = await previewLink("website", "https://provider.com");
    expect(result).toMatchObject({
      issue: "restricted",
      complete: false,
      logoUrl: null,
      websitePreviewUrl: null,
    });
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });
  it("allows an explicit refresh after the cooldown rather than returning a stale failure", async () => {
    const old = {
      ...(await previewLink("website", "https://provider.com")),
      fetchedAt: new Date(Date.now() - 60000).toISOString(),
      logoUrl: null,
      complete: false,
    };
    state.cached = [{ payload: old, expiresAt: new Date(Date.now() + 300000) }];
    state.fetch.mockClear();
    expect(
      (await previewLink("website", "https://provider.com")).logoUrl
    ).toBeNull();
    expect(state.fetch).not.toHaveBeenCalled();
    expect(
      (await previewLink("website", "https://provider.com", { refresh: true }))
        .logoUrl
    ).toBeTruthy();
  });
});
