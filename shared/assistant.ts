import { z } from "zod";
import { priceCurrencies } from "./pricing";
import { platforms, serviceTypes } from "./serviceReview";

export const assistantLocales = ["ar", "en", "es", "hi", "zh"] as const;
export const assistantMessage = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(2000),
  })
  .strict();
const serviceId = z.string().regex(/^service-[1-9]\d{0,9}$/);
export const assistantTurnInput = z
  .object({
    message: z.string().trim().min(1).max(1200),
    history: z.array(assistantMessage).max(12).default([]),
    locale: z.enum(assistantLocales).default("en"),
    context: z
      .object({
        path: z
          .string()
          .max(250)
          .regex(/^\/(?:$|services(?:\/|$)|providers(?:\/|$)|compare$|find$)/)
          .default("/"),
        offerIds: z.array(serviceId).max(4).default([]),
      })
      .strict()
      .default({ path: "/", offerIds: [] }),
  })
  .strict()
  .refine(
    input =>
      input.message.length +
        input.history.reduce((sum, m) => sum + m.content.length, 0) <=
      14000,
    "Conversation is too long"
  );
export type AssistantTurnInput = z.infer<typeof assistantTurnInput>;

// All fields are explicit/nullable so the same schema works in strict model output.
export const assistantPlanSchema = z
  .object({
    action: z.enum(["search", "compare", "help", "clarify", "handoff"]),
    market: z.enum(["smm", "packages"]),
    platform: z.enum(platforms).nullable(),
    category: z.enum(serviceTypes).nullable(),
    query: z.string().max(80),
    provider: z.string().max(80).nullable(),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable(),
    quantity: z.number().int().min(1).max(2147483647).nullable(),
    displayCurrency: z.enum(priceCurrencies).nullable(),
    budget: z
      .string()
      .regex(/^\d{1,9}(\.\d{1,4})?$/)
      .nullable(),
    refillOnly: z.boolean(),
    minRefillDays: z.number().int().min(1).max(3650).nullable(),
    preferLowest: z.boolean(),
    serviceIds: z.array(serviceId).max(4),
    reply: z.string().min(1).max(1200),
  })
  .strict();
export type AssistantPlan = z.infer<typeof assistantPlanSchema>;

export const assistantAnswerSchema = z
  .object({
    answer: z.string().min(1).max(2000),
  })
  .strict();
