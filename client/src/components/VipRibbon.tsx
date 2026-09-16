import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { vipText } from "@/i18n/providerVip";
import { VipCard, type VipCardData } from "./VipCard";

export function VipRibbon({ cards }: { cards: VipCardData[] }) {
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
  const [viewport, api] = useEmblaCarousel({
    align: "start",
    loop: true,
    duration: 40,
    direction: rtl ? "rtl" : "ltr",
  });
  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [onScreen, setOnScreen] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const canMove = snaps.length > 1;
  const running =
    canMove && !paused && !hovered && !reducedMotion && onScreen && !pageHidden;

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
            entries => {
              setOnScreen(
                entries.some(
                  entry =>
                    entry.isIntersecting && entry.intersectionRatio >= 0.15
                )
              );
            },
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
    if (!api) return;
    const sync = () => {
      setSnaps(api.scrollSnapList());
      setSelected(api.selectedScrollSnap());
    };
    const stopForInteraction = () => setPaused(true);
    sync();
    api
      .on("select", sync)
      .on("reInit", sync)
      .on("pointerDown", stopForInteraction);
    return () => {
      api
        .off("select", sync)
        .off("reInit", sync)
        .off("pointerDown", stopForInteraction);
    };
  }, [api]);

  const move = useCallback(
    (direction: number) => {
      if (!api) return;
      if (direction > 0) {
        if (api.canScrollNext()) api.scrollNext(reducedMotion);
        else api.scrollTo(0, reducedMotion);
      } else {
        if (api.canScrollPrev()) api.scrollPrev(reducedMotion);
        else api.scrollTo(api.scrollSnapList().length - 1, reducedMotion);
      }
    },
    [api, reducedMotion]
  );

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => move(1), 5000);
    return () => window.clearInterval(timer);
  }, [running, move]);

  const manualMove = (direction: number) => {
    setPaused(true);
    move(direction);
  };
  return (
    <div
      ref={root}
      className="vip-ribbon"
      data-count={cards.length}
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
        onFocusCapture={() => setPaused(true)}
        onKeyDown={event => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          manualMove((event.key === "ArrowRight") !== rtl ? 1 : -1);
        }}
      >
        <div className="vip-ribbon-track">
          {cards.map(card => (
            <div
              key={`${card.providerId}:${card.revision}`}
              className="vip-ribbon-slide"
            >
              <VipCard card={card} compact />
            </div>
          ))}
        </div>
      </div>
      {canMove && (
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
            {snaps.map((_, index) => (
              <button
                key={index}
                type="button"
                className="grid size-8 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-beacon-700"
                aria-label={`${t.goTo} ${index + 1}`}
                aria-current={index === selected ? "true" : undefined}
                onClick={() => {
                  setPaused(true);
                  api?.scrollTo(index, reducedMotion);
                }}
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
      )}
    </div>
  );
}
