import { useEffect, useRef, useState } from "react";
import "./edge-glow.css";

type Phase = "welcome" | "opening" | "thinking" | "reply" | "leaving";
export function EdgeGlow({ phase }: { phase: Phase | null }) {
  if (!phase) return null;
  return (
    <div className="beacon-edge-glow" data-phase={phase} aria-hidden="true">
      <div className="beacon-edge-glow__halo" />
      <div className="beacon-edge-glow__rim" />
    </div>
  );
}

function firstVisit() {
  try {
    if (sessionStorage.getItem("beacon-edge-welcome")) return false;
    sessionStorage.setItem("beacon-edge-welcome", "1");
  } catch {
    /* Storage restrictions must not affect the assistant. */
  }
  return true;
}

export function AssistantEdgeGlow(props: {
  enabled: boolean;
  open: boolean;
  pending: boolean;
  replyId: number;
}) {
  const { enabled, open, pending, replyId } = props;
  const [phase, setPhase] = useState<Phase | null>(null);
  const previous = useRef({
    enabled: false,
    open: false,
    pending: false,
    replyId,
  });
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const before = previous.current;
    // Keep the last completed reply while a request is pending, including React
    // renders where a reply and the mutation's pending flag settle separately.
    previous.current = {
      enabled,
      open,
      pending,
      replyId: pending ? before.replyId : replyId,
    };
    let next: Phase | null;
    if (!enabled) next = null;
    else if (open && pending) next = "thinking";
    else if (open && (!before.open || !before.enabled)) next = "opening";
    else if (open && replyId !== before.replyId && replyId > 0) next = "reply";
    else if (before.open && (!open || before.pending)) next = "leaving";
    else if (!before.enabled && firstVisit()) next = "welcome";
    else return;
    clearTimeout(timeout.current);
    setPhase(next);
    if (next && next !== "thinking") {
      const duration =
        next === "leaving" ? 450 : next === "reply" ? 1800 : 3200;
      timeout.current = setTimeout(() => setPhase(null), duration);
    }
  }, [enabled, open, pending, replyId]);
  useEffect(() => () => clearTimeout(timeout.current), []);
  return <EdgeGlow phase={enabled ? phase : null} />;
}
