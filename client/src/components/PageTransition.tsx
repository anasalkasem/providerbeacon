import {
  createContext,
  Suspense,
  useContext,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Router as LocationRouter, useSearch } from "wouter";
import {
  useBrowserLocation,
  useSearch as useBrowserSearch,
} from "wouter/use-browser-location";

const DisplayedPath = createContext<string | null>(null);
const DisplayedSearch = createContext<string | null>(null);
export const useDisplayedPagePath = (fallback: string) =>
  useContext(DisplayedPath) ?? fallback;

// Keep useRoute/useLocation inside the retained page on its displayed route too.
// Navigation still uses the original browser history implementation.
function useDisplayedLocation(
  options: Parameters<typeof useBrowserLocation>[0]
): ReturnType<typeof useBrowserLocation> {
  const [path, navigate] = useBrowserLocation(options);
  return [useDisplayedPagePath(path), navigate];
}

function useDisplayedSearch(options: Parameters<typeof useBrowserSearch>[0]) {
  const search = useBrowserSearch(options);
  return useContext(DisplayedSearch) ?? search;
}

/** Deferred routing keeps the current content visible while a lazy page loads. */
export function PageTransition({
  path,
  enabled,
  label,
  fallback,
  children,
}: {
  path: string;
  enabled: boolean;
  label: string;
  fallback: ReactNode;
  children: (path: string) => ReactNode;
}) {
  const search = useSearch();
  const route = useMemo(() => ({ path, search }), [path, search]);
  const deferred = useDeferredValue(route);
  const displayed = enabled ? deferred.path : path;
  // Keep outgoing pages on their own query, but apply edits on the current
  // page immediately so URL-backed form controls never lag behind typing.
  const displayedSearch = displayed === path ? search : deferred.search;
  return (
    <>
      {enabled && path !== displayed && (
        <div className="beacon-route-progress" role="status">
          <span className="sr-only">{label}</span>
          <i aria-hidden="true" />
        </div>
      )}
      <Suspense fallback={fallback}>
        <PageFrame path={displayed} search={displayedSearch} enabled={enabled}>
          {children(displayed)}
        </PageFrame>
      </Suspense>
    </>
  );
}

function PageFrame({
  path,
  search,
  enabled,
  children,
}: {
  path: string;
  search: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const previous = useRef(path);
  const historyNavigation = useRef(false);
  useEffect(() => {
    const backOrForward = () => {
      historyNavigation.current = true;
    };
    window.addEventListener("popstate", backOrForward);
    return () => window.removeEventListener("popstate", backOrForward);
  }, []);
  useLayoutEffect(() => {
    if (previous.current === path) return;
    previous.current = path;
    if (!historyNavigation.current && !window.location.hash) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    historyNavigation.current = false;
  }, [path, enabled]);
  return (
    <DisplayedPath.Provider value={path}>
      <DisplayedSearch.Provider value={search}>
        <LocationRouter
          hook={useDisplayedLocation}
          searchHook={useDisplayedSearch}
        >
          {children}
        </LocationRouter>
      </DisplayedSearch.Provider>
    </DisplayedPath.Provider>
  );
}
