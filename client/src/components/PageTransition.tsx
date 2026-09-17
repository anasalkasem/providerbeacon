import {
  createContext,
  Suspense,
  useContext,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { Router as LocationRouter } from "wouter";
import { useBrowserLocation } from "wouter/use-browser-location";

const DisplayedPath = createContext<string | null>(null);
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
  const deferredPath = useDeferredValue(path);
  const displayed = enabled ? deferredPath : path;
  return (
    <>
      {enabled && path !== displayed && (
        <div className="beacon-route-progress" role="status">
          <span className="sr-only">{label}</span>
          <i aria-hidden="true" />
        </div>
      )}
      <Suspense fallback={fallback}>
        <PageFrame path={displayed} enabled={enabled}>
          {children(displayed)}
        </PageFrame>
      </Suspense>
    </>
  );
}

function PageFrame({
  path,
  enabled,
  children,
}: {
  path: string;
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
    if (enabled && !historyNavigation.current && !window.location.hash) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    historyNavigation.current = false;
  }, [path, enabled]);
  return (
    <DisplayedPath.Provider value={path}>
      <LocationRouter hook={useDisplayedLocation}>{children}</LocationRouter>
    </DisplayedPath.Provider>
  );
}
