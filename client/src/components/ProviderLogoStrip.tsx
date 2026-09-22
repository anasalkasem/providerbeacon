import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Provider } from "@/data/marketplace";
import { useLocale } from "@/contexts/LocaleContext";
import { homeDiscoveryCopy } from "@/i18n/homeDiscovery";
import { useOrbitMotion } from "./orbit/useOrbitMotion";
import { ProviderLogo } from "./ProviderMedia";

export function ProviderLogoStrip({ providers }: { providers: Provider[] }) {
  const { locale } = useLocale();
  const t = homeDiscoveryCopy[locale];
  const motion = useOrbitMotion();
  const viewport = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLUListElement>(null);
  const [copies, setCopies] = useState(1);
  const [cycleWidth, setCycleWidth] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [visible, setVisible] = useState(true);
  const key = providers.map(provider => provider.id).join(",");
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => {
      const list = group.current;
      const first = list?.firstElementChild;
      if (!list || !first || !providers.length) return;
      const pitch =
        first.getBoundingClientRect().width +
        (parseFloat(getComputedStyle(list).columnGap) || 0);
      if (!pitch) return;
      // Fill one whole viewport before repeating the same sequence. Four
      // providers must still move on a wide desktop, without a blank interval.
      setCopies(
        Math.max(1, Math.ceil(node.clientWidth / (pitch * providers.length)))
      );
      setCycleWidth(list.getBoundingClientRect().width);
    };
    measure();
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    resize?.observe(node);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(entries =>
            setVisible(entries.some(entry => entry.isIntersecting))
          );
    observer?.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      resize?.disconnect();
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [key, copies, motion.reduced]);
  useEffect(() => {
    const node = viewport.current;
    if (
      !node ||
      motion.stopped ||
      hovered ||
      focused ||
      touching ||
      !visible ||
      !cycleWidth
    )
      return;
    let previous: number | undefined;
    let position = node.scrollLeft % cycleWidth;
    let frame: number;
    const advance = (now: number) => {
      if (previous !== undefined) {
        // Fractional position avoids rounding away slow movement. Geometry is
        // measured on resize only, never read in the animation loop.
        position =
          (position + Math.min(now - previous, 100) * 0.032) % cycleWidth;
        node.scrollLeft = position;
      }
      previous = now;
      frame = window.requestAnimationFrame(advance);
    };
    frame = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(frame);
  }, [motion.stopped, hovered, focused, touching, visible, cycleWidth, key]);
  const move = (direction: number) => {
    motion.setPaused(true);
    const node = viewport.current;
    if (node)
      node.scrollBy({
        left: direction * Math.max(120, node.clientWidth * 0.65),
        behavior: motion.reduced ? "instant" : "smooth",
      });
  };
  if (!providers.length) return null;
  return (
    <section className="home-logo-section" aria-label={t.logos}>
      <div className="home-logo-toolbar">
        <p>{t.logos}</p>
        {providers.length > 0 && (
          <div className="home-logo-controls" dir="ltr">
            <button
              type="button"
              aria-label={t.previous}
              onClick={() => move(-1)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            {!motion.reduced && (
              <button
                type="button"
                aria-label={motion.paused ? t.play : t.pause}
                onClick={() => motion.setPaused(value => !value)}
              >
                {motion.paused ? (
                  <Play aria-hidden="true" />
                ) : (
                  <Pause aria-hidden="true" />
                )}
              </button>
            )}
            <button type="button" aria-label={t.next} onClick={() => move(1)}>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <div
        ref={viewport}
        className="home-logo-strip"
        dir="ltr"
        onPointerEnter={event => {
          if (event.pointerType !== "touch") setHovered(true);
        }}
        onPointerLeave={() => {
          setHovered(false);
          setTouching(false);
        }}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(false);
        }}
        onPointerDown={() => setTouching(true)}
        onPointerUp={() => setTouching(false)}
        onPointerCancel={() => setTouching(false)}
        onWheelCapture={event => {
          if (event.deltaX) motion.setPaused(true);
        }}
      >
        {Array.from({ length: motion.reduced ? 1 : 2 }, (_, sequence) => (
          <ul
            key={sequence}
            ref={sequence === 0 ? group : undefined}
            className="home-logo-group"
            aria-hidden={sequence === 1 ? true : undefined}
          >
            {Array.from({ length: motion.reduced ? 1 : copies }, (_, copy) =>
              providers.map(provider => (
                <li
                  key={`${copy}-${provider.id}`}
                  aria-hidden={copy > 0 ? true : undefined}
                >
                  <Link
                    href={"/providers/" + provider.slug}
                    aria-label={provider.name}
                    tabIndex={sequence > 0 || copy > 0 ? -1 : undefined}
                  >
                    <ProviderLogo
                      src={provider.logoUrl}
                      name={provider.name}
                      initials={provider.initials}
                      className="home-strip-logo"
                    />
                    <span dir="auto">{provider.name}</span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        ))}
      </div>
    </section>
  );
}
