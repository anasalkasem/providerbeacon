import { z } from "zod";

export const groupPlatforms = ["telegram", "whatsapp", "discord"] as const;
export const groupTopics = [
  "providers",
  "offers",
  "support",
  "learning",
] as const;
export const groupLanguages = [
  "ar",
  "en",
  "es",
  "hi",
  "zh",
  "multi",
  "other",
] as const;
export const groupStatuses = [
  "pending",
  "approved",
  "rejected",
  "hidden",
] as const;
export const reportReasons = ["broken", "unrelated", "spam", "other"] as const;
export type GroupPlatform = (typeof groupPlatforms)[number];
export type CommunityKind = "group" | "channel" | "server";

// No redirects or network requests: validation identifies an allowed link format,
// never whether its destination is a group. Publication needs a staff review.
export function groupLink(
  raw: string
): { url: string; platform: GroupPlatform } | null {
  const value = raw.trim();
  if (value.length > 500 || /[\s\\%]/.test(value)) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash)
      return null;
    const path = u.pathname.replace(/\/$/, "");
    const whatsappChannel =
      ["whatsapp.com", "www.whatsapp.com"].includes(u.hostname) &&
      /^\/channel\/[A-Za-z0-9]{16,128}$/.test(path);
    // Share mode and channel UI language do not change the community identity.
    // Do not accept arbitrary query actions, post links or personal chats.
    if (
      u.search &&
      !(
        (u.hostname === "chat.whatsapp.com" &&
          /^\?mode=[A-Za-z0-9_-]{1,32}$/.test(u.search)) ||
        (whatsappChannel &&
          /^\?lang=[a-z]{2,3}(?:[_-][A-Za-z]{2,4})?$/.test(u.search))
      )
    )
      return null;
    if (whatsappChannel)
      return { platform: "whatsapp", url: `https://www.whatsapp.com${path}` };
    if (["t.me", "telegram.me"].includes(u.hostname)) {
      const invite = path.match(/^\/(?:\+|joinchat\/)([A-Za-z0-9_-]{8,128})$/);
      if (invite && !/^\d+$/.test(invite[1]))
        return { platform: "telegram", url: `https://t.me/+${invite[1]}` };
      const name = path.slice(1).toLowerCase();
      const reserved = [
        "addemoji",
        "addlist",
        "addstickers",
        "addstyle",
        "addtheme",
        "auction",
        "auth",
        "boost",
        "call",
        "confirmphone",
        "contact",
        "giftcode",
        "invoice",
        "joinchat",
        "login",
        "proxy",
        "setlanguage",
        "share",
        "socks",
        "web",
      ];
      if (
        /^[a-z][a-z0-9_]{3,31}$/.test(name) &&
        !reserved.includes(name) &&
        !name.endsWith("bot")
      )
        return { platform: "telegram", url: `https://t.me/${name}` };
    }
    if (
      u.hostname === "chat.whatsapp.com" &&
      /^\/[A-Za-z0-9]{16,128}$/.test(path)
    )
      return { platform: "whatsapp", url: `https://chat.whatsapp.com${path}` };
    const discord =
      u.hostname === "discord.gg"
        ? path.match(/^\/([A-Za-z0-9_-]{2,100})$/)
        : u.hostname === "discord.com"
          ? path.match(/^\/invite\/([A-Za-z0-9_-]{2,100})$/)
          : null;
    if (discord)
      return { platform: "discord", url: `https://discord.gg/${discord[1]}` };
  } catch {
    /* Invalid URL */
  }
  return null;
}

// A Telegram username alone cannot distinguish a group from a channel.
// Use observed audience metadata there, and exact URL formats for WhatsApp.
export function communityKind(
  raw: string,
  audienceKind?: string | null
): CommunityKind | null {
  const link = groupLink(raw);
  if (!link) return null;
  if (link.platform === "whatsapp")
    return new URL(link.url).pathname.startsWith("/channel/")
      ? "channel"
      : "group";
  if (link.platform === "discord") return "server";
  if (audienceKind === "subscribers") return "channel";
  if (audienceKind === "members") return "group";
  return null;
}

export function providerGroupEvidence(
  raw: string,
  website: string | null
): string | null {
  try {
    const source = new URL(raw);
    const provider = new URL(website ?? "");
    const host = (u: URL) => u.hostname.replace(/^www\./, "");
    if (
      source.protocol !== "https:" ||
      source.username ||
      source.password ||
      source.port ||
      source.hash ||
      /[\s\\]/.test(raw) ||
      source.href.length > 500 ||
      host(source) !== host(provider)
    )
      return null;
    return source.href;
  } catch {
    return null;
  }
}

export const groupInput = z
  .object({
    metadataKey: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    name: z.string().trim().min(3).max(100),
    description: z.string().trim().min(20).max(600),
    url: z
      .string()
      .trim()
      .max(500)
      .refine(value => Boolean(groupLink(value)), "groups_invalid_link"),
    topic: z.enum(groupTopics),
    language: z.enum(groupLanguages),
    providerId: z.number().int().positive().nullable().default(null),
    evidenceUrl: z.string().trim().max(500).default(""),
  })
  .strict();
export type GroupInput = z.infer<typeof groupInput>;
export const groupEditInput = groupInput.extend({
  id: z.number().int().positive(),
  revision: z.number().int().positive(),
});
export const groupListInput = z
  .object({
    q: z.string().trim().max(100).default(""),
    platform: z.enum(groupPlatforms).optional(),
    topic: z.enum(groupTopics).optional(),
    language: z.enum(groupLanguages).optional(),
    providerId: z.number().int().positive().optional(),
    cursor: z.number().int().positive().optional(),
  })
  .strict();
export const groupReviewInput = z
  .object({
    id: z.number().int().positive(),
    revision: z.number().int().positive(),
    decision: z.enum(["approved", "rejected", "hidden"]),
    note: z.string().trim().min(8).max(600),
    groupConfirmed: z.boolean().default(false),
    providerConfirmed: z.boolean().default(false),
  })
  .strict()
  .refine(
    v => v.decision !== "approved" || v.groupConfirmed,
    "groups_review_required"
  );
export const groupReportInput = z
  .object({
    id: z.number().int().positive(),
    reason: z.enum(reportReasons),
    note: z.string().trim().max(500).default(""),
  })
  .strict();
