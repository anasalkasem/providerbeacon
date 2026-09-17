import { useEffect, useState } from "react";

/** Keep only the closing visual around briefly; the caller makes it inert. */
export function usePanelPresence(open: boolean, animated: boolean) {
  const [present, setPresent] = useState(open);
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    if (!present) return;
    if (
      !animated ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setPresent(false);
      return;
    }
    const timer = window.setTimeout(() => setPresent(false), 160);
    return () => window.clearTimeout(timer);
  }, [open, animated, present]);
  return open || (animated && present);
}
