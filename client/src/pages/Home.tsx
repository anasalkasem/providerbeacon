import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Bookmark, FilePenLine, Scale, Search } from "lucide-react";
import { PublicLayout } from "@/components/SiteChrome";
import { GuideGrid } from "@/components/Discovery";
import HomeComparison from "@/components/HomeComparison";
import { useLocale } from "@/contexts/LocaleContext";
import { discoveryText } from "@/i18n/discovery";
import { workspaceCopy } from "@/i18n/workspace";
import { landingCopy } from "@/i18n/landing";
import { VipAlbum } from "@/components/VipAlbum";

export default function Home() {
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  const l = landingCopy[locale];
  const d = discoveryText(locale);
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const steps = [
    { icon: FilePenLine, body: t.oneBody, href: "/find" },
    { icon: Scale, body: t.twoBody, href: "/compare" },
    { icon: Bookmark, body: t.threeBody, href: "/account" },
  ];
  return (
    <PublicLayout>
      <div className="beacon-landing">
        <section className="landing-hero container">
          <p className="section-kicker">{l.eyebrow}</p>
          <h1 className="landing-title">
            <span>{t.title}</span>
            <span>{t.accent}</span>
          </h1>
          <p className="landing-intro">{t.intro}</p>
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
            <Search className="landing-search-icon size-5" aria-hidden="true" />
            <input
              id="home-request"
              type="search"
              maxLength={1200}
              dir="auto"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t.ask}
            />
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
              </button>
            ))}
          </div>
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
