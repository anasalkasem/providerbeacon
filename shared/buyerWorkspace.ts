import { z } from "zod";
import type { Service } from "../client/src/data/marketplace";
import {
  compareQuoteAmounts,
  priceCurrencies,
  quantityQuoteExact,
} from "./pricing";

export const publicServiceId = z.string().regex(/^service-[1-9]\d{0,9}$/);
export const watchInput = z
  .object({
    serviceId: publicServiceId,
    quantity: z.number().int().min(1).max(2147483647),
  })
  .strict();
export const comparisonInput = z
  .object({
    serviceIds: z
      .array(publicServiceId)
      .min(2)
      .max(4)
      .refine(ids => new Set(ids).size === ids.length),
    quantity: z.number().int().min(1).max(2147483647),
    currency: z.enum(priceCurrencies),
    name: z.string().trim().min(1).max(100),
  })
  .strict();
export const targetInput = z
  .object({
    id: z.number().int().positive(),
    target: z
      .string()
      .regex(/^\d{1,9}(\.\d{1,8})?$/)
      .nullable(),
  })
  .strict();
export type SavedPrice = Pick<
  Service,
  | "name"
  | "priceAmount"
  | "sourceRate"
  | "catalogueListing"
  | "priceCurrency"
  | "priceUnit"
  | "packageDescription"
  | "min"
  | "max"
  | "priceType"
  | "historyKey"
>;
export function savedPrice(service: Service): SavedPrice {
  const {
    name,
    priceAmount,
    sourceRate,
    catalogueListing,
    priceCurrency,
    priceUnit,
    packageDescription,
    min,
    max,
    priceType,
    historyKey,
  } = service;
  return {
    name,
    priceAmount,
    sourceRate,
    catalogueListing,
    priceCurrency,
    priceUnit,
    packageDescription,
    min,
    max,
    priceType,
    historyKey,
  };
}
export function watchChange(
  baseline: SavedPrice,
  current: Service | null,
  quantity: number,
  target: string | null
) {
  const original =
    baseline.priceType === "from"
      ? null
      : quantityQuoteExact(baseline, quantity);
  const now =
    !current || current.priceType === "from"
      ? null
      : quantityQuoteExact(current, quantity);
  if (!current)
    return {
      status: "unavailable" as const,
      original,
      now,
      percentage: null,
      targetReached: false,
    };
  if (!baseline.historyKey || baseline.historyKey !== current.historyKey)
    return {
      status: "terms_changed" as const,
      original,
      now,
      percentage: null,
      targetReached: false,
    };
  if (original == null || now == null)
    return {
      status: "unconfirmed" as const,
      original,
      now,
      percentage: null,
      targetReached: false,
    };
  const comparison = compareQuoteAmounts(now, original);
  // Display-only percentage. Price direction and target thresholds use exact decimals.
  const percentage =
    Number(original) > 0
      ? Math.abs((Number(now) / Number(original) - 1) * 100)
      : null;
  return {
    status:
      comparison < 0
        ? ("lower" as const)
        : comparison > 0
          ? ("higher" as const)
          : ("same" as const),
    original,
    now,
    percentage:
      percentage != null && Number.isFinite(percentage) ? percentage : null,
    targetReached: target != null && compareQuoteAmounts(now, target) <= 0,
  };
}
