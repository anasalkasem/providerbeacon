import { publicProcedure, router } from "../_core/trpc";
import { getMarketplaceSnapshot } from "../marketplaceDb";

export const marketplaceRouter = router({
  snapshot: publicProcedure.query(() => getMarketplaceSnapshot()),
});
