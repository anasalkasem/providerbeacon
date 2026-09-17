import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, Check, Copy } from "lucide-react";
import { PublicLayout } from "@/components/SiteChrome";
import { ReferenceGrid, SourceLink } from "@/components/Discovery";
import { useLocale } from "@/contexts/LocaleContext";
import { discoveryText } from "@/i18n/discovery";
import { discoveryGuides, directoryProfiles, local } from "@/data/discovery";
import NotFound from "./NotFound";
export function ServiceGuide() {
  const [, params] = useRoute("/services/:slug");
  const { locale } = useLocale();
  const t = discoveryText(locale);
  const guide = discoveryGuides.find(g => g.slug === params?.slug);
  const [copyState, setCopyState] = useState("");
  if (!guide) return <NotFound />;
  const checks = locale === "ar" ? guide.checks.ar : guide.checks.en;
  const brief = `${local(guide.title, locale)}\n\n${local(guide.brief, locale)}\n\n${checks.map(c => `- ${c}`).join("\n")}`;
  return (
    <PublicLayout>
      <div className="container py-12" lang={locale === "ar" ? "ar" : "en"}>
        <Link
          href="/services"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t.back}
        </Link>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_.7fr]">
          <div>
            <p className="section-kicker">
              {guide.platform} · {t.guideLabel}
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-relaxed text-foreground sm:text-5xl">
              {local(guide.title, locale)}
            </h1>
            <p className="mt-5 text-lg leading-8 text-secondary-foreground">
              {local(guide.summary, locale)}
            </p>
            <section className="mt-8 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-extrabold">{t.checklist}</h2>
              <ol className="mt-6 space-y-5">
                {checks.map((c, i) => (
                  <li key={c} className="flex items-start gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold text-foreground">
                      {i + 1}
                    </span>
                    <span className="leading-7 text-secondary-foreground">{c}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <aside className="space-y-5">
            <div className="rounded-2xl bg-ink p-6 text-white">
              <h2 className="font-extrabold">{t.scope}</h2>
              <p className="mt-3 text-lg leading-8 text-foreground">
                {local(guide.unit, locale)}
              </p>
              <Link
                href="/compare"
                className="mt-6 flex items-center justify-between rounded-xl bg-secondary p-4 text-sm font-extrabold text-foreground"
              >
                {t.compare}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            </div>
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-extrabold">{t.brief}</h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-secondary-foreground">
                {brief}
              </p>
              <button
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(brief);
                    setCopyState(t.copied);
                  } catch {
                    setCopyState(t.copyFailed);
                  }
                }}
              >
                <Copy className="size-4" />
                {t.copyBrief}
              </button>
              <p role="status" className="mt-2 text-xs text-foreground">
                {copyState}
              </p>
            </section>
          </aside>
        </div>
        <section className="mt-14">
          <h2 className="text-2xl font-extrabold">{t.related}</h2>
          <p className="mb-7 mt-3 text-sm leading-7 text-muted-foreground">
            {t.relatedBody}
          </p>
          <ReferenceGrid limit={3} />
        </section>
      </div>
    </PublicLayout>
  );
}
export function DirectoryProfile() {
  const [, params] = useRoute("/directory/:slug");
  const { locale } = useLocale();
  const t = discoveryText(locale);
  const profile = directoryProfiles.find(p => p.slug === params?.slug);
  if (!profile) return <NotFound />;
  return (
    <PublicLayout>
      <div
        className="container max-w-5xl py-12"
        lang={locale === "ar" ? "ar" : "en"}
      >
        <Link
          href="/providers"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t.allProfiles}
        </Link>
        <div className="mt-8 rounded-3xl border border-border bg-card p-7 sm:p-10">
          <div className="flex items-start gap-5">
            <span
              className="grid size-16 shrink-0 place-items-center rounded-2xl text-lg font-extrabold text-white"
              style={{ background: profile.color }}
            >
              {profile.mark}
            </span>
            <div>
              <p className="section-kicker">{local(profile.type, locale)}</p>
              <h1
                className="mt-3 text-3xl font-extrabold text-foreground sm:text-5xl"
                dir="ltr"
              >
                {profile.name}
              </h1>
            </div>
          </div>
          <p className="mt-7 text-lg leading-8 text-secondary-foreground">
            {local(profile.summary, locale)}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {profile.tags.map(tag => (
              <Link
                key={tag}
                href={`/services?q=${tag}`}
                className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground"
              >
                {tag}
              </Link>
            ))}
          </div>
          <div className="mt-7 border-t border-border pt-5">
            <SourceLink href={profile.source}>{t.official}</SourceLink>
            <p className="mt-3 text-xs text-muted-foreground">{t.checked}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-extrabold">{t.ask}</h2>
            <p className="mt-4 text-sm leading-8 text-secondary-foreground">
              {local(profile.question, locale)}
            </p>
            <h3 className="mt-6 font-bold">{t.pricing}</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {t.pricingBody}
            </p>
          </section>
          <section className="rounded-2xl border border-warning-border bg-warning-muted/50 p-6">
            <p className="text-xs font-bold text-warning">{t.publicSource}</p>
            <h2 className="mt-3 text-lg font-extrabold">{t.unverified}</h2>
            <p className="mt-5 font-bold text-secondary-foreground">{t.noScore}</p>
            <p className="mt-2 text-sm leading-7 text-secondary-foreground">
              {t.noScoreBody}
            </p>
            <Link
              href="/#methodology"
              className="mt-4 inline-block text-sm font-bold text-foreground underline"
            >
              {t.methodLink}
            </Link>
          </section>
        </div>
        <Link
          href="/compare"
          className="mt-8 inline-flex items-center gap-3 rounded-xl bg-ink px-6 py-4 font-bold text-white"
        >
          {t.compare}
          <ArrowRight className="size-4 rtl:rotate-180" />
        </Link>
      </div>
    </PublicLayout>
  );
}
