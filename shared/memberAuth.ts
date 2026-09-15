import { z } from "zod";

export const memberLocale = z.enum(["ar", "en", "es", "hi", "zh"]);
export const memberEmail = z.string().trim().toLowerCase().email().max(320);
// Long passphrases are accepted without arbitrary character-class requirements.
export const memberPassword = z.string().min(15).max(128);
export const memberCredentials = z
  .object({
    email: memberEmail,
    password: z.string().min(1).max(128),
  })
  .strict();
export const memberRegistration = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: memberEmail,
    password: memberPassword,
    locale: memberLocale.default("en"),
    marketingOptIn: z.boolean().default(false),
  })
  .strict();
export const memberProof = z
  .object({
    currentPassword: z.string().max(128).optional(),
  })
  .strict();
export const memberRecovery = z
  .object({
    email: memberEmail,
    code: z.string().min(48).max(100),
    newPassword: memberPassword,
  })
  .strict();
export const memberGoogleStart = z
  .object({
    mode: z.enum(["sign_in", "link"]).default("sign_in"),
    next: z.string().max(600).default("/account"),
    locale: memberLocale.default("en"),
    currentPassword: z.string().max(128).optional(),
  })
  .strict();

export function safeMemberNext(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 600 ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/account";
  try {
    const url = new URL(value, "https://member.invalid");
    if (
      !value.startsWith("/") ||
      value.startsWith("//") ||
      url.origin !== "https://member.invalid"
    )
      return "/account";
    if (
      !/^\/(?:account|services|providers|compare|find|groups)(?:\/[^?#]*)?$/.test(
        url.pathname
      ) &&
      url.pathname !== "/"
    )
      return "/account";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/account";
  }
}

export type MemberProfile = {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
  locale: string;
  marketingOptIn: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  hasRecoveryCode: boolean;
  createdAt: Date;
};
