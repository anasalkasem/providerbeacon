import { z } from "zod";
import { memberLocale } from "./memberAuth";

export const customerEmailInput = z
  .object({
    memberId: z.number().int().positive(),
    locale: memberLocale,
    subject: z
      .string()
      .trim()
      .min(3)
      .max(160)
      .regex(/^[^\r\n\u0000]+$/),
    body: z.string().trim().min(10).max(6000),
    action: z.enum(["/services", "/compare", "/providers", "/account"]),
  })
  .strict();
export type CustomerEmailInput = z.infer<typeof customerEmailInput>;
export const emailTokenInput = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const MAIL_CONSENT_VERSION = "updates-v1";
