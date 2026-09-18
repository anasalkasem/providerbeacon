import { publicProcedure, router } from "../_core/trpc";
import { getCachedMarketplaceSnapshot } from "../marketplaceDb";
import { getProviderCataloguePricing } from "../providerCataloguePricing";
import { catalogueInput } from "../../shared/catalogueQuery";

export const marketplaceRouter = router({
  snapshot: publicProcedure.input(catalogueInput).query(async ({ ctx, input }) => {
    ctx.res.setHeader("Cache-Control", "no-store");
    const snapshot = await getCachedMarketplaceSnapshot(input);
    if (input.scope !== "providers" || snapshot.source !== "database") return snapshot;
    const summaries = await getProviderCataloguePricing(snapshot.providers.map(provider => Number(provider.id.slice(9))));
    return {
      ...snapshot,
      providers: snapshot.providers.map(provider => ({
        ...provider,
        pricingSummary: summaries?.[provider.id] ?? null,
      })),
    };
  }),
});
