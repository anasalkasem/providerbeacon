import { z } from "zod";

export const ANALYTICS_DAY_MS = 86_400_000;
export const ANALYTICS_REPEAT_MS = 30 * 60_000;
export const providerEventInput = z
  .object({
    providerId: z.number().int().positive().max(2_147_483_647),
    kind: z.enum(["view", "website", "telegram"]),
    visitorId: z.string().uuid(),
  })
  .strict();
export type ProviderEvent = z.infer<typeof providerEventInput>;

export const providerAnalyticsInput = z
  .object({
    days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
    providerId: z.number().int().positive().max(2_147_483_647).optional(),
    page: z.number().int().min(1).max(10_000).default(1),
  })
  .strict();

export function analyticsDate(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

export function analyticsPeriod(days: 7 | 30 | 90, now: number) {
  const today = Math.floor(now / ANALYTICS_DAY_MS) * ANALYTICS_DAY_MS;
  const start = today - (days - 1) * ANALYTICS_DAY_MS;
  return {
    start: analyticsDate(start),
    end: analyticsDate(today),
    dates: Array.from({ length: days }, (_, i) =>
      analyticsDate(start + i * ANALYTICS_DAY_MS)
    ),
  };
}
