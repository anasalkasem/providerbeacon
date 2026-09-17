/** A small optical signature shared by the Orbit assistant's entry and header. */
export function SignalMark({ className = "" }: { className?: string }) {
  return (
    <span className={`beacon-signal ${className}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <ellipse
          cx="24"
          cy="24"
          rx="17"
          ry="8"
          stroke="currentColor"
          strokeWidth="1"
          transform="rotate(-30 24 24)"
        />
        <ellipse
          cx="24"
          cy="24"
          rx="8"
          ry="17"
          stroke="currentColor"
          strokeWidth=".7"
          transform="rotate(-30 24 24)"
          opacity=".5"
        />
        <path
          d="M24 13v22M13 24h22"
          stroke="currentColor"
          strokeWidth=".7"
          opacity=".65"
        />
        <circle cx="24" cy="24" r="4" fill="currentColor" />
        <circle cx="24" cy="24" r="1.8" fill="white" />
        <circle cx="39" cy="16" r="1.6" fill="white" />
      </svg>
    </span>
  );
}
