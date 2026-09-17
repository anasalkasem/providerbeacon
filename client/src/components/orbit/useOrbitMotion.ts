import { useEffect, useState } from "react";
export function useOrbitMotion() {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [hidden, setHidden] = useState(
    () => typeof document !== "undefined" && document.hidden
  );
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(Boolean(media?.matches));
    const visibility = () => setHidden(document.hidden);
    media?.addEventListener("change", change);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media?.removeEventListener("change", change);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return { paused, setPaused, reduced, stopped: paused || reduced || hidden };
}
