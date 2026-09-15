import { describe, expect, it } from "vitest";
import {
  fillSuggested,
  websiteHome,
  telegramPreviewInput,
} from "../shared/linkMetadata";
import { groupInput } from "../shared/community";
import { metadataUrl, publicAddress } from "./publicMetadataFetch";
import {
  parseAudience,
  parseTelegram,
  parseWebsite,
  safeImage,
  sanitizeSvg,
} from "./linkMetadataParse";

describe("source metadata extraction", () => {
  it("recognizes a header logo with an opaque filename and a lazy placeholder", () => {
    const result = parseWebsite(
      '<div class="header"><a href="/"><div class="site-name"><img src="/placeholder.gif" data-src="https://cdn.com/opaque.png" alt="provider.com"></div></a></div><link rel="icon" href="/icon.png">',
      "https://provider.com/"
    );
    expect(result.logos.slice(0, 3)).toEqual([
      "https://cdn.com/opaque.png",
      "https://provider.com/placeholder.gif",
      "https://provider.com/icon.png",
    ]);
  });
  it("uses explicit logo sources and never mislabels a social banner as a screenshot", () => {
    const page = parseWebsite(
      `<html><head><title>Provider Home</title>
      <meta property="og:site_name" content="Beacon &amp; Partners"><meta name="description" content="Our public description">
      <meta property="og:image" content="/sale-banner.jpg"><script type="application/ld+json">{"@type":"Organization","logo":{"url":"/assets/company.svg"}}</script>
      <link rel="apple-touch-icon" href="/icon.png"></head><body><img class="logo" src="/logo.png?version=2"><a href="https://t.me/ProviderSupport">Support</a>
      <script>alert('do not execute')</script></body></html>`,
      "https://provider.com/"
    );
    expect(page.name).toBe("Beacon & Partners");
    expect(page.description).toBe("Our public description");
    expect(page.logos[0]).toBe("https://provider.com/assets/company.svg");
    expect(page.logos).toContain("https://provider.com/logo.png?version=2");
    expect(page.logos).not.toContain("https://provider.com/sale-banner.jpg");
    expect(page).not.toHaveProperty("websitePreviewUrl");
    expect(page.telegramUrl).toBe("https://t.me/providersupport");
  });
  it("reads only visible group facts, preserving signed avatar URLs for server-side caching", () => {
    const result = parseTelegram(
      `<div class="tgme_page_title"><span>Provider &amp; Friends</span></div>
      <div class="tgme_page_extra">12 345 members, 102 online</div><div class="tgme_page_description">Offers<br>for providers<script>invent 9999 members</script></div>
      <img class="tgme_page_photo_image" src="https://cdn.telegram.org/group.jpg?token=public-source">`,
      "https://t.me/provider_group"
    );
    expect(result).toEqual({
      name: "Provider & Friends",
      description: "Offers for providers",
      avatar: "https://cdn.telegram.org/group.jpg?token=public-source",
      audience: { count: 12345, kind: "members", approximate: false },
    });
  });
  it("distinguishes subscribers and rounded counts from exact member counts", () => {
    expect(parseAudience("1.2M subscribers")).toEqual({
      count: 1200000,
      kind: "subscribers",
      approximate: true,
    });
    expect(parseAudience("20,125 members, 991 online")).toEqual({
      count: 20125,
      kind: "members",
      approximate: false,
    });
    expect(parseAudience("0 members")).toMatchObject({ count: 0 });
    expect(parseAudience("@someone")).toBeNull();
    expect(parseAudience("3000000000 members")).toBeNull();
  });
  it("does not invent group facts for private, expired, generic, or personal links", () => {
    for (const html of [
      "",
      "<title>Telegram: Join Group Chat</title>",
      '<div class="tgme_page_title">Alice</div><div class="tgme_page_extra">@alice</div><div class="tgme_page_description">Message me</div>',
    ]) {
      const result = parseTelegram(html, "https://t.me/provider_group");
      expect(result).toEqual({
        name: null,
        description: null,
        avatar: null,
        audience: null,
      });
    }
    const partial = parseTelegram(
      '<div class="tgme_page_title">Private community</div>',
      "https://t.me/+ABcdefGH123"
    );
    expect(partial.name).toBe("Private community");
    expect(partial.audience).toBeNull();
  });
  it("removes executable SVG, external loads and CSS while retaining actual artwork", () => {
    const safe =
      sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" onload="alert(1)">
      <script>alert(1)</script><foreignObject><iframe src="https://evil.com"></iframe></foreignObject>
      <image href="https://evil.com/pixel"/><style>@import 'https://evil.com'</style>
      <path d="M0 0H20V20Z" style="fill: #00f; stroke: url(https://evil.com)"/><use href="https://evil.com/a.svg#x"/>
      <circle r="8" fill="url(#gradient)"/></svg>`)?.toString();
    expect(safe).toContain('viewBox="0 0 64 64"');
    expect(safe).toContain('fill="#00f"');
    expect(safe).toContain('fill="url(#gradient)"');
    for (const unsafe of [
      "script",
      "onload",
      "iframe",
      "foreignObject",
      "evil.com",
      "style=",
      "@import",
    ])
      expect(safe).not.toContain(unsafe);
    expect(
      sanitizeSvg(
        '<!DOCTYPE svg [<!ENTITY a SYSTEM "file:///etc/passwd">]><svg/>'
      )
    ).toBeNull();
    expect(
      safeImage(
        Buffer.from("<html><script>alert(1)</script></html>"),
        "image/png"
      )
    ).toBeNull();
    expect(safeImage(Buffer.alloc(1048577), "image/png")).toBeNull();
  });
});

describe("metadata boundaries", () => {
  it("accepts only public HTTPS source URLs and globally routable DNS answers", () => {
    for (const ip of [
      "127.0.0.1",
      "10.4.0.1",
      "169.254.169.254",
      "192.168.1.2",
      "100.64.0.1",
      "198.19.0.1",
      "224.0.0.1",
      "::1",
      "fc00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "2001:db8::1",
      "2002:7f00:1::1",
    ])
      expect(publicAddress(ip), ip).toBe(false);
    for (const ip of ["93.184.216.34", "149.154.167.99", "2606:4700::1111"])
      expect(publicAddress(ip), ip).toBe(true);
    for (const raw of [
      "http://provider.com",
      "https://user:key@provider.com",
      "https://127.0.0.1",
      "https://2130706433",
      "https://[::1]",
      "https://localhost",
      "https://internal.local/a",
      "file:///etc/passwd",
      "https://provider.com:8080",
      "https://provider.com/\\evil",
      "https://provider.com/\nfoo",
    ])
      expect(() => metadataUrl(raw), raw).toThrow();
    expect(websiteHome("https://provider.com/services")).toBe(
      "https://provider.com/"
    );
    expect(websiteHome("https://provider.com/?key=secret")).toBeNull();
  });
  it("does not accept client-manufactured audience, photo, or verification metadata", () => {
    const input = {
      name: "Provider group",
      description: "A group for discussions about providers",
      url: "https://t.me/provider_group",
      topic: "providers",
      language: "en",
    };
    expect(
      groupInput.safeParse({ ...input, metadataKey: "a".repeat(64) }).success
    ).toBe(true);
    for (const extra of [
      { audience: { count: 9999 } },
      { linkMetadata: {} },
      { avatarUrl: "https://evil.com/pixel" },
      { status: "approved" },
    ])
      expect(groupInput.safeParse({ ...input, ...extra }).success).toBe(false);
    expect(
      telegramPreviewInput.safeParse({
        url: "https://t.me/provider_group",
        apiKey: "secret",
      }).success
    ).toBe(false);
  });
  it("preserves manual changes, including fields deliberately cleared while fetching", () => {
    const original = {
      name: "Automatic old name",
      description: "Manually written",
      logo: "",
    };
    expect(
      fillSuggested(
        original,
        {
          name: "New suggestion",
          description: "Unwanted overwrite",
          logo: "new image",
        },
        { name: original.name },
        new Set(["description", "logo"])
      )
    ).toEqual({
      name: "New suggestion",
      description: "Manually written",
      logo: "",
    });
  });
});
