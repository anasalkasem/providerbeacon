import { z } from "zod";

/** Public profile URLs must be permanent links, never signed or credential URLs. */
export function publicProfileUrl(
  raw: string | null | undefined
): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  if (value.length > 500 || /[\s\\\x00-\x1f\x7f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    )
      return null;
    // Only public DNS names. Reject IP literals, single-label and local hostnames.
    const host = url.hostname.toLowerCase();
    if (
      !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ||
      /\.(?:localhost|local|internal|invalid|test)$/.test(host)
    )
      return null;
    return url.href.length <= 500 ? url.href : null;
  } catch {
    return null;
  }
}

const reservedTelegramPaths = new Set([
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
]);
export function providerTelegramUrl(
  raw: string | null | undefined
): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  const candidate = value.startsWith("@")
    ? `https://t.me/${value.slice(1)}`
    : value;
  const safe = publicProfileUrl(candidate);
  if (!safe) return null;
  const url = new URL(safe);
  if (!["t.me", "telegram.me"].includes(url.hostname)) return null;
  const path = url.pathname.replace(/\/$/, "").slice(1);
  if (
    /^[a-z][a-z0-9_]{3,31}$/i.test(path) &&
    !reservedTelegramPaths.has(path.toLowerCase())
  ) {
    return `https://t.me/${path.toLowerCase()}`;
  }
  const invite = path.match(/^(?:\+|joinchat\/)([a-zA-Z0-9_-]{8,128})$/);
  return invite && !/^\d+$/.test(invite[1])
    ? `https://t.me/+${invite[1]}`
    : null;
}

const optionalUrl = (normalize: typeof publicProfileUrl) =>
  z
    .string()
    .trim()
    .max(500)
    .nullable()
    .refine(value => !value || normalize(value) !== null, "PROFILE_INVALID_URL")
    .transform(value => normalize(value));

export const providerProfileInput = z
  .object({
    id: z.number().int().positive(),
    revision: z.number().int().positive(),
    name: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000),
    websiteUrl: optionalUrl(publicProfileUrl),
    logoUrl: optionalUrl(publicProfileUrl),
    websitePreviewUrl: optionalUrl(publicProfileUrl),
    telegramUrl: optionalUrl(providerTelegramUrl),
  })
  .strict();
export type ProviderProfileInput = z.infer<typeof providerProfileInput>;
