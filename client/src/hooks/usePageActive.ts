import { useEffect, useState } from "react";

export function usePageActive() {
  const active = () =>
    document.visibilityState !== "hidden" && document.hasFocus();
  const [value, setValue] = useState(active);
  useEffect(() => {
    const update = () => setValue(active());
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);
  return value;
}
