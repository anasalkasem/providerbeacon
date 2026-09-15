import { z } from "zod";
import { groupLink, groupLanguages, groupTopics } from "./community";
import { publicProfileUrl } from "./providerProfile";

export function websiteHome(raw: string): string | null {
  const url = publicProfileUrl(raw);
  return url ? `${new URL(url).origin}/` : null;
}
export const metadataKeyInput = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .optional();
export const websitePreviewInput = z
  .object({
    url: z
      .string()
      .trim()
      .max(500)
      .refine(value => Boolean(websiteHome(value))),
  })
  .strict();
export const telegramPreviewInput = z
  .object({
    url: z
      .string()
      .trim()
      .max(500)
      .refine(value => groupLink(value)?.platform === "telegram"),
  })
  .strict();
export type Audience = {
  count: number;
  kind: "members" | "subscribers";
  approximate: boolean;
};
export type GroupLinkMetadata = {
  avatarUrl: string | null;
  audience: Audience | null;
  fetchedAt: string;
};
export type LinkMetadata = {
  key: string;
  kind: "website" | "telegram";
  sourceUrl: string;
  fetchedAt: string;
  name: string | null;
  description: string | null;
  logoUrl: string | null;
  websitePreviewUrl: string | null;
  telegramUrl: string | null;
  avatarUrl: string | null;
  audience: Audience | null;
  topic: (typeof groupTopics)[number] | null;
  language: (typeof groupLanguages)[number] | null;
  aiSuggested: boolean;
  complete: boolean;
};

// A suggestion may replace an earlier automatic value, never a manual edit.
export function fillSuggested<T extends Record<string, unknown>>(
  current: T,
  suggested: Partial<T>,
  previous: Partial<T>,
  touched: ReadonlySet<keyof T>
): T {
  const next = { ...current };
  for (const key of Object.keys(suggested) as (keyof T)[]) {
    const value = suggested[key];
    if (value == null || value === "" || touched.has(key)) continue;
    if (
      current[key] == null ||
      current[key] === "" ||
      current[key] === previous[key]
    )
      next[key] = value as T[keyof T];
  }
  return next;
}
