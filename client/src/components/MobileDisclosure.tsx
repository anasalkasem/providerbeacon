import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** One copy of the content: expanded on desktop, user-controlled on phones. */
export function MobileDisclosure({
  label,
  children,
  className = "",
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`mobile-disclosure ${className}`} data-expanded={expanded}>
      <button
        type="button"
        className="mobile-disclosure-toggle"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(value => !value)}
      >
        <span>{label}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </button>
      <div id={id} className="mobile-disclosure-content">
        {children}
      </div>
    </div>
  );
}
