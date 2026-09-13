import { z } from "zod";
import { catalogueViews } from "./serviceReview";

// Limits are enforced at the API boundary; the browser cannot request the full catalogue.
export const adminServicesInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.number().int().positive().optional(),
  q: z.string().trim().max(100).default(""),
  providerId: z.number().int().positive().optional(),
  view: z.enum(catalogueViews).optional(),
  countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  platform: z.string().trim().max(80).optional(),
}).default({ limit: 25, q: "" });
export type AdminServicesInput = z.output<typeof adminServicesInput>;

export const catalogueInput = z.object({
  scope: z.enum(["home", "services", "providers", "provider", "compare"]).default("home"),
  limit: z.number().int().min(1).max(50).default(25),
  cursor: z.object({ id: z.number().int().positive(), rank: z.number().finite() }).optional(),
  q: z.string().trim().max(100).default(""),
  platform: z.string().trim().max(80).optional(),
  quality: z.enum(["standard", "premium", "elite"]).optional(),
  refillOnly: z.boolean().default(false),
  sort: z.enum(["recommended", "price", "retention"]).default("recommended"),
  slug: z.string().max(190).optional(),
  ids: z.array(z.number().int().positive()).max(4).default([]),
}).default({ scope: "home", limit: 25, q: "", refillOnly: false, sort: "recommended", ids: [] });
export type CatalogueInput = z.output<typeof catalogueInput>;

export function searchPattern(q: string) {
  // User wildcards are literal. Values are still bound as SQL parameters.
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`;
}
