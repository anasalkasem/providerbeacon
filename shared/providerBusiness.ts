import { z } from "zod";
import { publicProfileUrl } from "./providerProfile";

export const claimStatuses = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "revoked",
] as const;
export const planStatuses = ["inactive", "active", "suspended"] as const;
export const promotionStatuses = [
  "pending",
  "approved",
  "rejected",
  "hidden",
] as const;
export const PROMOTIONS_PER_MONTH = 5;
export const BUSINESS_DAY_MS = 86_400_000;

export function providerHost(raw: string | null | undefined) {
  const safe = publicProfileUrl(raw);
  return safe ? new URL(safe).hostname.replace(/^www\./, "") : null;
}
export function providerOwnedUrl(raw: string, website: string | null) {
  const safe = publicProfileUrl(raw);
  const host = providerHost(website);
  return safe && host && providerHost(safe) === host ? safe : null;
}
export function providerOwnershipProofUrl(raw: string, website: string | null) {
  const safe = providerOwnedUrl(raw, website);
  // A public comment/profile on a provider's domain is not proof of site control.
  return safe &&
    [
      "/",
      "/providerbeacon-verification.txt",
      "/.well-known/providerbeacon-verification.txt",
    ].includes(new URL(safe).pathname)
    ? safe
    : null;
}
export function planIsActive(
  plan:
    | { status: string; startsAt: Date | null; endsAt: Date | null }
    | null
    | undefined,
  now = Date.now()
) {
  return Boolean(
    plan?.status === "active" &&
      plan.startsAt &&
      plan.endsAt &&
      plan.startsAt.getTime() <= now &&
      plan.endsAt.getTime() > now
  );
}
export function planState(
  plan:
    | { status: string; startsAt: Date | null; endsAt: Date | null }
    | null
    | undefined,
  now = Date.now()
) {
  if (!plan || plan.status === "inactive") return "inactive";
  if (plan.status === "suspended") return "suspended";
  if (!plan.endsAt || plan.endsAt.getTime() <= now) return "expired";
  if (!plan.startsAt || plan.startsAt.getTime() > now) return "scheduled";
  return "active";
}

export const businessProviderInput = z
  .object({ providerId: z.number().int().positive() })
  .strict();
export const businessMineInput = z
  .object({ accountId: z.number().int().positive() })
  .strict();
export const businessOwnedInput = businessMineInput
  .extend({ providerId: z.number().int().positive() })
  .strict();
export const claimProofInput = z
  .object({
    id: z.number().int().positive(),
    revision: z.number().int().positive(),
    proofUrl: z.string().trim().min(1).max(500),
  })
  .strict();
export const claimReviewInput = z
  .object({
    id: z.number().int().positive(),
    revision: z.number().int().positive(),
    decision: z.enum(["approved", "rejected"]),
    tokenConfirmed: z.boolean(),
    note: z.string().trim().min(8).max(600),
  })
  .strict();
export const subscriptionInput = businessProviderInput
  .extend({
    revision: z.number().int().nonnegative(),
    status: z.enum(planStatuses),
    startsAt: z.date().nullable(),
    endsAt: z.date().nullable(),
    note: z.string().trim().min(8).max(600),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.status === "active" &&
      (!value.startsAt ||
        !value.endsAt ||
        value.endsAt <= value.startsAt ||
        value.endsAt.getTime() - value.startsAt.getTime() >
          2 * 366 * BUSINESS_DAY_MS)
    )
      ctx.addIssue({
        code: "custom",
        message: "business_invalid_dates",
        path: ["endsAt"],
      });
  });
export const revokeOwnerInput = businessProviderInput
  .extend({
    revision: z.number().int().positive(),
    note: z.string().trim().min(8).max(600),
  })
  .strict();
export const promotionCategories = [
  "all",
  "Instagram",
  "TikTok",
  "YouTube",
  "Facebook",
  "Telegram",
  "X",
  "Other",
] as const;
export const promotionInput = businessProviderInput
  .extend({
    title: z.string().trim().min(4).max(120),
    description: z.string().trim().min(20).max(1200),
    couponCode: z
      .string()
      .trim()
      .max(64)
      .regex(/^[A-Za-z0-9_-]*$/),
    destinationUrl: z.string().trim().min(1).max(500),
    category: z.enum(promotionCategories).optional(),
    cover: z
      .string()
      .max(Math.ceil((512 * 1024) / 3) * 4 + 40)
      .optional(),
    removeCover: z.boolean().optional(),
    startsAt: z.date(),
    endsAt: z.date(),
  })
  .strict();
export const promotionEditInput = promotionInput
  .extend({
    id: z.number().int().positive(),
    revision: z.number().int().positive(),
  })
  .strict();
export const promotionWithdrawInput = businessProviderInput
  .extend({
    id: z.number().int().positive(),
    revision: z.number().int().positive(),
  })
  .strict();
export const ownerPromotionInput = promotionInput
  .extend({
    id: z.number().int().positive().optional(),
    revision: z.number().int().nonnegative(),
    showInExplorer: z.boolean(),
    note: z.string().trim().min(8).max(600),
  })
  .strict()
  .refine(value => (value.id ? value.revision > 0 : value.revision === 0));
export const promotionReviewInput = z
  .object({
    id: z.number().int().positive(),
    revision: z.number().int().positive(),
    decision: z.enum(["approved", "rejected", "hidden"]),
    destinationConfirmed: z.boolean(),
    note: z.string().trim().min(8).max(600),
  })
  .strict();
export const publicPromotionsInput = z
  .object({
    providerId: z.number().int().positive().optional(),
    cursor: z.number().int().positive().optional(),
    q: z.string().trim().max(100).optional(),
    category: z.enum(promotionCategories).optional(),
    explorer: z.boolean().optional(),
  })
  .strict();
export const businessQueueInput = z
  .object({
    cursor: z.number().int().positive().optional(),
    pendingOnly: z.boolean().default(true),
  })
  .strict();

export function validPromotionDates(
  startsAt: Date,
  endsAt: Date,
  now = Date.now()
) {
  return (
    Number.isFinite(startsAt.getTime()) &&
    Number.isFinite(endsAt.getTime()) &&
    endsAt > startsAt &&
    endsAt.getTime() > now &&
    endsAt.getTime() - startsAt.getTime() <= 90 * BUSINESS_DAY_MS &&
    startsAt.getTime() <= now + 90 * BUSINESS_DAY_MS
  );
}
