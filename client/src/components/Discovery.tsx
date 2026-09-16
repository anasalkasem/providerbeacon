import { useLocale } from "@/contexts/LocaleContext";
import { discoveryGuides, directoryProfiles, local } from "@/data/discovery";
import { discoveryText } from "@/i18n/discovery";
import { ArrowUpRight, ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "wouter";
export function GuideGrid({
  query = "",
  platform = "all",
  limit = 6,
}: {
  query?: string;
  platform?: string;
  limit?: number;
}) {
  const { locale } = useLocale();
  const t = discoveryText(locale);
  const needle = query.trim().toLocaleLowerCase();
  const guides = discoveryGuides
    .filter(
      g =>
        (platform === "all" || g.platform === platform) &&
        [g.title.en, g.title.ar, g.summary.en, g.summary.ar, g.platform, g.slug]
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle)
    )
    .slice(0, limit);
  return guides.length ? (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {guides.map(g => (
        <Link
          key={g.slug}
          href={`/services/${g.slug}`}
          className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-beacon-400 hover:shadow-lg hover:shadow-beacon-950/5"
        >
          <div className="flex items-center justify-between">
            <span
              className="grid size-12 place-items-center rounded-xl text-xs font-extrabold text-white"
              style={{ background: g.color }}
            >
              {g.mark}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {g.platform}
            </span>
          </div>
          <h3 className="mt-6 text-xl font-extrabold leading-relaxed text-slate-950">
            {local(g.title, locale)}
          </h3>
          <p className="mt-3 flex-1 text-sm leading-7 text-slate-500">
            {local(g.summary, locale)}
          </p>
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-bold text-beacon-700">
            <span>{t.readGuide}</span>
            <ArrowUpRight className="size-5 rtl:-rotate-90" />
          </div>
        </Link>
      ))}
    </div>
  ) : (
    <p
      role="status"
      className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500"
    >
      {t.noGuides}
    </p>
  );
}
export function ReferenceGrid({
  query = "",
  limit = 4,
}: {
  query?: string;
  limit?: number;
}) {
  const { locale } = useLocale();
  const t = discoveryText(locale);
  const profiles = directoryProfiles
    .filter(p =>
      [p.name, p.type.en, p.type.ar, p.summary.en, p.summary.ar]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase())
    )
    .slice(0, limit);
  return profiles.length ? (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {profiles.map(p => (
        <article
          key={p.slug}
          className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6"
        >
          <span
            className="grid size-12 place-items-center rounded-xl text-sm font-extrabold text-white"
            style={{ background: p.color }}
          >
            {p.mark}
          </span>
          <h3 className="mt-5 text-lg font-extrabold text-slate-950" dir="ltr">
            {p.name}
          </h3>
          <p className="mt-1 text-xs font-bold text-beacon-700">
            {local(p.type, locale)}
          </p>
          <p className="mt-4 flex-1 text-sm leading-7 text-slate-500">
            {local(p.summary, locale)}
          </p>
          <p className="mt-4 text-xs text-slate-500">{t.publicSource}</p>
          <Link
            href={`/directory/${p.slug}`}
            className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-bold text-ink"
          >
            {t.viewProfile}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
        </article>
      ))}
    </div>
  ) : (
    <p
      role="status"
      className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500"
    >
      {t.providerNone}
    </p>
  );
}
export function SourceLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm font-bold text-beacon-700 underline decoration-beacon-200 underline-offset-4"
    >
      {children}
      <ExternalLink className="size-4" />
    </a>
  );
}
