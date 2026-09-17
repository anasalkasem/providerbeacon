import { lazy, Suspense, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Bookmark,
  FilePenLine,
  Pause,
  Play,
  Scale,
  Search,
} from "lucide-react";
import { PublicLayout } from "@/components/SiteChrome";
import { GuideGrid } from "@/components/Discovery";
import HomeComparison from "@/components/HomeComparison";
import { useLocale } from "@/contexts/LocaleContext";
import { discoveryText } from "@/i18n/discovery";
import { workspaceCopy } from "@/i18n/workspace";
import { landingCopy } from "@/i18n/landing";
import { VipAlbum } from "@/components/VipAlbum";
import { useSiteTheme } from "@/contexts/SiteAppearanceContext";
import { siteThemeCopy } from "@/i18n/siteThemes";
import { useOrbitMotion } from "@/components/orbit/useOrbitMotion";

const OrbitScene = lazy(() => import("@/components/orbit/OrbitScene"));

export default function Home() {
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  const l = landingCopy[locale];
  const d = discoveryText(locale);
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const isOrbit = useSiteTheme() === "orbit";
  const orbit = siteThemeCopy[locale].hero;
  const motion = useOrbitMotion();
  const steps = [
    { icon: FilePenLine, body: t.oneBody, href: "/find" },
    { icon: Scale, body: t.twoBody, href: "/compare" },
    { icon: Bookmark, body: t.threeBody, href: "/account" },
  ];
  return (
    <PublicLayout>
      <div
        className={`beacon-landing${isOrbit ? " orbit-home" : ""}`}
        data-motion={motion.stopped ? "paused" : "running"}
      >
        {isOrbit && (
          <div className="orbit-ambience" aria-hidden="true">
            <i />
            <i />
          </div>
        )}
        <section className="landing-hero container">
          <div className="landing-hero-copy">
            <p className="section-kicker">
              {isOrbit ? orbit.eyebrow : l.eyebrow}
            </p>
            <h1 className="landing-title">
              <span>{isOrbit ? orbit.title : t.title}</span>
              <span>{isOrbit ? orbit.accent : t.accent}</span>
            </h1>
            <p className="landing-intro">{isOrbit ? orbit.intro : t.intro}</p>
            <form
              className="landing-search"
              role="search"
              onSubmit={event => {
                event.preventDefault();
                const request = query.trim();
                navigate(
                  request ? `/find?q=${encodeURIComponent(request)}` : "/find"
                );
              }}
            >
              <label htmlFor="home-request" className="sr-only">
                {t.ask}
              </label>
              {isOrbit && <span className="orbit-search-label">{t.ask}</span>}
              <Search
                className="landing-search-icon size-5"
                aria-hidden="true"
              />
              <input
                id="home-request"
                type="search"
                maxLength={1200}
                dir={query ? "auto" : locale === "ar" ? "rtl" : "ltr"}
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={isOrbit ? t.examples[0] : t.ask}
              />
              {isOrbit && (
                <Link href="/services" className="orbit-search-browse">
                  {d.explore}
                </Link>
              )}
              <button type="submit" className="beacon-button">
                {l.search}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </button>
            </form>
            <div className="landing-examples">
              {t.examples.map(example => (
                <button
                  type="button"
                  key={example}
                  onClick={() =>
                    navigate(`/find?q=${encodeURIComponent(example)}`)
                  }
                >
                  {example}
                  {isOrbit && (
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3.5 shrink-0 rtl:rotate-180"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
          {isOrbit && (
            <figure className="orbit-visual">
              <div
                className="orbit-scene"
                role="img"
                aria-label={orbit.sceneLabel}
              >
                <Suspense
                  fallback={
                    <div className="orbit-scene-loading" aria-hidden="true" />
                  }
                >
                  <OrbitScene paused={motion.stopped} />
                </Suspense>
              </div>
              <figcaption>
                <span>{orbit.caption}</span>
                <button
                  type="button"
                  className="orbit-motion-control"
                  aria-pressed={motion.paused || motion.reduced}
                  disabled={motion.reduced}
                  onClick={() => motion.setPaused(value => !value)}
                >
                  {motion.paused || motion.reduced ? (
                    <Play className="size-3.5" />
                  ) : (
                    <Pause className="size-3.5" />
                  )}
                  {motion.reduced
                    ? orbit.reduced
                    : motion.paused
                      ? orbit.resume
                      : orbit.pause}
                </button>
              </figcaption>
            </figure>
          )}
        </section>
        <div className="container">
          <HomeComparison />
        </div>
        <section
          id="how-it-works"
          className="landing-process container scroll-mt-24"
          aria-labelledby="home-process-title"
        >
          <h2 id="home-process-title">{l.process}</h2>
          <div className="landing-steps">
            {steps.map(({ icon: Icon, body, href }, index) => (
              <Link key={href} href={href} className="landing-step">
                <div className="landing-step-symbol">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Icon strokeWidth={1.6} />
                </div>
                <h3>{l.steps[index]}</h3>
                <p>{body}</p>
              </Link>
            ))}
          </div>
        </section>
        <VipAlbum title={l.providers} />
        <section className="landing-closing container">
          <h2>{l.closing}</h2>
          <p>{l.closingBody}</p>
          <Link
            href="/services"
            className="beacon-button inline-flex items-center gap-3 px-7 py-4"
          >
            {d.explore}
            <ArrowRight className="size-5 rtl:rotate-180" />
          </Link>
        </section>
        <section
          id="methodology"
          className="landing-details container scroll-mt-24"
        >
          <details>
            <summary>{d.method}</summary>
            <div className="grid gap-8 pt-6 md:grid-cols-2">
              <div>
                <h3>{d.evidence}</h3>
                <p>{d.methodBody}</p>
              </div>
              <div>
                <h3>{d.independence}</h3>
                <p>{d.independenceBody}</p>
              </div>
            </div>
          </details>
          <details>
            <summary>{d.guideTitle}</summary>
            <div className="pt-6">
              <GuideGrid />
            </div>
          </details>
          <details id="about" className="scroll-mt-24">
            <summary>{d.about}</summary>
            <p>{d.aboutBody}</p>
          </details>
        </section>
      </div>
    </PublicLayout>
  );
}
