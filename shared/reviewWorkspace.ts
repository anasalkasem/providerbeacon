import { z } from "zod";

export const REVIEW_WORKSPACE_SLUG = "providerbeacon-review";
export const REVIEW_WORKSPACE_NAME = "ProviderBeacon Review";
export const REVIEW_ACCESS_DAYS = 365;
export const reviewWorkspaceInput = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform(value => value.toLowerCase()),
    note: z.string().trim().min(8).max(600),
    privateOnly: z.literal(true),
  })
  .strict();
