import { publicProcedure, router } from "../_core/trpc";
import { getCachedMarketplaceSnapshot } from "../marketplaceDb";

import { catalogueInput } from "../../shared/catalogueQuery";

export const marketplaceRouter = router({
  snapshot: publicProcedure.input(catalogueInput).query(({ ctx, input }) => {
    ctx.res.setHeader("Cache-Control", "no-store");
    return getCachedMarketplaceSnapshot(input);
  }),
});
