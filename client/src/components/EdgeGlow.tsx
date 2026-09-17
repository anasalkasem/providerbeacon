import "./edge-glow.css";

export function EdgeGlow({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <div className="beacon-edge-glow" aria-hidden="true">
      <div className="beacon-edge-glow__halo" />
      <div className="beacon-edge-glow__rim" />
    </div>
  );
}
