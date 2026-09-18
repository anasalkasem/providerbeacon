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

export const MESSAGE_CHIME_URL = "/sounds/beacon-chime-v1.mp3";

/** One short, reusable sound, loaded on activation; no microphone or running loop. */
export function createMessageChime(onState: (ready: boolean) => void) {
  let context: AudioContext | null = null;
  let disposed = false;
  let clip: AudioBuffer | null = null;
  let loading: Promise<void> | null = null;
  let download: AbortController | null = null;
  let playingUntil = 0;
  const active = new Map<AudioScheduledSourceNode, GainNode>();

  function release(source: AudioScheduledSourceNode, gain: GainNode) {
    source.onended = null;
    source.disconnect();
    gain.disconnect();
    active.delete(source);
  }
  function connect(source: AudioScheduledSourceNode, gain: GainNode) {
    source.connect(gain);
    gain.connect(context!.destination);
    active.set(source, gain);
    source.onended = () => release(source, gain);
  }
  function stop() {
    active.forEach((gain, source) => {
      try {
        source.stop();
      } catch {}
      release(source, gain);
    });
    playingUntil = 0;
  }
  function loadClip(target: AudioContext) {
    if (loading) return loading;
    const controller = new AbortController();
    download = controller;
    // A slow or offline connection must not block sound activation indefinitely.
    const timeout = setTimeout(() => controller.abort(), 1500);
    loading = (async () => {
      try {
        const response = await fetch(MESSAGE_CHIME_URL, {
          signal: controller.signal,
          cache: "force-cache",
        });
        if (!response.ok) return;
        const decoded = await target.decodeAudioData(
          await response.arrayBuffer()
        );
        if (!disposed && context === target && !controller.signal.aborted)
          clip = decoded;
      } catch {
        // A gentle local three-note fallback remains available if the file fails.
      } finally {
        clearTimeout(timeout);
      }
    })();
    return loading;
  }
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
          download?.abort();
          clip = null;
          loading = null;
          context = new Audio();
          context.onstatechange = () => {
            if (!disposed) onState(context?.state === "running");
          };
        }
        if (context.state !== "running") await context.resume();
        if (!disposed && context.state === "running") await loadClip(context);
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
      // Rapid previews and message bursts must not stack into a louder sound.
      if (now < playingUntil) return false;
      if (clip) {
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = clip;
        source.loop = false;
        gain.gain.setValueAtTime(0.65, now);
        connect(source, gain);
        playingUntil = now + Math.min(clip.duration, 1.3);
        source.start(now);
        source.stop(playingUntil);
        return true;
      }
      [523.25, 659.25, 1046.5].forEach((frequency, index) => {
        const start = now + index * 0.155;
        const oscillator = context!.createOscillator();
        const gain = context!.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.075 - index * 0.02, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);
        gain.gain.linearRampToValueAtTime(0, start + 0.42);
        connect(oscillator, gain);
        oscillator.start(start);
        oscillator.stop(start + 0.43);
      });
      playingUntil = now + 0.75;
      return true;
    },
    stop,
    dispose() {
      disposed = true;
      download?.abort();
      stop();
      clip = null;
      if (context) {
        context.onstatechange = null;
        void context.close().catch(() => {});
      }
    },
  };
}
