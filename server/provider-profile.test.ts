import { describe, expect, it } from "vitest";
import {
  publicProfileUrl,
  providerTelegramUrl,
  providerProfileInput,
} from "../shared/providerProfile";

const input = {
  id: 1,
  revision: 1,
  name: "Provider",
  description: "Details",
  websiteUrl: "https://provider.example",
  logoUrl: null,
  websitePreviewUrl: null,
  telegramUrl: null,
};
describe("public provider identity input", () => {
  it("normalizes HTTPS links, Telegram handles and clearing optional fields", () => {
    expect(
      providerProfileInput.parse({
        ...input,
        name: "  Provider  ",
        description: "  ",
        logoUrl: "",
        websitePreviewUrl: " ",
        telegramUrl: "@ProviderSupport",
      })
    ).toEqual({
      ...input,
      description: "",
      websiteUrl: "https://provider.example/",
      telegramUrl: "https://t.me/providersupport",
    });
    expect(providerTelegramUrl("https://telegram.me/ProviderChannel/")).toBe(
      "https://t.me/providerchannel"
    );
    expect(providerTelegramUrl("https://t.me/joinchat/Abc123_token")).toBe(
      "https://t.me/+Abc123_token"
    );
  });
  it("accepts permanent image links without relying on a filename extension", () => {
    expect(publicProfileUrl("https://cdn.provider.example/images/logo")).toBe(
      "https://cdn.provider.example/images/logo"
    );
    expect(publicProfileUrl("https://provider.example/media/website.png")).toBe(
      "https://provider.example/media/website.png"
    );
  });
  it("rejects credential URLs, active schemes, private destinations and signed/query URLs", () => {
    for (const value of [
      "javascript:alert(1)",
      "data:image/svg+xml,x",
      "http://provider.example",
      "https://key:secret@provider.example",
      "https://localhost/logo.png",
      "https://127.0.0.1",
      "https://2130706433",
      "https://[::1]",
      "https://host.internal",
      "https://provider.example/?api_key=secret",
      "https://provider.example/#token",
      "https://provider.example:8443",
      "https://provider.example/\\evil",
      "https://provider.example/\nlogo.png",
    ]) {
      expect(publicProfileUrl(value), value).toBeNull();
      expect(
        providerProfileInput.safeParse({ ...input, logoUrl: value }).success,
        value
      ).toBe(false);
    }
  });
  it("rejects lookalike Telegram hosts and non-contact Telegram actions", () => {
    for (const value of [
      "https://t.me.evil.example/Provider",
      "https://example.com/Provider",
      "https://t.me/proxy",
      "https://t.me/login",
      "https://t.me/Provider/123",
      "https://t.me/Provider?start=token",
      "https://t.me/+1234567890",
      "@a",
    ])
      expect(providerTelegramUrl(value), value).toBeNull();
  });
  it("only accepts public fields and keeps bounded text", () => {
    for (const field of [
      "apiKey",
      "credentialCiphertext",
      "status",
      "verified",
      "score",
      "apiCataloguePublished",
      "providerId",
    ]) {
      expect(
        providerProfileInput.safeParse({ ...input, [field]: "not-allowed" })
          .success,
        field
      ).toBe(false);
    }
    expect(
      providerProfileInput.safeParse({
        ...input,
        description: "x".repeat(2001),
      }).success
    ).toBe(false);
    expect(
      providerProfileInput.safeParse({ ...input, name: " " }).success
    ).toBe(false);
    expect(
      providerProfileInput.safeParse({
        ...input,
        logoUrl: `https://example.com/${"x".repeat(500)}`,
      }).success
    ).toBe(false);
  });
});
