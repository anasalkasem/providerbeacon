import { useLayoutEffect, type RefObject } from "react";

/** Animate only the new page content, without remounting it or delaying routing. */
export function usePageEntrance(
  ref: RefObject<HTMLElement | null>,
  path: string,
  enabled: boolean
) {
  useLayoutEffect(() => {
    const element = ref.current;
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!enabled || media?.matches || !element?.animate) return;
    const motion = element.animate(
      [
        { opacity: 0.25, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" }
    );
    const stop = () => {
      if (media?.matches) motion.cancel();
    };
    media?.addEventListener("change", stop);
    return () => {
      motion.cancel();
      media?.removeEventListener("change", stop);
    };
  }, [ref, path, enabled]);
}
