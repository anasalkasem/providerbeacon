import type {
  MessageAlert,
  MessageNotificationSnapshot,
} from "../../../shared/messaging";

/** Keep high-water marks even when a conversation is read or leaves the page. */
export function createMessageAlertTracker() {
  let initialized = false;
  let newest = 0;
  const seen = new Map<string, number>();
  return (snapshot: MessageNotificationSnapshot, readingId: string | null) => {
    const alerts: MessageAlert[] = [];
    for (const item of snapshot.items) {
      // Older unread conversations entering a bounded summary are not new arrivals.
      const previous = seen.get(item.conversationId) ?? newest;
      if (
        initialized &&
        item.messageId > previous &&
        item.conversationId !== readingId
      )
        alerts.push(item);
      seen.set(item.conversationId, Math.max(previous, item.messageId));
    }
    newest = Math.max(newest, ...snapshot.items.map(item => item.messageId));
    initialized = true;
    return alerts;
  };
}

// Coordinate tabs without storing message text or names. Web Locks makes the
// read/claim atomic where available; storage denial only disables coordination.
export async function claimMessageAlerts(scope: string, items: MessageAlert[]) {
  const claim = () => {
    const key = `pb-message-alerts:${scope}`;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "{}");
      const seen: Record<string, number> =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed
          : {};
      const fresh = items.filter(
        item => item.messageId > (Number(seen[item.conversationId]) || 0)
      );
      for (const item of fresh) seen[item.conversationId] = item.messageId;
      localStorage.setItem(
        key,
        JSON.stringify(
          Object.fromEntries(
            Object.entries(seen)
              .sort((a, b) => Number(b[1]) - Number(a[1]))
              .slice(0, 128)
          )
        )
      );
      return fresh;
    } catch {
      return items;
    }
  };
  return navigator.locks?.request
    ? navigator.locks.request(`pb-message-alerts:${scope}`, claim)
    : claim();
}

/** A short local chime: no audio download, microphone access or running loop. */
export function createMessageChime(onState: (ready: boolean) => void) {
  let context: AudioContext | null = null;
  let disposed = false;
  return {
    async unlock() {
      if (disposed) return false;
      const Audio =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Audio) return false;
      try {
        if (!context || context.state === "closed") {
          context = new Audio();
          context.onstatechange = () => {
            if (!disposed) onState(context?.state === "running");
          };
        }
        if (context.state !== "running") await context.resume();
        const ready = !disposed && context.state === "running";
        if (!disposed) onState(ready);
        return ready;
      } catch {
        if (!disposed) onState(false);
        return false;
      }
    },
    play() {
      if (disposed || context?.state !== "running") return false;
      const now = context.currentTime;
      [880, 1174.66].forEach((frequency, index) => {
        const start = now + index * 0.13;
        const oscillator = context!.createOscillator();
        const gain = context!.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        oscillator.connect(gain);
        gain.connect(context!.destination);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(start);
        oscillator.stop(start + 0.23);
      });
      return true;
    },
    dispose() {
      disposed = true;
      if (context) {
        context.onstatechange = null;
        void context.close().catch(() => {});
      }
    },
  };
}
