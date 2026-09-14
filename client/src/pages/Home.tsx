import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  Compass,
  SlidersHorizontal,
  FileCheck2,
  ScanLine,
} from "lucide-react";
import { PublicLayout } from "@/components/SiteChrome";
import { GuideGrid } from "@/components/Discovery";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { discoveryText } from "@/i18n/discovery";
import { ProviderCard } from "@/components/Marketplace";
import SmmOfferTable from "@/components/SmmOfferTable";
import type { Service } from "@/data/marketplace";
export default function Home() {
  const { locale } = useLocale();
  const t = discoveryText(locale);
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const { services, providers } = useMarketplaceData();
  const [selected, setSelected] = useState<Service[]>([]);
  const ar = locale === "ar";
  const toggle = (service: Service) =>
    setSelected(current =>
      current.some(item => item.id === service.id)
        ? current.filter(item => item.id !== service.id)
        : current.length < 4
          ? [...current, service]
          : current
    );
  const steps = [
    { icon: Compass, title: t.stepOne, body: t.stepOneBody },
    { icon: SlidersHorizontal, title: t.stepTwo, body: t.stepTwoBody },
    { icon: FileCheck2, title: t.stepThree, body: t.stepThreeBody },
  ];
  return (
    <PublicLayout>
      <div lang={locale === "ar" ? "ar" : "en"}>
        <section className="relative overflow-hidden bg-[#081B30] text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -end-36 -top-32 size-[600px] rounded-full bg-teal-500/10 blur-3xl"
          />
          <div className="container relative grid items-center gap-14 py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/5 px-3 py-1.5 text-xs font-bold tracking-wide text-teal-200">
                <span className="size-1.5 rounded-full bg-teal-300" />
                {t.beta}
              </p>
              <h1 className="mt-7 text-[clamp(2.8rem,5.8vw,5.4rem)] font-extrabold leading-[1.18] tracking-tight">
                {ar ? "ابحث عن مزودي SMM." : "Find SMM providers."}
                <br />
                <span className="text-[#53E1C0]">
                  {ar ? "قارن العروض بثقة." : "Compare their offers."}
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                {ar
                  ? "أسعار المتابعين والمشاهدات والإعجابات في مكان واحد. قارن سعر الألف وحدود الطلب والتعويض بين المزودين."
                  : "Followers, views and likes in one place. Compare prices per 1,000, order limits and refill terms across providers."}
              </p>
              <form
                className="mt-9 flex flex-col gap-2 rounded-2xl border border-white/15 bg-white/5 p-2 sm:flex-row"
                onSubmit={e => {
                  e.preventDefault();
                  navigate(
                    `/services${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`
                  );
                }}
              >
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">{t.search}</span>
                  <Search className="absolute start-4 top-4 size-5 text-slate-400" />
                  <input
                    className="h-14 w-full rounded-xl bg-white ps-12 pe-4 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-teal-300"
                    value={query}
                    maxLength={100}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={t.searchHint}
                  />
                </label>
                <button className="h-14 rounded-xl bg-[#53E1C0] px-5 text-sm font-extrabold text-[#081B30] hover:bg-teal-200">
                  {t.explore}
                  <ArrowRight className="ms-2 inline size-4 rtl:rotate-180" />
                </button>
              </form>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Instagram", "TikTok", "YouTube", "Telegram"].map(p => (
                  <Link
                    key={p}
                    href={`/services?q=${p}`}
                    className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-teal-200 hover:text-teal-200"
                  >
                    {p}
                  </Link>
                ))}
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-lg">
              <div
                className="absolute -inset-5 rounded-[2rem] border border-white/5"
                aria-hidden="true"
              />
              <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#0D263F] shadow-2xl">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 p-5">
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <ScanLine className="size-5 text-teal-300" />
                    PROVIDERBEACON
                  </span>
                  <span className="rounded-md bg-teal-300/10 px-2 py-1 text-[10px] font-bold text-teal-200">
                    {ar ? "بيانات من اتصالات المزودين" : "Data from provider connections"}
                  </span>
                </div>
                <div className="space-y-3 p-5">
                  {steps.map(({ icon: Icon, title, body }) => (
                    <div
                      key={title}
                      className="flex gap-4 rounded-xl border border-white/10 bg-white/[.035] p-5"
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-300/10 text-teal-200">
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
                  <Link
                    href="/services?platform=Instagram&category=Followers"
                    className="flex items-center justify-between rounded-xl bg-white p-4 text-sm font-extrabold text-[#0B2A68]"
                  >
                    {t.compare}
                    <ArrowUpRight className="size-5 rtl:-rotate-90" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="container py-10">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold">
              {ar
                ? "قارن عروض متابعي Instagram"
                : "Compare Instagram follower offers"}
            </h2>
            <Link href="/services" className="font-bold text-teal-700">
              {ar ? "جميع عروض SMM ←" : "All SMM offers →"}
            </Link>
          </div>
          <SmmOfferTable
            services={services}
            selected={selected}
            toggle={toggle}
          />
          {services.length === 0 && (
            <p className="p-6 text-center text-slate-500">
              {ar
                ? "تظهر هنا عروض SMM بعد نشرها."
                : "Published SMM offers will appear here."}
            </p>
          )}
          {selected.length > 0 && (
            <button
              disabled={selected.length < 2}
              onClick={() =>
                navigate(
                  `/compare?services=${selected.map(service => service.id).join(",")}`
                )
              }
              className="mt-4 rounded-xl bg-[#0B2A48] px-6 py-3 font-bold text-white disabled:opacity-40"
            >
              {ar
                ? `قارن العروض المختارة (${selected.length})`
                : `Compare selected offers (${selected.length})`}
            </button>
          )}
        </section>
        <section className="container py-16 sm:py-20">
          <div className="mb-8">
            <p className="section-kicker">{t.guides}</p>
            <h2 className="mt-3 text-3xl font-extrabold leading-relaxed text-slate-950">
              {t.guideTitle}
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-slate-500">
              {t.guideBody}
            </p>
          </div>
          <GuideGrid />
        </section>
        {providers.length > 0 && <section className="border-y border-slate-200 bg-white">
          <div className="container py-12">
            <h2 className="mb-6 text-2xl font-extrabold">{ar ? "مزودو الخدمات المعروضة" : "Providers behind these services"}</h2>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{providers.map(provider => <ProviderCard key={provider.id} provider={provider}/>)}</div>
          </div>
        </section>}
        <section
          id="methodology"
          className="container scroll-mt-24 py-16 sm:py-20"
        >
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="section-kicker">PROVIDERBEACON SCORE</p>
              <h2 className="mt-4 text-3xl font-extrabold leading-relaxed text-slate-950">
                {t.evidence}
              </h2>
              <p className="mt-4 leading-8 text-slate-500">{t.evidenceBody}</p>
            </div>
            <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-7">
              <div>
                <h3 className="font-extrabold text-slate-900">{t.method}</h3>
                <p className="mt-3 text-sm leading-8 text-slate-600">
                  {t.methodBody}
                </p>
              </div>
              <div className="border-t border-slate-100 pt-5">
                <h3 className="font-extrabold text-slate-900">
                  {t.independence}
                </h3>
                <p className="mt-3 text-sm leading-8 text-slate-600">
                  {t.independenceBody}
                </p>
              </div>
            </div>
          </div>
        </section>
        <section id="about" className="container pb-16">
          <div className="rounded-3xl bg-[#0B2A48] p-8 text-white sm:p-12">
            <h2 className="text-3xl font-extrabold">{t.about}</h2>
            <p className="mt-5 max-w-3xl leading-8 text-slate-300">
              {t.aboutBody}
            </p>
            <Link
              href="/services?platform=Instagram&category=Followers"
              className="mt-7 inline-flex items-center gap-3 rounded-xl bg-[#53E1C0] px-6 py-3 font-extrabold text-[#081B30]"
            >
              {t.compare}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
