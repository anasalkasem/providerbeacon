import { trpc } from "@/lib/trpc";
import { catalogueIndex } from "@/lib/catalogue";
import { createContext, useContext, useMemo, type ReactNode } from "react";

type MarketplaceData = ReturnType<typeof catalogueIndex> & {
  source: "database" | "seed" | "unavailable";
  isLoading: boolean;
  retry: () => void;
};
const MarketplaceDataContext = createContext<MarketplaceData | null>(null);

export function MarketplaceDataProvider({ children }: { children: ReactNode }) {
  const query = trpc.marketplace.snapshot.useQuery(undefined, { staleTime: 60_000, retry: 1 });
  const value = useMemo<MarketplaceData>(() => ({
    ...catalogueIndex(query.data?.providers ?? [], query.data?.services ?? []),
    source: query.isError ? "unavailable" : query.data?.source ?? "unavailable",
    isLoading: query.isLoading,
    retry: () => { void query.refetch(); },
  }), [query.data, query.isError, query.isLoading, query.refetch]);
  return <MarketplaceDataContext.Provider value={value}>{children}</MarketplaceDataContext.Provider>;
}

export function useMarketplaceData() {
  const value = useContext(MarketplaceDataContext);
  if (!value) throw new Error("MarketplaceDataProvider is required");
  return value;
}
