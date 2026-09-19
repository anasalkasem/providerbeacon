// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrbitRenderer } from "../client/src/components/orbit/renderer";
import { readThemePreview, resolveSiteTheme } from "../shared/siteThemes";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(reduced = false) {
  const gradient = { addColorStop: vi.fn() };
  const ctx = new Proxy(
    {
      createRadialGradient: () => gradient,
      createLinearGradient: () => gradient,
      drawImage: vi.fn(),
    },
    {
      get: (target, key) =>
        key in target ? target[key as keyof typeof target] : vi.fn(),
      set: () => true,
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as any
  );
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const media = new EventTarget() as EventTarget & { matches: boolean };
  media.matches = reduced;
  vi.stubGlobal("matchMedia", () => media);
  let next = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    frames.set(++next, fn);
    return next;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  let intersect: (entries: any[]) => void = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(fn: any) {
        intersect = fn;
      }
      observe() {}
      disconnect = disconnect;
    }
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect = disconnect;
    }
  );
  const canvas = document.createElement("canvas");
  const renderer = createOrbitRenderer(canvas)!;
  return {
    renderer,
    drawImage: ctx.drawImage,
    canvas,
    media,
    frames,
    intersect: (visible: boolean) => intersect([{ isIntersecting: visible }]),
    disconnect,
  };
}
describe("Orbit theme motion and preview boundaries", () => {
  it("allows only supported local previews and leaves retired choices on Classic", () => {
    expect(readThemePreview("orbit")).toBe("orbit");
    expect(readThemePreview("beacon")).toBe("beacon");
    expect(readThemePreview("studio")).toBe("studio");
    expect(resolveSiteTheme("studio")).toBe("studio");
    for (const value of [null, "fire", "navy", "unknown", {}]) {
      expect(readThemePreview(value)).toBeNull();
      expect(resolveSiteTheme(value)).toBe("beacon");
    }
  });
  it("cancels animation immediately when paused and resumes only one loop", () => {
    const s = setup();
    expect(s.canvas.dataset.renderState).toBe("ready");
    expect(s.frames.size).toBe(1);
    s.renderer.setRunning(false);
    expect(s.frames.size).toBe(0);
    expect(s.canvas.dataset.motion).toBe("paused");
    s.renderer.setRunning(true);
    s.renderer.setRunning(true);
    expect(s.frames.size).toBe(1);
    s.renderer.dispose();
    expect(s.frames.size).toBe(0);
  });
  it("renders a static scene for reduced motion and reacts when the preference changes", () => {
    const s = setup(true);
    expect(s.canvas.dataset.renderState).toBe("ready");
    expect(s.frames.size).toBe(0);
    s.media.matches = false;
    s.media.dispatchEvent(new Event("change"));
    expect(s.frames.size).toBe(1);
    s.media.matches = true;
    s.media.dispatchEvent(new Event("change"));
    expect(s.frames.size).toBe(0);
    s.renderer.dispose();
  });
  it("suspends rendering offscreen and in hidden tabs, and releases observers on unmount", () => {
    const s = setup();
    s.intersect(false);
    expect(s.frames.size).toBe(0);
    s.intersect(true);
    expect(s.frames.size).toBe(1);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(s.frames.size).toBe(0);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(s.frames.size).toBe(1);
    s.renderer.dispose();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(s.frames.size).toBe(0);
    expect(s.disconnect).toHaveBeenCalledTimes(2);
  });
  it("allows a static fallback when canvas is unavailable", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(createOrbitRenderer(document.createElement("canvas"))).toBeNull();
  });
  it("reveals late-loading artwork while paused without restarting motion or drawing after disposal", () => {
    const s = setup(true);
    const artwork = document.createElement("img");
    s.renderer.setArtwork(artwork);
    expect(s.canvas.dataset.artwork).toBeUndefined();
    Object.defineProperties(artwork, {
      complete: { value: true },
      naturalWidth: { value: 960 },
    });
    s.drawImage.mockClear();
    s.renderer.setArtwork(artwork);
    expect(s.drawImage).toHaveBeenCalledWith(
      artwork,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
    expect(s.frames.size).toBe(0);
    s.renderer.dispose();
    s.drawImage.mockClear();
    s.renderer.setArtwork(artwork);
    expect(s.drawImage).not.toHaveBeenCalled();
  });
});
