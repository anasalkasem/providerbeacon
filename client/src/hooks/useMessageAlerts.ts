import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { MessageNotificationSnapshot } from "../../../shared/messaging";
import type { Locale } from "@/contexts/LocaleContext";
import { messagingCopy } from "@/i18n/messaging";
import {
  claimMessageAlerts,
  createMessageAlertTracker,
  createMessageChime,
} from "@/lib/messageAlerts";

export function useMessageAlerts({
  scope,
  data,
  readingId,
  onOpen,
  locale,
}: {
  scope: string | null;
  data: MessageNotificationSnapshot | undefined;
  readingId: string | null;
  onOpen: (id: string) => void;
  locale: Locale;
}) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [soundFailed, setSoundFailed] = useState(false);
  const engine = useRef<ReturnType<typeof createMessageChime> | null>(null);
  const tracker = useRef(createMessageAlertTracker());
  const current = useRef({ scope, data, readingId, onOpen, locale, enabled });
  current.current = { scope, data, readingId, onOpen, locale, enabled };
  const lastSound = useRef(0);
  const soundAction = useRef(0);
  const toastId = `message-alert:${scope}`;
  useEffect(() => {
    tracker.current = createMessageAlertTracker();
    lastSound.current = 0;
    setReady(false);
    setSoundFailed(false);
    const key = `pb-message-sound:${scope}`;
    const load = () => {
      try {
        setEnabled(!!scope && localStorage.getItem(key) === "on");
      } catch {
        setEnabled(false);
      }
    };
    load();
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === null) load();
    };
    window.addEventListener("storage", sync);
    const chime = createMessageChime(setReady);
    engine.current = chime;
    return () => {
      soundAction.current += 1;
      window.removeEventListener("storage", sync);
      chime.dispose();
      engine.current = null;
      toast.dismiss(toastId);
    };
  }, [scope]);
  useEffect(() => {
    if (!scope || !enabled || ready) return;
    const unlock = (event: Event) => {
      // Let the explicit control own its gesture; otherwise pointerdown could
      // unlock audio before click and turn an Enable action into Mute.
      if (
        event.target instanceof Element &&
        event.target.closest("[data-message-sound-control]")
      )
        return;
      void engine.current?.unlock();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [scope, enabled, ready]);
  useEffect(() => {
    if (!scope || !data) {
      toast.dismiss(toastId);
      return;
    }
    if (!data.unread) toast.dismiss(toastId);
    const candidates = tracker.current(data, readingId);
    if (!candidates.length) return;
    let mounted = true;
    void claimMessageAlerts(scope, candidates).then(items => {
      const state = current.current;
      if (!mounted || state.scope !== scope || !state.data) return;
      const fresh = items.filter(
        item =>
          state.readingId !== item.conversationId &&
          state.data!.items.some(
            row =>
              row.conversationId === item.conversationId &&
              row.messageId >= item.messageId
          )
      );
      if (!fresh.length) return;
      const latest = fresh[0];
      const t = messagingCopy[state.locale];
      toast(t.newMessage, {
        id: toastId,
        description:
          fresh.length > 1 ? t.multipleMessages : (latest.name ?? t.visitor),
        duration: 8000,
        action: {
          label: t.open,
          onClick: () => {
            const active = current.current;
            if (
              active.scope === scope &&
              active.data?.items.some(
                item => item.conversationId === latest.conversationId
              )
            )
              active.onOpen(latest.conversationId);
          },
        },
      });
      if (state.enabled && Date.now() - lastSound.current > 3000) {
        if (engine.current?.play()) lastSound.current = Date.now();
      }
    });
    return () => {
      mounted = false;
    };
  }, [scope, data, readingId]);

  async function enableSound() {
    if (!scope) return;
    const target = scope;
    const action = ++soundAction.current;
    setSoundFailed(false);
    // resume() is called synchronously from the click, before any await.
    const unlocked = await engine.current?.unlock();
    if (current.current.scope !== target || action !== soundAction.current)
      return;
    if (!unlocked) {
      setSoundFailed(true);
      return;
    }
    current.current.enabled = true;
    setEnabled(true);
    try {
      localStorage.setItem(`pb-message-sound:${scope}`, "on");
    } catch {}
    engine.current?.play();
  }
  function mute() {
    soundAction.current += 1;
    engine.current?.stop();
    current.current.enabled = false;
    setEnabled(false);
    setSoundFailed(false);
    try {
      localStorage.setItem(`pb-message-sound:${scope}`, "off");
    } catch {}
  }
  return { enabled, ready, soundFailed, enableSound, mute, test: enableSound };
}
