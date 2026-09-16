import { describe, expect, it } from "vitest";
import {
  fillSuggested,
  websiteHome,
  telegramPreviewInput,
  groupPreviewInput,
} from "../shared/linkMetadata";
import { groupInput } from "../shared/community";
import { metadataUrl, publicAddress } from "./publicMetadataFetch";
import {
  parseAudience,
  parseTelegram,
  parseWhatsApp,
  parseDiscordInvite,
  parseWebsite,
  safeImage,
  sanitizeSvg,
} from "./linkMetadataParse";

describe("source metadata extraction", () => {
  it("reads WhatsApp channel headings and follower counts without scraping the update feed", () => {
    const source = "https://www.whatsapp.com/channel/0029Va4K0PZ5a245NkngBA2M";
    const html = `<meta property="og:url" content="${source}/?lang=en">
      <meta property="og:title" content="WhatsApp - WhatsApp channel"><meta property="og:image" content="https://pps.whatsapp.net/channel.jpg">
      <meta property="og:description" content="Follow WhatsApp channel on WhatsApp">
      <h1>WhatsApp</h1><h5>Feature launches &amp; updates<script>do not copy</script></h5>
      <h5>Channel • 234M followers</h5><h2>Latest updates</h2><h5>Channel • 999M followers</h5>`;
    expect(parseWhatsApp(html, source)).toEqual({
      name: "WhatsApp",
      description: "Feature launches & updates",
      avatar: "https://pps.whatsapp.net/channel.jpg",
      audience: { count: 234000000, kind: "followers", approximate: true },
    });
    expect(
      parseWhatsApp(
        `<meta property="og:url" content="${source}"><h1>Provider updates</h1><h5></h5><h5>Channel · 1,234 followers</h5>`,
        source
      )
    ).toMatchObject({
      name: "Provider updates",
      description: null,
      audience: { count: 1234, kind: "followers", approximate: false },
    });
    expect(
      parseWhatsApp(
        `<meta property="og:url" content="${source}"><h1>Provider updates</h1><h5>News for providers</h5><h2>Latest updates</h2><h5>Channel • 9M followers</h5>`,
        source
      )
    ).toMatchObject({
      name: "Provider updates",
      description: "News for providers",
      audience: null,
    });
  });
  it("keeps unavailable channels empty and accepts only identified channel metadata as fallback", () => {
    const source = "https://www.whatsapp.com/channel/0029Va4K0PZ5a245NkngBA2M";
    for (const html of [
      "",
      "<h1>WhatsApp Channels</h1><h5>Download WhatsApp</h5>",
      `<meta property="og:url" content="${source}"><h1>This channel is not available</h1>`,
      "<h1>Something went wrong</h1><h5>Try again later</h5>",
    ])
      expect(parseWhatsApp(html, source)).toEqual({
        name: null,
        description: null,
        avatar: null,
        audience: null,
      });
    expect(
      parseWhatsApp(
        '<meta property="og:title" content="Provider updates – WhatsApp channel"><meta property="og:description" content="Follow Provider updates WhatsApp channel">',
        source
      )
    ).toMatchObject({
      name: "Provider updates",
      description: null,
      audience: null,
    });
    expect(() =>
      parseWhatsApp("<title>Just a moment…</title>", source)
    ).toThrow("metadata_protected");
  });
  it("reads WhatsApp's public invitation facts without inventing a member count or copying generic instructions", () => {
    const source = "https://chat.whatsapp.com/AbCdEf1234567890123456";
    expect(
      parseWhatsApp(
        '<meta property="og:title" content="Provider &amp; Friends"><meta property="og:description" content="A public description of our provider community"><meta property="og:image" content="https://pps.whatsapp.net/avatar.jpg?token=public">',
        source
      )
    ).toEqual({
      name: "Provider & Friends",
      description: "A public description of our provider community",
      avatar: "https://pps.whatsapp.net/avatar.jpg?token=public",
      audience: null,
    });
    expect(
      parseWhatsApp(
        '<meta property="og:title" content="Provider group"><meta property="og:description" content="Follow this link to join my WhatsApp group">',
        source
      )
    ).toMatchObject({
      name: "Provider group",
      description: null,
      audience: null,
    });
    for (const html of [
      "",
      "<title>Invalid invitation</title>",
      '<meta property="og:title" content="WhatsApp Group Invite"><meta property="og:description" content="Follow this link to join"><meta property="og:image" content="/generic.png">',
    ])
      expect(parseWhatsApp(html, source)).toEqual({
        name: null,
        description: null,
        avatar: null,
        audience: null,
      });
    expect(() =>
      parseWhatsApp("<title>Just a moment…</title>", source)
    ).toThrow("metadata_protected");
  });
  it("uses Discord's matching guild invitation and marks its member count as approximate", () => {
    const invite = {
      type: 0,
      code: "Beacon_Test",
      guild: {
        id: "123456789012345678",
        name: "Provider community",
        description: "Discuss provider services here",
        icon: "a_" + "b".repeat(32),
      },
      approximate_member_count: 1200,
      approximate_presence_count: 30,
    };
    expect(parseDiscordInvite(invite, "Beacon_Test")).toEqual({
      name: "Provider community",
      description: "Discuss provider services here",
      avatar:
        "https://cdn.discordapp.com/icons/123456789012345678/a_" +
        "b".repeat(32) +
        ".png?size=256",
      audience: { count: 1200, kind: "members", approximate: true },
    });
    for (const invalid of [
      null,
      { message: "Unknown Invite", code: 10006 },
      { ...invite, type: 1 },
      { ...invite, type: 2 },
      { ...invite, code: "another" },
    ])
      expect(parseDiscordInvite(invalid, "Beacon_Test")).toEqual({
        name: null,
        description: null,
        avatar: null,
        audience: null,
      });
    expect(
      parseDiscordInvite(
        {
          ...invite,
          approximate_member_count: "9000",
          guild: { ...invite.guild, icon: "https://evil.com/pixel" },
        },
        "Beacon_Test"
      )
    ).toMatchObject({
      name: "Provider community",
      avatar: null,
      audience: null,
    });
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
    expect(parseAudience("4.3M followers")).toEqual({
      count: 4300000,
      kind: "followers",
      approximate: true,
    });
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
      <defs><linearGradient id="gradient"><stop offset="0" stop-color="#00f"/></linearGradient></defs>
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
  it("finds the provider's header image before a favicon even when the image has no logo label", () => {
    const page = parseWebsite(
      '<div class="header"><a href="/"><div class="site-name"><img src="/brand-image.png" alt="provider.com"></div></a></div><img src="/sale.png"><link rel="icon" href="/favicon.ico">',
      "https://provider.com/"
    );
    expect(page.logos[0]).toBe("https://provider.com/brand-image.png");
    expect(page.logos).not.toContain("https://provider.com/sale.png");
  });
  it("preserves raster artwork embedded in SVG patterns and refuses empty paint references", () => {
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6YwAAAABJRU5ErkJggg==";
    const source = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><rect width="131" height="59" fill="url(#pattern0)"/><defs><pattern id="pattern0" patternContentUnits="objectBoundingBox" width="1" height="1"><use xlink:href="#image0"/></pattern><image id="image0" width="1" height="1" xlink:href="data:image/png;base64,${png}"/></defs></svg>`;
    const safe = sanitizeSvg(source)?.toString();
    expect(safe).toContain('<pattern id="pattern0"');
    expect(safe).toContain('href="#image0"');
    expect(safe).toContain(`href="data:image/png;base64,${png}"`);
    expect(
      sanitizeSvg(
        '<svg><rect width="131" height="59" fill="url(#missing)"/><defs/></svg>'
      )
    ).toBeNull();
    expect(
      sanitizeSvg(
        source.replace(
          `data:image/png;base64,${png}`,
          "https://evil.com/tracker.png"
        )
      )
    ).toBeNull();
    expect(
      sanitizeSvg(
        source.replace(
          `data:image/png;base64,${png}`,
          `data:image/png;base64,${Buffer.from('<svg onload="alert(1)"/>').toString("base64")}`
        )
      )
    ).toBeNull();
  });
});

describe("metadata boundaries", () => {
  it("accepts all supported invitation platforms on the group preview endpoint, excluding personal chats and extra fields", () => {
    for (const url of [
      "https://t.me/provider_group",
      "https://chat.whatsapp.com/AbCdEf1234567890123456?mode=ac_t",
      "https://whatsapp.com/channel/0029Va4K0PZ5a245NkngBA2M/?lang=en",
      "https://discord.com/invite/Beacon_Test",
    ])
      expect(groupPreviewInput.safeParse({ url }).success, url).toBe(true);
    for (const url of [
      "https://wa.me/1234567890",
      "https://discord.com/users/123",
      "https://example.com/group",
    ])
      expect(groupPreviewInput.safeParse({ url }).success, url).toBe(false);
    expect(
      groupPreviewInput.safeParse({
        url: "https://discord.gg/Beacon_Test",
        token: "secret",
      }).success
    ).toBe(false);
  });
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
