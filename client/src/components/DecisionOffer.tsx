import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { workspaceCopy } from "@/i18n/workspace";
import { assistantCopy } from "@/i18n/assistant";
import { localizeData, localizeDuration } from "@/i18n/messages";
import { unitLabel } from "@/i18n/pricing";
import type { Provider, Service } from "@/data/marketplace";
import { comparisonFacts } from "../../../shared/offerComparison";
import OfferEvidence, { serviceName } from "./OfferEvidence";
import OfferPrice from "./OfferPrice";
import QuoteCost from "./QuoteCost";
import ConvertedQuote from "./ConvertedQuote";
import { FollowPrice } from "./WorkspaceActions";

export function DecisionOffer({
  service,
  provider,
  quantity,
  lowest = false,
  convertedTotal,
  fxAsOf,
  currency,
  budgetStatus,
}: {
  service: Service;
  provider: Provider;
  quantity: number | null;
  lowest?: boolean;
  convertedTotal?: string | null;
  fxAsOf?: number | null;
  currency?: string;
  budgetStatus?: "within" | "above" | "unknown" | null;
}) {
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  const a = assistantCopy[locale];
  return (
    <article
      data-service-id={service.id}
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${lowest ? "border-emerald-400 ring-1 ring-emerald-200" : "border-slate-200"}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <Link
          className="truncate font-extrabold text-teal-800"
          href={`/providers/${provider.slug}`}
        >
          {provider.name}
        </Link>
        <div className="text-end">
          <span className="text-xs font-semibold text-slate-500">
            {service.platform}
          </span>
          {provider.apiConnected && (
            <p className="mt-1 text-[10px] font-bold text-teal-700">
              {
                {
                  ar: "اتصال API فعلي",
                  en: "API connected",
                  es: "API conectada",
                  hi: "API जुड़ा है",
                  zh: "API 已连接",
                }[locale]
              }
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <h3
          dir="auto"
          className="line-clamp-3 min-h-12 break-words text-sm font-bold leading-6"
          title={serviceName(locale, service)}
        >
          {serviceName(locale, service)}
        </h3>
        <div className="rounded-xl bg-slate-50 p-4">
          <OfferPrice service={service} lowest={lowest} />
          <p className="mt-1 text-xs text-slate-500">
            {unitLabel(locale, service)}
          </p>
          {service.priceUnit === "package" ? null : quantity != null ? (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="mb-1 text-xs font-semibold text-slate-500">
                {t.quantity}: <bdi>{quantity.toLocaleString(locale)}</bdi>
              </p>
              <QuoteCost
                service={service}
                quantity={quantity}
                lowest={lowest}
              />
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">{a.quantityNeeded}</p>
          )}
          {convertedTotal && fxAsOf != null && currency && (
            <ConvertedQuote
              amount={convertedTotal}
              currency={currency}
              asOf={fxAsOf}
              lowest={lowest}
            />
          )}
          {currency && service.priceCurrency && service.priceCurrency !== currency && !convertedTotal && quantity != null && (
            <p className="mt-2 text-xs text-amber-800">{a.fxUnavailable}</p>
          )}
          {budgetStatus && (
            <p
              className={`mt-2 text-xs font-bold ${budgetStatus === "within" ? "text-emerald-800" : "text-amber-800"}`}
            >
              {budgetStatus === "within"
                ? a.within
                : budgetStatus === "above"
                  ? a.above
                  : a.budgetUnknown}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-slate-500">{t.fieldNames.refill}</dt>
            <dd className="mt-1 font-semibold">
              {localizeData(locale, service.refill)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.fieldNames.countryCode}</dt>
            <dd className="mt-1 font-semibold">
              {service.countryCode ?? t.unspecified}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.quantity}</dt>
            <dd className="mt-1 font-semibold">
              <bdi>
                {service.min.toLocaleString(locale)}–
                {service.max.toLocaleString(locale)}
              </bdi>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">
              {locale === "ar"
                ? "البدء المعلن"
                : locale === "es"
                  ? "Inicio declarado"
                  : locale === "zh"
                    ? "声明开始时间"
                    : locale === "hi"
                      ? "बताया गया आरंभ"
                      : "Stated start"}
            </dt>
            <dd className="mt-1 font-semibold">
              {localizeDuration(locale, service.startTime)}
            </dd>
          </div>
        </dl>
        <details className="rounded-xl border border-slate-100 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-600">
            {t.allDetails}
          </summary>
          <p dir="auto" className="mt-3 break-words leading-6">
            {serviceName(locale, service)}
          </p>
          <OfferEvidence service={service} showTerms />
        </details>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
          {service.priceUnit !== "package" && (
            <FollowPrice serviceId={service.id} quantity={quantity ?? 0} />
          )}
          <Link
            href={`/providers/${provider.slug}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-teal-800"
          >
            {a.provider}
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ComparisonExplanation({
  services,
  quantity,
  comparable,
}: {
  services: Service[];
  quantity: number;
  comparable: boolean;
}) {
  const { locale } = useLocale();
  const t = workspaceCopy[locale];
  const facts = comparisonFacts(services, quantity);
  return (
    <section className="mb-6 rounded-2xl border border-teal-200 bg-teal-50/60 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-extrabold text-slate-950">
        <CheckCircle2 className="size-5 shrink-0 text-teal-700" />
        {t.explain}
      </h2>
      {comparable && (
        <p className="mt-3 text-sm leading-7 text-teal-900">{t.equivalent}</p>
      )}
      {facts.differingFields.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-slate-600">{t.differences}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {facts.differingFields.map(field => (
              <span
                key={field}
                className="rounded-full border border-teal-200 bg-white px-3 py-1 text-xs font-bold text-teal-900"
              >
                {t.fieldNames[field]}
              </span>
            ))}
          </div>
        </div>
      )}
      {facts.pricingMissing && (
        <p className="mt-2 text-sm text-amber-900">{t.pricingMissing}</p>
      )}
      {facts.quantityInvalid && (
        <p className="mt-2 text-sm text-amber-900">{t.quantityInvalid}</p>
      )}
      {facts.termsMissing && (
        <p className="mt-2 text-sm text-slate-600">{t.termsMissing}</p>
      )}
      <p className="mt-3 text-xs leading-6 text-slate-500">{t.claims}</p>
    </section>
  );
}
