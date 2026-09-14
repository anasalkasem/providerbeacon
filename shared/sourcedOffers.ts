import { z } from "zod";
import { priceCurrencies } from "./pricing";
import { platforms, serviceTypes } from "./serviceReview";

export const publicEvidenceUrl = z
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
      !url.hash &&
      (!url.port || url.port === "443")
    );
  }, "Use a public HTTPS source without credentials or query parameters");

export const sourcedOffer = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(140),
    name: z.string().trim().min(3).max(200),
    nameAr: z.string().trim().min(3).max(200),
    platform: z.enum(platforms).refine(value => value !== "Unknown"),
    category: z.enum(serviceTypes).refine(value => value !== "Other"),
    price: z.number().finite().min(0.0001).max(100000),
    currency: z.enum(priceCurrencies),
    unit: z.enum(["package", "per_1000", "per_item"]).default("package"),
    minOrder: z.number().int().min(1).max(2147483647).optional(),
    maxOrder: z.number().int().min(1).max(2147483647).optional(),
    sourceServiceId: z
      .string()
      .regex(/^[a-zA-Z0-9-]{1,80}$/)
      .optional(),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable()
      .default(null),
    refillMode: z
      .enum(["unknown", "none", "manual", "automatic", "lifetime"])
      .default("unknown"),
    refillDays: z.number().int().min(1).max(3650).nullable().default(null),
    startMinutesMin: z
      .number()
      .int()
      .min(0)
      .max(525600)
      .nullable()
      .default(null),
    startMinutesMax: z
      .number()
      .int()
      .min(0)
      .max(525600)
      .nullable()
      .default(null),
    scope: z.string().trim().min(8).max(300),
    scopeAr: z.string().trim().min(8).max(300),
    terms: z.string().trim().min(8).max(500),
    termsAr: z.string().trim().min(8).max(500),
    sourceUrl: publicEvidenceUrl,
    priceType: z.enum(["listed", "from"]),
  })
  .superRefine((offer, ctx) => {
    const error = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (
      offer.unit !== "package" &&
      (offer.minOrder == null || offer.maxOrder == null)
    )
      error(
        "Quantity-priced offers require explicit minimum and maximum orders"
      );
    if (
      offer.minOrder != null &&
      offer.maxOrder != null &&
      offer.minOrder > offer.maxOrder
    )
      error("Minimum order exceeds maximum");
    if (
      ["none", "unknown", "lifetime"].includes(offer.refillMode) &&
      offer.refillDays != null
    )
      error("Refill days conflict with refill mode");
    if (
      (offer.startMinutesMin == null) !== (offer.startMinutesMax == null) ||
      (offer.startMinutesMin != null &&
        offer.startMinutesMax != null &&
        offer.startMinutesMin > offer.startMinutesMax)
    )
      error(
        "Provide a complete ordered start-time range or leave both unknown"
      );
    if (
      Math.abs(offer.price * 10000 - Math.round(offer.price * 10000)) > 0.000001
    )
      error(
        "Price precision exceeds four decimal places; do not silently round source prices"
      );
  });
export const sourcedBatchInput = z.object({
  providerId: z.number().int().positive(),
  offers: z
    .array(sourcedOffer)
    .min(1)
    .max(20)
    .refine(
      items => new Set(items.map(item => item.slug)).size === items.length,
      "Duplicate offer slugs"
    ),
  reason: z.string().trim().min(8).max(1000),
});
export type SourcedOffer = z.infer<typeof sourcedOffer>;

export function sameSourceHost(website: string, source: string) {
  const host = (url: string) =>
    new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  return host(website) === host(source);
}

// Only these reviewed display fields can leave the private source payload.
export function publicOfferMetadata(row: {
  sourceKind: string;
  priceUnit?: string | null;
  sourceData: Record<string, unknown> | null;
  evidenceUrl: string | null;
  priceCheckedAt: Date | null;
  sourceUpdatedAt: Date | null;
}) {
  const manual = row.sourceKind === "public_web";
  const value = (key: string, max: number) =>
    manual && typeof row.sourceData?.[key] === "string"
      ? String(row.sourceData[key]).slice(0, max)
      : null;
  const evidence = publicEvidenceUrl.safeParse(row.evidenceUrl);
  return {
    sourceUrl: evidence.success ? evidence.data : null,
    checkedAt:
      (row.priceCheckedAt ?? row.sourceUpdatedAt)?.toISOString() ?? null,
    billingCycle:
      manual && row.priceUnit === "package" ? ("monthly" as const) : null,
    priceType:
      manual && row.sourceData?.priceType === "from"
        ? ("from" as const)
        : ("listed" as const),
    nameAr: value("nameAr", 200),
    sourceServiceId: value("sourceServiceId", 80),
    packageDescriptionAr: value("scopeAr", 300),
    terms: value("terms", 500),
    termsAr: value("termsAr", 500),
  };
}
