import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { vipText } from "@/i18n/providerVip";
import {
  advanceRibbon,
  ribbonCardPosition,
  wrapRibbonDistance,
} from "@/lib/vipRibbonMotion";
import { VipCard, type VipCardData } from "./VipCard";

export function VipRibbon({ cards }: { cards: VipCardData[] }) {
  if (!cards.length) return null;
  if (cards.length === 1)
    return (
      <div className="mx-auto w-full max-w-[520px]">
        <VipCard card={cards[0]} compact />
      </div>
    );
  return <MovingRibbon cards={cards} />;
}

function MovingRibbon({ cards }: { cards: VipCardData[] }) {
  const { locale } = useLocale();
  const t = vipText(locale);
  const rtl = locale === "ar";
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const distance = useRef(0);
  const pitch = useRef(0);
  const selectedRef = useRef(0);
  const drag = useRef<{
    x: number;
    distance: number;
    pointerId: number;
  } | null>(null);
  const dragged = useRef(false);
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [onScreen, setOnScreen] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const running =
    !paused && !hovered && !reducedMotion && onScreen && !pageHidden;

  const draw = useCallback(() => {
    if (!track.current || !pitch.current) return;
    Array.from(track.current.children).forEach((element, index) => {
      const position = ribbonCardPosition(
        index,
        distance.current,
        pitch.current,
        cards.length
      );
      const offset = (position - index * pitch.current) * (rtl ? -1 : 1);
      (element as HTMLElement).style.transform =
        `translate3d(${offset}px, 0, 0)`;
    });
    const index = Math.floor(distance.current / pitch.current) % cards.length;
    if (index !== selectedRef.current) {
      selectedRef.current = index;
      setSelected(index);
    }
  }, [cards.length, rtl]);

  useEffect(() => {
    const measure = () => {
      const first = track.current?.firstElementChild as HTMLElement | null;
      if (!first || !track.current) return;
      const nextPitch =
        first.getBoundingClientRect().width +
        (parseFloat(getComputedStyle(track.current).columnGap) || 0);
      if (nextPitch <= 0) return;
      const progress = pitch.current ? distance.current / pitch.current : 0;
      pitch.current = nextPitch;
      distance.current = wrapRibbonDistance(
        progress * nextPitch,
        cards.length * nextPitch
      );
      draw();
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    if (observer && viewport.current) observer.observe(viewport.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [cards.length, draw]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    const updateVisibility = () =>
      setPageHidden(document.visibilityState !== "visible");
    updatePreference();
    updateVisibility();
    preference.addEventListener("change", updatePreference);
    document.addEventListener("visibilitychange", updateVisibility);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            entries =>
              setOnScreen(
                entries.some(
                  entry =>
                    entry.isIntersecting && entry.intersectionRatio >= 0.15
                )
              ),
            { threshold: [0, 0.15] }
          );
    if (observer && root.current) observer.observe(root.current);
    else setOnScreen(true);
    return () => {
      preference.removeEventListener("change", updatePreference);
      document.removeEventListener("visibilitychange", updateVisibility);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    let frame: number;
    let previous: number | undefined;
    const tick = (now: number) => {
      if (previous !== undefined) {
        distance.current = advanceRibbon(
          distance.current,
          now - previous,
          pitch.current * cards.length
        );
        draw();
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, cards.length, draw]);

  const goTo = (index: number) => {
    setPaused(true);
    distance.current = wrapRibbonDistance(
      index * pitch.current,
      cards.length * pitch.current
    );
    draw();
  };
  const manualMove = (direction: number) => {
    const progress = pitch.current ? distance.current / pitch.current : 0;
    goTo(direction > 0 ? Math.floor(progress) + 1 : Math.ceil(progress) - 1);
  };

  return (
    <div
      ref={root}
      className="vip-ribbon"
      data-count={cards.length}
      style={
        { "--vip-min-width": `${100 / (cards.length - 1)}%` } as CSSProperties
      }
      dir={rtl ? "rtl" : "ltr"}
      role="group"
      aria-roledescription={t.carousel}
      aria-label={t.title}
      onPointerEnter={event => {
        if (event.pointerType !== "touch") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      <div
        ref={viewport}
        className="vip-ribbon-viewport"
        onFocusCapture={event => {
          setPaused(true);
          if (drag.current) return;
          const slide = (event.target as HTMLElement).closest<HTMLElement>(
            "[data-vip-index]"
          );
          if (!slide || !viewport.current) return;
          const index = Number(slide.dataset.vipIndex);
          const position = ribbonCardPosition(
            index,
            distance.current,
            pitch.current,
            cards.length
          );
          if (
            position < 0 ||
            position + slide.getBoundingClientRect().width >
              viewport.current.clientWidth
          )
            goTo(index);
        }}
        onKeyDown={event => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          manualMove((event.key === "ArrowRight") !== rtl ? 1 : -1);
        }}
        onPointerDown={event => {
          if (event.button !== 0) return;
          setPaused(true);
          dragged.current = false;
          drag.current = {
            x: event.clientX,
            distance: distance.current,
            pointerId: event.pointerId,
          };
        }}
        onPointerMove={event => {
          if (!drag.current || event.pointerId !== drag.current.pointerId)
            return;
          const delta = event.clientX - drag.current.x;
          if (!dragged.current && Math.abs(delta) < 8) return;
          if (!dragged.current)
            event.currentTarget.setPointerCapture(event.pointerId);
          dragged.current = true;
          distance.current = wrapRibbonDistance(
            drag.current.distance + delta * (rtl ? 1 : -1),
            cards.length * pitch.current
          );
          draw();
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onDragStart={event => event.preventDefault()}
        onClickCapture={event => {
          if (dragged.current) {
            event.preventDefault();
            event.stopPropagation();
            dragged.current = false;
          }
        }}
      >
        <div ref={track} className="vip-ribbon-track">
          {cards.map((card, index) => (
            <div
              key={`${card.providerId}:${card.revision}`}
              className="vip-ribbon-slide"
              data-vip-index={index}
            >
              <VipCard card={card} compact />
            </div>
          ))}
        </div>
      </div>
      <div
        className="mt-3 flex flex-wrap items-center justify-center gap-4"
        role="group"
        aria-label={t.navigation}
      >
        <button
          type="button"
          className="vip-ribbon-control"
          aria-label={t.previous}
          onClick={() => manualMove(-1)}
        >
          <ChevronLeft className="size-5 rtl:rotate-180" />
        </button>
        <div className="flex flex-wrap items-center justify-center gap-1">
          {cards.map((card, index) => (
            <button
              key={card.providerId}
              type="button"
              className="grid size-8 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-beacon-700"
              aria-label={`${t.goTo} ${index + 1}`}
              aria-current={index === selected ? "true" : undefined}
              onClick={() => goTo(index)}
            >
              <span
                className={`h-1.5 rounded-full transition-all motion-reduce:transition-none ${index === selected ? "w-6 bg-beacon-700" : "w-1.5 bg-slate-300"}`}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="vip-ribbon-control"
          aria-label={t.next}
          onClick={() => manualMove(1)}
        >
          <ChevronRight className="size-5 rtl:rotate-180" />
        </button>
        {!reducedMotion && (
          <button
            type="button"
            className="vip-ribbon-control w-auto gap-2 px-4 text-xs font-bold"
            aria-label={paused ? t.play : t.pause}
            onClick={() => setPaused(value => !value)}
          >
            {paused ? (
              <Play className="size-3.5" />
            ) : (
              <Pause className="size-3.5" />
            )}
            {paused ? t.play : t.pause}
          </button>
        )}
      </div>
    </div>
  );
}
