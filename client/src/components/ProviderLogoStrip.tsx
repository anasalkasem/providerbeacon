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
  const viewport = useRef<HTMLUListElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(true);
  const key = providers.map(provider => provider.id).join(",");
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => setOverflow(node.scrollWidth > node.clientWidth + 2);
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
  }, [key]);
  useEffect(() => {
    if (motion.stopped || hovered || !visible || !overflow) return;
    const timer = window.setInterval(() => {
      const node = viewport.current;
      if (!node) return;
      const step =
        (node.firstElementChild?.getBoundingClientRect().width ?? 120) + 12;
      node.scrollTo({
        left:
          node.scrollLeft >= node.scrollWidth - node.clientWidth - 2
            ? 0
            : node.scrollLeft + step,
        behavior: "smooth",
      });
    }, 4500);
    return () => window.clearInterval(timer);
  }, [motion.stopped, hovered, visible, overflow, key]);
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
        {overflow && (
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
      <ul
        ref={viewport}
        className="home-logo-strip"
        dir="ltr"
        onPointerEnter={event => {
          if (event.pointerType !== "touch") setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocusCapture={() => motion.setPaused(true)}
        onPointerDown={() => motion.setPaused(true)}
        onWheelCapture={() => motion.setPaused(true)}
      >
        {providers.map(provider => (
          <li key={provider.id}>
            <Link
              href={"/providers/" + provider.slug}
              aria-label={provider.name}
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
        ))}
      </ul>
    </section>
  );
}
