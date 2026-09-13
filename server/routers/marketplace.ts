import { publicProcedure, router } from "../_core/trpc";
import { getMarketplaceSnapshot } from "../marketplaceDb";

import { catalogueInput } from "../../shared/catalogueQuery";

export const marketplaceRouter = router({
  snapshot: publicProcedure.input(catalogueInput).query(({ input }) => getMarketplaceSnapshot(input)),
});
