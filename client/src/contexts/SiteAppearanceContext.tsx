import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { EdgeGlow } from "@/components/EdgeGlow";
import { trpc } from "@/lib/trpc";

const SiteAppearanceContext = createContext<{
  preview: boolean;
  setPreview: Dispatch<SetStateAction<boolean>>;
} | null>(null);

export function SiteAppearanceProvider({ children }: { children: ReactNode }) {
  const appearance = trpc.appearance.public.useQuery(undefined, {
    staleTime: 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const [preview, setPreview] = useState(false);
  const value = useMemo(() => ({ preview, setPreview }), [preview]);
  // Retain the last saved setting if a background refresh fails, so the light
  // doesn't blink with network activity. Initial loading/errors stay off.
  const enabled = appearance.data?.edgeGlowEnabled === true || preview;
  return (
    <SiteAppearanceContext.Provider value={value}>
      <div
        className="beacon-appearance"
        data-beacon-glow={enabled ? "on" : "off"}
      >
        {children}
        <EdgeGlow enabled={enabled} />
      </div>
    </SiteAppearanceContext.Provider>
  );
}

export function useSiteAppearancePreview() {
  const context = useContext(SiteAppearanceContext);
  if (!context) throw new Error("SiteAppearanceProvider is required");
  return context;
}
