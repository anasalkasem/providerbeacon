import { useEffect, useState } from "react";

const storageKey = "providerbeacon:service-comparison:v1";

export function serviceSelectionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (id): id is string =>
          typeof id === "string" && /^service-[1-9]\d{0,9}$/.test(id)
      )
    )
  ).slice(0, 4);
}

export function useServiceSelection() {
  const [ids, setIds] = useState<string[]>(() => {
    try {
      return serviceSelectionIds(
        JSON.parse(sessionStorage.getItem(storageKey) ?? "[]")
      );
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(ids));
    } catch {
      /* Comparing remains available when browser storage is disabled. */
    }
  }, [ids]);
  const toggle = (id: string) =>
    setIds(current =>
      current.includes(id)
        ? current.filter(value => value !== id)
        : serviceSelectionIds([...current, id])
    );
  return { ids, toggle, clear: () => setIds([]) };
}
