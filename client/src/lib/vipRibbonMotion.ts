export const VIP_RIBBON_SPEED = 42; // CSS pixels per second, independent of refresh rate.

export function wrapRibbonDistance(distance: number, cycle: number) {
  return cycle > 0 ? ((distance % cycle) + cycle) % cycle : 0;
}

export function advanceRibbon(
  distance: number,
  elapsed: number,
  cycle: number
) {
  // A stalled frame must not make the ads jump when the browser catches up.
  return wrapRibbonDistance(
    distance + (VIP_RIBBON_SPEED * Math.min(Math.max(elapsed, 0), 64)) / 1000,
    cycle
  );
}

export function ribbonCardPosition(
  index: number,
  distance: number,
  pitch: number,
  count: number
) {
  // The CSS minimum card width leaves one whole card outside the viewport.
  // Recycle that card there, never move a visible card back across the screen.
  return (
    wrapRibbonDistance((index + 1) * pitch - distance, count * pitch) - pitch
  );
}
