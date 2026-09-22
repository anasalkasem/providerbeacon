import { z } from "zod";

export const providerSelectionInput = z
  .array(z.number().int().positive().max(2147483647))
  .max(4)
  .optional();

// URL selections are bounded public record IDs, never provider names or SQL.
export function providerSelection(value: string | null): number[] {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .filter(id => /^[1-9]\d{0,9}$/.test(id))
        .map(Number)
        .filter(id => id <= 2147483647)
    )
  ).slice(0, 4);
}

export function providerSearchUrl(query: string, ids: number[] = []) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim().slice(0, 1200));
  if (ids.length)
    params.set("providers", providerSelection(ids.join(",")).join(","));
  return "/find" + (params.size ? "?" + params.toString() : "");
}
