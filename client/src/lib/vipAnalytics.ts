import { useEffect, useRef } from "react";
import type { VipEvent } from "../../../shared/providerVip";
import { providerVisitorId } from "./providerAnalytics";

export function trackVipEvent(
  providerId: number,
  revision: number,
  kind: VipEvent["kind"]
) {
  try {
    const visitorId = providerVisitorId();
    if (!visitorId) return;
    void fetch("/api/vip-analytics", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId, revision, kind, visitorId }),
    }).catch(() => {});
  } catch {
    /* Privacy settings must not interfere with the album. */
  }
}
export function useVipImpression(
  providerId: number,
  revision: number,
  enabled: boolean
) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!enabled || !ref.current || typeof IntersectionObserver === "undefined")
      return;
    let visible = false;
    let sent = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (!sent && visible && document.visibilityState === "visible")
        timer = setTimeout(() => {
          trackVipEvent(providerId, revision, "impression");
          sent = true;
        }, 1000);
    };
    const observer = new IntersectionObserver(
      entries => {
        visible = entries.some(
          entry => entry.isIntersecting && entry.intersectionRatio >= 0.5
        );
        schedule();
      },
      { threshold: [0.5] }
    );
    observer.observe(ref.current);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [providerId, revision, enabled]);
  return ref;
}
