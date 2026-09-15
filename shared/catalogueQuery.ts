import { z } from "zod";
import { priceCurrencies, priceUnits } from "./pricing";
import { catalogueViews, reviewNeeds, serviceTypes } from "./serviceReview";

// Limits are enforced at the API boundary; the browser cannot request the full catalogue.
export const adminServicesInput = z
  .object({
    limit: z.number().int().min(1).max(100).default(25),
    cursor: z.number().int().positive().optional(),
    q: z.string().trim().max(100).default(""),
    providerId: z.number().int().positive().optional(),
    view: z.enum(catalogueViews).optional(),
    need: z.enum(reviewNeeds).optional(),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    status: z.enum(["draft", "active", "paused", "archived"]).optional(),
    platform: z.string().trim().max(80).optional(),
  })
  .default({ limit: 25, q: "" });
export type AdminServicesInput = z.output<typeof adminServicesInput>;

export const adminProvidersInput = z.object({
  limit: z.number().int().min(1).max(50).default(25),
  cursor: z.number().int().positive().optional(),
  q: z.string().trim().max(100).default(""),
  includeId: z.number().int().positive().optional(),
}).default({ limit: 25, q: "" });
export type AdminProvidersInput = z.output<typeof adminProvidersInput>;

export const catalogueInput = z
  .object({
    scope: z
      .enum(["home", "services", "providers", "provider", "compare"])
      .default("home"),
    market: z.enum(["smm", "packages"]).optional(),
    category: z.enum(serviceTypes).optional(),
    limit: z.number().int().min(1).max(100).default(25),
    cursor: z
      .object({ id: z.number().int().positive(), rank: z.union([z.number().finite(), z.string().max(67).regex(/^-?\d+(\.\d+)?$/),
        ]),
      })
      .optional(),
    q: z.string().trim().max(100).default(""),
    platform: z.string().trim().max(80).optional(),
    priceCurrency: z.enum(priceCurrencies).optional(),
    countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
    serviceQuery: z.string().trim().max(80).optional(),
    priceUnit: z.enum(priceUnits).optional(),
    quantity: z.number().int().min(1).max(2147483647).optional(),
    quality: z.enum(["standard", "premium", "elite"]).optional(),
    refillOnly: z.boolean().default(false),
    minRefillDays: z.number().int().min(1).max(3650).optional(),
    sort: z.enum(["recommended", "price", "retention"]).default("recommended"),
    slug: z.string().max(190).optional(),
    ids: z.array(z.number().int().positive()).max(4).default([]),
  })
  .refine(
    value =>
      value.sort !== "price" ||
      (value.priceCurrency && value.priceUnit && value.priceUnit !== "package"),
    {
      message:
        "Price sorting requires the same currency and a non-package unit",
    }
  )
  .default({
    scope: "home",
    limit: 25,
    q: "",
    refillOnly: false,
    sort: "recommended",
    ids: [],
  });
export type CatalogueInput = z.output<typeof catalogueInput>;

export function searchPattern(q: string) {
  // User wildcards are literal. Values are still bound as SQL parameters.
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`;
}
