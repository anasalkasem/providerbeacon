import { z } from "zod";
import { hasPricingBasis, pricingFields } from "./pricing";

export const platforms = [
  "Instagram",
  "TikTok",
  "YouTube",
  "Facebook",
  "Telegram",
  "Twitter",
  "LinkedIn",
  "Snapchat",
  "Spotify",
  "Twitch",
  "Pinterest",
  "Reddit",
  "Website",
  "Unknown",
] as const;
export const serviceTypes = [
  "Followers",
  "Views",
  "Likes",
  "Comments",
  "Shares",
  "Subscribers",
  "Website traffic",
  "Ad management",
  "Content creation",
  "SEO",
  "Analytics",
  "Other",
] as const;
export const catalogueViews = [
  "all",
  "pending",
  "approved",
  "changes_requested",
  "incomplete",
  "stale",
  "published",
  "price_changed",
  "missing",
] as const;
export const STALE_DAYS = 30;
export const reviewNeeds = [
  "pricing_unconfirmed",
  "evidence_missing",
  "policy_check",
  "classification",
  "invalid_values",
  "source_missing",
  "stale",
  "ready",
] as const;
export type ReviewNeed = (typeof reviewNeeds)[number];
export const reviewReference = z.object({
  id: z.number().int().positive(),
  revision: z.number().int().positive(),
});
export const reviewBatchInput = z.object({
  items: z
    .array(reviewReference)
    .min(1)
    .max(50)
    .refine(items => new Set(items.map(item => item.id)).size === items.length),
  reason: z.string().trim().min(8).max(1000),
});
export const reviewEditInput = reviewReference
  .extend({
    platform: z.enum(platforms),
    category: z.enum(serviceTypes),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable(),
    ...pricingFields,
    price: z.number().finite().min(0.0001).max(100000),
    minOrder: z.number().int().min(1).max(2147483647),
    maxOrder: z.number().int().min(1).max(2147483647),
    refillMode: z.enum(["unknown", "none", "manual", "automatic", "lifetime"]),
    refillDays: z.number().int().min(1).max(3650).nullable(),
    evidenceUrl: z
      .string()
      .url()
      .max(500)
      .refine(value => {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      })
      .nullable(),
    pricingConfirmed: z.boolean(),
    policyReviewed: z.boolean(),
    reason: z.string().trim().min(8).max(1000),
  })
  .refine(
    value =>
      !value.pricingConfirmed ||
      (Boolean(value.evidenceUrl) && hasPricingBasis(value)),
    {
      message:
        "Price confirmation requires evidence, currency and package contents when applicable",
    }
  )
  .refine(value => value.maxOrder >= value.minOrder, {
    message: "Maximum quantity must be at least the minimum",
  });
