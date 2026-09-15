import { z } from "zod";
import {
  providerMonthAnniversary,
  providerPlanPricing,
} from "./providerBusinessPricing";

export const paymentGateways = ["paypal", "nowpayments"] as const;
export type PaymentGateway = (typeof paymentGateways)[number];
export const paymentStates = [
  "creating",
  "pending",
  "paid",
  "review",
  "failed",
  "expired",
  "refunded",
] as const;
export const paymentInput = z.object({ paymentId: z.string().uuid() }).strict();
export const checkoutInput = z
  .object({
    providerId: z.number().int().positive(),
    gateway: z.enum(paymentGateways),
  })
  .strict();
export const gatewaySettingsInput = z
  .object({
    gateway: z.enum(paymentGateways),
    revision: z.number().int().nonnegative(),
    enabled: z.boolean(),
    environment: z.enum(["live", "sandbox"]),
    clientId: z.string().trim().max(250).optional(),
    clientSecret: z.string().trim().max(500).optional(),
    webhookId: z.string().trim().max(100).optional(),
    merchantId: z.string().trim().max(100).optional(),
    apiKey: z.string().trim().max(500).optional(),
    ipnSecret: z.string().trim().max(500).optional(),
  })
  .strict();

/** Keep January 31 -> February 28 -> March 31 on the original calendar. */
export function nextPaidMonth(start: Date, first: Date | null) {
  if (first && first <= start) {
    const months =
      (start.getUTCFullYear() - first.getUTCFullYear()) * 12 +
      start.getUTCMonth() -
      first.getUTCMonth();
    if (providerMonthAnniversary(first, months).getTime() === start.getTime())
      return providerMonthAnniversary(first, months + 1);
  }
  return providerMonthAnniversary(start, 1);
}
export function paymentQuote(
  account: {
    status: string;
    endsAt: Date | null;
    firstActivatedAt: Date | null;
  },
  now = new Date()
) {
  const startsAt =
    account.status === "active" && account.endsAt && account.endsAt > now
      ? account.endsAt
      : now;
  return {
    amountCents: providerPlanPricing(
      account.firstActivatedAt,
      startsAt.getTime()
    ).currentMonthlyCents,
    currency: "USD" as const,
    startsAt,
    endsAt: nextPaidMonth(startsAt, account.firstActivatedAt),
    startsAfterConfirmation: startsAt.getTime() === now.getTime(),
  };
}
