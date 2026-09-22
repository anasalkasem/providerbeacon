import type { MouseEvent } from "react";

/** Wouter doesn't change routes when Home is already selected. */
export function handleHomeNavigation(
  event: MouseEvent<HTMLAnchorElement>,
  path: string
) {
  if (
    path !== "/" ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}
