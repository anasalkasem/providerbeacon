import { trpc } from "@/lib/trpc";
import { catalogueIndex } from "@/lib/catalogue";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useSearch } from "wouter";
import type { CatalogueInput } from "../../../shared/catalogueQuery";

type Filters = Partial<
  Pick<
    CatalogueInput,
    | "q"
    | "platform"
    | "category"
    | "market"
    | "sort"
    | "quality"
    | "refillOnly"
    | "priceCurrency"
    | "priceUnit"
    | "quantity"
  >
>;
type Cursor = CatalogueInput["cursor"];
type MarketplaceData = ReturnType<typeof catalogueIndex> & {
  source: "database" | "unavailable";
  isLoading: boolean;
  isFetching: boolean;
  retry: () => void;
  setFilters: (filters: Filters) => void;
  pagination: {
    total: number;
    page: number;
    hasNext: boolean;
    next: () => void;
    previous: () => void;
  };
};
const MarketplaceDataContext = createContext<MarketplaceData | null>(null);

export function MarketplaceDataProvider({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [state, setState] = useState<{
    path: string;
    filters: Filters;
    cursors: Cursor[];
  }>({ path, filters: {}, cursors: [undefined] });
  const current =
    state.path === path ? state : { path, filters: {}, cursors: [undefined] };
  const scope =
    path === "/services" ||
    (path === "/compare" &&
      !params.get("services") &&
      params.get("manual") !== "1")
      ? "services"
      : path === "/providers"
        ? "providers"
        : path.startsWith("/providers/")
          ? "provider"
          : path === "/compare"
            ? "compare"
            : "home";
  const ids = Array.from(
    new Set(
      (params.get("services") ?? "")
        .split(",")
        .filter(id => /^service-[1-9]\d*$/.test(id))
        .map(id => Number(id.slice(8)))
        .filter(Number.isSafeInteger)
    )
  ).slice(0, 4);
  const query = trpc.marketplace.snapshot.useQuery(
    {
      scope,
      limit: 25,
      market: ["home", "services", "providers"].includes(scope)
        ? params.get("market") === "packages"
          ? "packages"
          : "smm"
        : undefined,
      ...(scope === "home"
        ? { platform: "Instagram", category: "Followers" as const }
        : {}),
      q: params.get("q")?.slice(0, 100) ?? "",
      ...current.filters,
      slug: scope === "provider" ? path.slice("/providers/".length) : undefined,
      ids,
      cursor: current.cursors.at(-1),
    },
    {
      enabled:
        !/^\/(admin|login|setup|team|sign-in|sign-up|account|recover-account|privacy)(\/|$)/.test(
          path
        ),
      staleTime: 30_000,
      gcTime: 120_000,
      retry: 1,
    }
  );
  const setFilters = useCallback(
    (filters: Filters) => {
      setState(previous =>
        previous.path === path &&
        JSON.stringify(previous.filters) === JSON.stringify(filters)
          ? previous
          : { path, filters, cursors: [undefined] }
      );
    },
    [path]
  );
  const value = useMemo<MarketplaceData>(
    () => ({
      ...catalogueIndex(
        query.data?.providers ?? [],
        query.data?.services ?? []
      ),
      source: query.isError
        ? "unavailable"
        : (query.data?.source ?? "unavailable"),
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      setFilters,
      retry: () => {
        void query.refetch();
      },
      pagination: {
        total: query.data?.pagination.total ?? 0,
        page: current.cursors.length,
        hasNext: Boolean(query.data?.pagination.nextCursor) && !query.isError,
        next: () => {
          const cursor = query.data?.pagination.nextCursor;
          if (cursor && !query.isFetching)
            setState({ ...current, cursors: [...current.cursors, cursor] });
        },
        previous: () => {
          if (current.cursors.length > 1 && !query.isFetching)
            setState({ ...current, cursors: current.cursors.slice(0, -1) });
        },
      },
    }),
    [
      query.data,
      query.isError,
      query.isLoading,
      query.isFetching,
      query.refetch,
      current,
      setFilters,
    ]
  );
  return (
    <MarketplaceDataContext.Provider value={value}>
      {children}
    </MarketplaceDataContext.Provider>
  );
}

export function useMarketplaceData() {
  const value = useContext(MarketplaceDataContext);
  if (!value) throw new Error("MarketplaceDataProvider is required");
  return value;
}
