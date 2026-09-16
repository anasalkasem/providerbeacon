import { z } from "zod";

export const VIP_PAGE_SIZE = 8;
export const VIP_COVER_BYTES = 512 * 1024;
export const vipStatuses = [
  "pending",
  "approved",
  "rejected",
  "hidden",
] as const;
export const vipSaveInput = z
  .object({
    providerId: z.number().int().positive(),
    revision: z.number().int().nonnegative(),
    tagline: z.string().trim().min(12).max(140),
    specialties: z
      .array(z.string().trim().min(2).max(24))
      .min(1)
      .max(3)
      .refine(
        values =>
          new Set(values.map(v => v.toLowerCase())).size === values.length
      ),
    offer: z.string().trim().max(80),
    offerEndsAt: z.date().nullable(),
    cover: z
      .string()
      .max(Math.ceil(VIP_COVER_BYTES / 3) * 4 + 40)
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.offer &&
      (!value.offerEndsAt ||
        value.offerEndsAt.getTime() <= Date.now() ||
        value.offerEndsAt.getTime() > Date.now() + 90 * 86400000)
    )
      ctx.addIssue({
        code: "custom",
        path: ["offerEndsAt"],
        message: "vip_offer_dates",
      });
  });
export const vipIdentityInput = z
  .object({
    providerId: z.number().int().positive(),
    revision: z.number().int().positive(),
  })
  .strict();
export const vipReviewInput = vipIdentityInput
  .extend({
    decision: z.enum(["approved", "rejected", "hidden"]),
    contentConfirmed: z.boolean(),
    note: z.string().trim().min(8).max(600),
  })
  .strict();
export const vipListInput = z
  .object({
    page: z.number().int().min(1).max(10000).default(1),
    rotation: z.number().int().nonnegative().max(100000000).optional(),
  })
  .strict();
export const vipEventInput = vipIdentityInput
  .extend({
    kind: z.enum(["impression", "click"]),
    visitorId: z.string().uuid(),
  })
  .strict();
export type VipEvent = z.infer<typeof vipEventInput>;
export function rotateVipCards<T>(items: T[], rotation: number) {
  if (!items.length) return items;
  const offset = rotation % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}
