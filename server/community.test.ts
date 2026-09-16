import { describe, expect, it } from "vitest";
import {
  groupInput,
  groupLink,
  groupReviewInput,
  providerGroupEvidence,
} from "../shared/community";
import { hasPermission } from "./authorization";

describe("community link and publication boundaries", () => {
  it("canonicalizes supported invitations without changing case-sensitive invite codes", () => {
    expect(groupLink("https://telegram.me/Example_Group/")).toEqual({
      platform: "telegram",
      url: "https://t.me/example_group",
    });
    expect(groupLink("https://t.me/joinchat/AbC_deF12345")).toEqual(
      groupLink("https://t.me/+AbC_deF12345")
    );
    expect(groupLink("https://t.me/+AbC_deF12345")).not.toEqual(
      groupLink("https://t.me/+abc_def12345")
    );
    expect(
      groupLink("https://chat.whatsapp.com/AbCdEf1234567890123456")
    ).toMatchObject({ platform: "whatsapp" });
    expect(
      groupLink("https://chat.whatsapp.com/AbCdEf1234567890123456?mode=ac_t")
    ).toEqual({
      platform: "whatsapp",
      url: "https://chat.whatsapp.com/AbCdEf1234567890123456",
    });
    expect(groupLink("https://discord.com/invite/Beacon_Test")).toEqual({
      platform: "discord",
      url: "https://discord.gg/Beacon_Test",
    });
  });
  it("rejects deceptive hosts, executable URLs, personal phone links, bots and actions", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://t.me/example_group",
      "https://t.me.evil.example/example_group",
      "https://t.me@evil.example/example_group",
      "https://user:secret@t.me/example_group",
      "https://t.me:8443/example_group",
      "https://t.me/example_group?start=send",
      "https://t.me/example_group#message",
      "https://t.me/+123456789012",
      "https://t.me/joinchat/123456789012",
      "https://t.me/examplebot",
      "https://t.me/share",
      "https://t.me/addstickers/test",
      "https://t.me/example_group/123",
      "https://t.me/%65xample_group",
      "https://wa.me/1234567890",
      "https://whatsapp.com/AbCdEf1234567890123456",
      "https://chat.whatsapp.com/AbCdEf1234567890123456?mode=ac_t&redirect=evil",
      "https://chat.whatsapp.com/AbCdEf1234567890123456?redirect=evil",
      "https://chat.whatsapp.com/AbCdEf1234567890123456?mode=",
      "https://discord.com/users/123",
      "https://discord.gg/test?redirect=evil",
      "https://t.me\\@evil.example/example_group",
      "https://127.0.0.1/example_group",
    ])
      expect(groupLink(url), url).toBeNull();
  });
  it("requires an exact provider website source, excluding credentials and third-party subdomains", () => {
    expect(
      providerGroupEvidence(
        "https://www.provider.example/community",
        "https://provider.example"
      )
    ).toBe("https://www.provider.example/community");
    for (const source of [
      "https://provider.example.evil.test/group",
      "https://other.provider.example/group",
      "http://provider.example/group",
      "https://user:password@provider.example/group",
      "https://provider.example:8443/group",
      "javascript:alert(1)",
    ])
      expect(
        providerGroupEvidence(source, "https://provider.example")
      ).toBeNull();
    expect(
      providerGroupEvidence("https://provider.example/group", null)
    ).toBeNull();
  });
  it("does not allow a submitter to choose publication state or manufacture review evidence", () => {
    const input = {
      name: "A real group",
      description: "Discussion of providers and their services",
      url: "https://t.me/example_group",
      topic: "providers",
      language: "ar",
    };
    expect(groupInput.safeParse(input).success).toBe(true);
    for (const extra of [
      { status: "approved" },
      { reviewedAt: new Date() },
      { submittedBy: 99 },
      { platform: "telegram" },
      { revision: 9 },
    ])
      expect(groupInput.safeParse({ ...input, ...extra }).success).toBe(false);
    expect(
      groupReviewInput.safeParse({
        id: 1,
        revision: 1,
        decision: "approved",
        note: "Reviewed group destination",
      }).success
    ).toBe(false);
    expect(
      groupReviewInput.safeParse({
        id: 1,
        revision: 1,
        decision: "rejected",
        note: "This is a personal profile",
      }).success
    ).toBe(true);
  });
  it("limits moderation to the appropriate staff roles", () => {
    for (const role of [
      "owner",
      "administrator",
      "operations_manager",
      "provider_reviewer",
    ] as const)
      expect(hasPermission(role, "groups.review")).toBe(true);
    for (const role of [
      null,
      "catalogue_editor",
      "translation_manager",
      "auditor",
    ] as const)
      expect(hasPermission(role, "groups.review")).toBe(false);
    expect(hasPermission("auditor", "groups.read")).toBe(true);
  });
});
