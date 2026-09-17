import { z } from "zod";

export const ratingReference = z.object({
  providerId: z.number().int().positive(),
  accountId: z.number().int().positive(),
});
export const ratingWrite = ratingReference
  .extend({
    revision: z.number().int().nonnegative(),
    stars: z.number().int().min(1).max(5),
  })
  .strict();
export const ratingRemove = ratingReference
  .extend({ revision: z.number().int().positive() })
  .strict();
