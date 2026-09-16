import { useEffect, type MouseEvent } from "react";
import {
  analyticsDate,
  type ProviderEvent,
} from "../../../shared/providerAnalytics";

const storageKey = "pb_provider_metrics_v1";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function providerVisitorId() {
  // First-party, random, day-scoped ID; never use a member ID or email.
  // If privacy settings or storage block measurement, leave navigation unaffected.
  const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (
    privacy.doNotTrack === "1" ||
    privacy.globalPrivacyControl ||
    privacy.webdriver ||
    document.visibilityState !== "visible" ||
    (document as Document & { prerendering?: boolean }).prerendering
  )
    return null;
  const day = analyticsDate(Date.now());
  const raw = localStorage.getItem(storageKey);
  if (raw) {
    try {
      const stored = JSON.parse(raw);
      if (
        stored.day === day &&
        typeof stored.id === "string" &&
        uuid.test(stored.id)
      )
        return stored.id as string;
    } catch {
      /* replace malformed storage */
    }
  }
  const id = crypto.randomUUID();
  localStorage.setItem(storageKey, JSON.stringify({ day, id }));
  return id;
}

export function trackProviderEvent(
  publicId: string,
  kind: ProviderEvent["kind"]
) {
  try {
    const id = /^provider-([1-9]\d{0,9})$/.exec(publicId)?.[1];
    if (!id || Number(id) > 2_147_483_647) return;
    const visitor = providerVisitorId();
    if (!visitor) return;
    void fetch("/api/provider-analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({
        providerId: Number(id),
        visitorId: visitor,
        kind,
      }),
    }).catch(() => {});
  } catch {
    /* Tracking must never interrupt contact links, including blocked storage. */
  }
}

export function trackProviderContact(
  publicId: string,
  kind: "website" | "telegram",
  event: Pick<
    MouseEvent<HTMLAnchorElement>,
    "isTrusted" | "defaultPrevented" | "type" | "button"
  >
) {
  if (
    !event.isTrusted ||
    event.defaultPrevented ||
    (event.type === "auxclick" ? event.button !== 1 : event.button !== 0)
  )
    return;
  // A quick contact click also confirms that the profile was viewed.
  trackProviderEvent(publicId, "view");
  trackProviderEvent(publicId, kind);
}

export function useProviderPageView(publicId: string) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sent = false;
    const schedule = () => {
      clearTimeout(timer);
      if (!sent && document.visibilityState === "visible")
        timer = setTimeout(() => {
          trackProviderEvent(publicId, "view");
          sent = true;
        }, 1000);
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    document.addEventListener("prerenderingchange", schedule);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
      document.removeEventListener("prerenderingchange", schedule);
    };
  }, [publicId]);
}
