import { trpc } from "@/lib/trpc";
import { catalogueIndex } from "@/lib/catalogue";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useSearch } from "wouter";
import type { CatalogueInput } from "../../../shared/catalogueQuery";
import { providerSelection } from "../../../shared/providerSelection";

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
    | "countryCode"
    | "minRefillDays"
    | "limit"
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
  const catalogueKey =
    path + "?providers=" + providerSelection(params.get("providers")).join(",");
  const [state, setState] = useState<{
    path: string;
    filters: Filters;
    cursors: Cursor[];
  }>({ path: catalogueKey, filters: {}, cursors: [undefined] });
  const current =
    state.path === catalogueKey
      ? state
      : { path: catalogueKey, filters: {}, cursors: [undefined] };
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
  const queryInput = {
    scope,
    limit: scope === "home" ? 16 : 25,
    market: ["services", "providers"].includes(scope)
      ? params.get("market") === "packages"
        ? "packages"
        : "smm"
      : undefined,
    providerIds:
      scope === "services"
        ? providerSelection(params.get("providers"))
        : undefined,
    q: params.get("q")?.slice(0, 100) ?? "",
    ...current.filters,
    slug: scope === "provider" ? path.slice("/providers/".length) : undefined,
    ids,
    cursor: current.cursors.at(-1),
  } satisfies Partial<CatalogueInput>;
  const query = trpc.marketplace.snapshot.useQuery(queryInput, {
    enabled:
      !/^\/(admin|login|setup|team|sign-in|sign-up|account|recover-account|privacy|find)(\/|$)/.test(
        path
      ),
    staleTime: 30_000,
    gcTime: 120_000,
    retry: 1,
    // Keep the current rows during pagination. Service filters must match so
    // a new search never displays results from the previous request.
    placeholderData: (previous, previousQuery) => {
      const previousInput = (
        previousQuery?.queryKey[1] as
          | { input?: Partial<CatalogueInput> }
          | undefined
      )?.input;
      if (scope === "services" && previousInput?.scope === "services") {
        const { cursor: _previousCursor, ...previousFilters } = previousInput;
        const { cursor: _currentCursor, ...nextFilters } = queryInput;
        return JSON.stringify(previousFilters) === JSON.stringify(nextFilters)
          ? previous
          : undefined;
      }
      return scope === "provider" &&
        previousInput?.scope === "provider" &&
        previousInput.slug === path.slice("/providers/".length)
        ? previous
        : undefined;
    },
  });
  const setFilters = useCallback(
    (filters: Filters) => {
      setState(previous =>
        previous.path === catalogueKey &&
        JSON.stringify(previous.filters) === JSON.stringify(filters)
          ? previous
          : { path: catalogueKey, filters, cursors: [undefined] }
      );
    },
    [catalogueKey]
  );
  const lastProvider = useRef<{
    path: string;
    providers: NonNullable<typeof query.data>["providers"];
  } | null>(null);
  useEffect(() => {
    if (
      scope === "provider" &&
      query.data?.source === "database" &&
      !query.isPlaceholderData
    )
      lastProvider.current = { path, providers: query.data.providers };
  }, [scope, path, query.data, query.isPlaceholderData]);
  // A request error should leave the profile in place with an inline retry,
  // not collapse the entire page. A successful missing-provider response wins.
  const providerRows =
    query.isError || query.data?.source === "unavailable"
      ? scope === "provider" && lastProvider.current?.path === path
        ? lastProvider.current.providers
        : []
      : (query.data?.providers ?? []);
  const value = useMemo<MarketplaceData>(
    () => ({
      ...catalogueIndex(providerRows, query.data?.services ?? []),
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
      providerRows,
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
