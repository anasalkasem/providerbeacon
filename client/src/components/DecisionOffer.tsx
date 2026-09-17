import { hasPricingBasis, quantityQuoteExact } from "../../../shared/pricing";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { workspaceCopy } from "@/i18n/workspace";
import { assistantCopy } from "@/i18n/assistant";
import { localizeData, localizeDuration } from "@/i18n/messages";
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
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-none ${lowest ? "border-success-border ring-1 ring-success-border" : "border-border"}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
        <Link
          className="truncate font-extrabold text-foreground"
          href={`/providers/${provider.slug}`}
        >
          {provider.name}
        </Link>
        <div className="text-end">
          <span className="text-xs font-semibold text-muted-foreground">
            {service.platform}
          </span>
          {provider.apiConnected && (
            <p className="mt-1 text-[10px] font-bold text-foreground">
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
        <div className="rounded-xl bg-muted p-4">
          <OfferPrice service={service} lowest={lowest} />
          {service.priceUnit === "package" ||
          !hasPricingBasis(service) ? null : quantity != null ? (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">
                {t.quantity}: <bdi>{quantity.toLocaleString(locale)}</bdi>
              </p>
              <QuoteCost
                service={service}
                quantity={quantity}
                lowest={lowest}
              />
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">{a.quantityNeeded}</p>
          )}
          {convertedTotal && fxAsOf != null && currency && (
            <ConvertedQuote
              amount={convertedTotal}
              currency={currency}
              asOf={fxAsOf}
              lowest={lowest}
            />
          )}
          {currency &&
            service.priceCurrency &&
            service.priceCurrency !== currency &&
            !convertedTotal &&
            quantity != null &&
            quantityQuoteExact(service, quantity) != null && (
              <p className="mt-2 text-xs text-warning">{a.fxUnavailable}</p>
            )}
          {budgetStatus && (
            <p
              className={`mt-2 text-xs font-bold ${budgetStatus === "within" ? "text-success" : "text-warning"}`}
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
            <dt className="text-muted-foreground">{t.fieldNames.refill}</dt>
            <dd className="mt-1 font-semibold">
              {localizeData(locale, service.refill)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.fieldNames.countryCode}</dt>
            <dd className="mt-1 font-semibold">
              {service.countryCode ?? t.unspecified}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.quantity}</dt>
            <dd className="mt-1 font-semibold">
              <bdi>
                {service.min.toLocaleString(locale)}–
                {service.max.toLocaleString(locale)}
              </bdi>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
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
        <details className="rounded-xl border border-border p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-secondary-foreground">
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
            className="inline-flex items-center gap-1 text-xs font-bold text-foreground"
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
    <section className="mb-6 rounded-2xl border border-input bg-secondary/60 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-extrabold text-foreground">
        <CheckCircle2 className="size-5 shrink-0 text-foreground" />
        {t.explain}
      </h2>
      {comparable && (
        <p className="mt-3 text-sm leading-7 text-foreground">{t.equivalent}</p>
      )}
      {facts.differingFields.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-secondary-foreground">{t.differences}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {facts.differingFields.map(field => (
              <span
                key={field}
                className="rounded-full border border-input bg-card px-3 py-1 text-xs font-bold text-foreground"
              >
                {t.fieldNames[field]}
              </span>
            ))}
          </div>
        </div>
      )}
      {facts.pricingMissing && (
        <p className="mt-2 text-sm text-warning">{t.pricingMissing}</p>
      )}
      {facts.quantityInvalid && (
        <p className="mt-2 text-sm text-warning">{t.quantityInvalid}</p>
      )}
      {facts.termsMissing && (
        <p className="mt-2 text-sm text-secondary-foreground">{t.termsMissing}</p>
      )}
      <p className="mt-3 text-xs leading-6 text-muted-foreground">{t.claims}</p>
    </section>
  );
}
