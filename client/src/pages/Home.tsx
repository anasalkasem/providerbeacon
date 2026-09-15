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
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { discoveryText } from "@/i18n/discovery";
import { workspaceCopy } from "@/i18n/workspace";
import { DecisionOffer } from "@/components/DecisionOffer";

export default function Home() {
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  const d = discoveryText(locale);
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const { services, providerFor } = useMarketplaceData();
  const steps = [
    { icon: Sparkles, title: t.oneStep, body: t.oneBody },
    { icon: SlidersHorizontal, title: t.twoStep, body: t.twoBody },
    { icon: Bookmark, title: t.threeStep, body: t.threeBody },
  ];
  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-[#081B30] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-32 -top-32 size-[500px] rounded-full bg-teal-400/10 blur-3xl"
        />
        <div className="container relative grid items-center gap-10 py-12 lg:grid-cols-[1.4fr_.7fr] lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/5 px-3 py-2 text-[11px] font-bold tracking-wide text-teal-200">
              <Sparkles className="size-4" />
              {t.eyebrow}
            </p>
            <h1 className="mt-6 text-[clamp(2rem,4.3vw,4.3rem)] font-extrabold leading-[1.25] tracking-tight">
              {t.title}
              <br />
              <span className="text-[#53E1C0]">{t.accent}</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
              {t.intro}
            </p>
            <form
              className="mt-7 rounded-2xl border border-white/15 bg-white p-2 shadow-2xl"
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
                className="w-full resize-none rounded-xl bg-white p-4 text-base leading-7 text-slate-950 outline-none focus:ring-2 focus:ring-teal-400"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t.ask}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-2">
                <Link
                  href="/services"
                  className="px-2 text-xs font-bold text-slate-500 hover:text-teal-800"
                >
                  {t.browse}
                </Link>
                <button
                  disabled={!query.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
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
                  className="rounded-full border border-white/15 px-3 py-2 text-xs text-slate-300 hover:border-teal-300 hover:text-teal-200"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5 lg:p-6">
            <p
              dir="ltr"
              className="mb-6 text-xs font-bold tracking-[.2em] text-teal-300"
            >
              PROVIDERBEACON
            </p>
            <div className="space-y-6">
              {steps.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-300/10 text-teal-200">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold">{title}</h2>
                    <p className="mt-2 text-xs leading-6 text-slate-400">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/account"
              className="mt-7 flex items-center justify-between gap-3 border-t border-white/10 pt-5 text-sm font-bold text-teal-200"
            >
              {t.workspace}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </section>
      {services.length > 0 && (
        <section className="container py-10 sm:py-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">{t.browse}</p>
              <h2 className="mt-2 text-2xl font-extrabold">
                {locale === "ar"
                  ? "ابدأ من خدمة، وافهم تفاصيلها."
                  : locale === "es"
                    ? "Empieza por un servicio y conoce sus condiciones."
                    : locale === "zh"
                      ? "从一项服务开始，了解其条款。"
                      : locale === "hi"
                        ? "एक सेवा से शुरू करें और उसकी शर्तें समझें।"
                        : "Start with a service. Understand its terms."}
              </h2>
            </div>
            <Link className="font-bold text-teal-800" href="/services">
              {t.browse} →
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {services.slice(0, 3).map(service => (
              <DecisionOffer
                key={service.id}
                service={service}
                provider={providerFor(service)}
                quantity={1000}
              />
            ))}
          </div>
        </section>
      )}
      <section id="methodology" className="container scroll-mt-24 py-12">
        <div className="grid gap-7 rounded-2xl border border-slate-200 bg-white p-6 lg:grid-cols-2 sm:p-9">
          <div>
            <p className="section-kicker">{d.method}</p>
            <h2 className="mt-3 text-2xl font-extrabold leading-relaxed">
              {d.evidence}
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-600">
              {d.evidenceBody}
            </p>
          </div>
          <div className="space-y-5">
            <div>
              <h3 className="font-bold">{d.method}</h3>
              <p className="mt-2 text-sm leading-8 text-slate-600">
                {d.methodBody}
              </p>
            </div>
            <div className="border-t border-slate-100 pt-5">
              <h3 className="font-bold">{d.independence}</h3>
              <p className="mt-2 text-sm leading-8 text-slate-600">
                {d.independenceBody}
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="container py-8">
        <details className="rounded-2xl border border-slate-200 bg-white p-6">
          <summary className="cursor-pointer text-lg font-bold">
            {d.guideTitle}
          </summary>
          <div className="mt-6">
            <GuideGrid />
          </div>
        </details>
      </section>
      <section id="about" className="container py-12">
        <h2 className="text-xl font-extrabold">{d.about}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-8 text-slate-600">
          {d.aboutBody}
        </p>
      </section>
    </PublicLayout>
  );
}
