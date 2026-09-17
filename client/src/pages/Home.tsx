import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Bookmark,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { PublicLayout } from "@/components/SiteChrome";
import { GuideGrid } from "@/components/Discovery";
import { useLocale } from "@/contexts/LocaleContext";
import { discoveryText } from "@/i18n/discovery";
import { workspaceCopy } from "@/i18n/workspace";
import { VipAlbum } from "@/components/VipAlbum";
import { vipText } from "@/i18n/providerVip";

export default function Home() {
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  const d = discoveryText(locale);
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const steps = [
    { icon: Sparkles, title: t.oneStep, body: t.oneBody },
    { icon: SlidersHorizontal, title: t.twoStep, body: t.twoBody },
    { icon: Bookmark, title: t.threeStep, body: t.threeBody },
  ];
  return (
    <PublicLayout>
      <section className="beacon-hero">
        <div className="container relative grid items-center gap-12 py-12 lg:grid-cols-[1.5fr_1fr] lg:gap-20 lg:py-20">
          <div>
            <p className="section-kicker">
              {t.eyebrow}
            </p>
            <h1 className="beacon-hero-title mt-6">
              {t.title}
              <br />
              <span className="text-heading">{t.accent}</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground">
              {t.intro}
            </p>
            <form
              className="beacon-search mt-8 rounded-lg p-2"
              onSubmit={e => {
                e.preventDefault();
                if (query.trim())
                  navigate(`/find?q=${encodeURIComponent(query.trim())}`);
              }}
            >
              <label htmlFor="home-request" className="sr-only">
                {t.ask}
              </label>
              <textarea
                id="home-request"
                rows={2}
                maxLength={1200}
                dir="auto"
                className="w-full resize-none rounded-xl bg-transparent p-4 text-base leading-7 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t.ask}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-2">
                <Link
                  href="/services"
                  className="px-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {t.browse}
                </Link>
                <button
                  disabled={!query.trim()}
                  className="beacon-button inline-flex min-h-11 items-center gap-2 px-5 py-3 text-sm"
                >
                  <Search className="size-4" />
                  {t.search}
                </button>
              </div>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {t.examples.map(example => (
                <button
                  type="button"
                  key={example}
                  onClick={() =>
                    navigate(`/find?q=${encodeURIComponent(example)}`)
                  }
                  className="rounded-full border border-input px-3 py-2 text-xs text-muted-foreground hover:border-ring hover:text-foreground"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
          <div className="beacon-guide rounded-lg p-6 lg:p-8">
            <p
              dir="ltr"
              className="mb-3 text-xs tracking-[.18em] text-muted-foreground"
            >
              PROVIDERBEACON
            </p>
            <div>
              {steps.map(({ icon: Icon, title, body }) => (
                <div key={title} className="beacon-guide-step flex gap-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full border border-input text-muted-foreground">
                    <Icon className="size-4" strokeWidth={1.25} />
                  </div>
                  <div>
                    <h2 className="text-base font-medium">{title}</h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/account"
              className="mt-2 flex items-center justify-between gap-3 border-t border-input pt-5 text-sm text-heading"
            >
              {t.workspace}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </section>
      <VipAlbum />
      <div className="container flex justify-center pb-4">
        <Link
          href="/services"
          className="inline-flex min-h-12 items-center gap-3 rounded-full border border-input bg-card px-6 py-3 text-sm font-bold text-foreground hover:border-ring"
        >
          <Search className="size-4" />
          {vipText(locale).browseServices}
          <ArrowRight className="size-4 rtl:rotate-180" />
        </Link>
      </div>
      <section id="methodology" className="editorial-section container scroll-mt-24">
        <div className="grid gap-10 border-y border-border py-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="section-kicker">{d.method}</p>
            <h2 className="display-heading mt-4 text-4xl sm:text-5xl">
              {d.evidence}
            </h2>
            <p className="mt-6 text-base leading-8 text-muted-foreground">
              {d.evidenceBody}
            </p>
          </div>
          <div className="space-y-5">
            <div>
              <h3 className="font-bold">{d.method}</h3>
              <p className="mt-3 text-base leading-8 text-muted-foreground">
                {d.methodBody}
              </p>
            </div>
            <div className="border-t border-border pt-5">
              <h3 className="font-bold">{d.independence}</h3>
              <p className="mt-3 text-base leading-8 text-muted-foreground">
                {d.independenceBody}
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="container py-8">
        <details className="rounded-2xl border border-border bg-card p-6">
          <summary className="cursor-pointer text-lg font-bold">
            {d.guideTitle}
          </summary>
          <div className="mt-6">
            <GuideGrid />
          </div>
        </details>
      </section>
      <section id="about" className="editorial-section container">
        <h2 className="display-heading text-4xl">{d.about}</h2>
        <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground">
          {d.aboutBody}
        </p>
      </section>
    </PublicLayout>
  );
}
