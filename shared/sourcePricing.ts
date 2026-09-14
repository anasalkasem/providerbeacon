import { z } from "zod";
import { priceUnits } from "./pricing";
import { reviewBatchInput } from "./serviceReview";

export const sourcePricingInput = reviewBatchInput
  .extend({
    unit: z.enum(priceUnits).nullable(),
    packageDescription: z.string().trim().max(300).nullable().default(null),
    evidenceUrl: z
      .string()
      .url()
      .max(500)
      .refine(value => {
        try {
          const url = new URL(value);
          return (
            url.protocol === "https:" &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash
          );
        } catch {
          return false;
        }
      })
      .nullable(),
    confirmed: z.literal(true),
  })
  .refine(value => !value.unit || Boolean(value.evidenceUrl), {
    message: "A pricing source is required",
  })
  .refine(
    value =>
      value.unit !== "package" || (value.packageDescription?.length ?? 0) >= 8,
    { message: "Describe the package contents" }
  );
