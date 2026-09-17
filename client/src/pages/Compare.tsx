import { comparisonGroup } from "../../../shared/offerComparison";
import {
  ComparisonExplanation,
  DecisionOffer,
} from "@/components/DecisionOffer";
import { SaveComparison } from "@/components/WorkspaceActions";
import { workspaceCopy } from "@/i18n/workspace";
import OfferEvidence, {
  serviceName,
  serviceScope,
  serviceTerms,
} from "@/components/OfferEvidence";
import QuoteWorkbench from "./QuoteWorkbench";
import QuoteCost from "@/components/QuoteCost";
import OfferPrice, { PriceLegend } from "@/components/OfferPrice";
import ConvertedQuote from "@/components/ConvertedQuote";
import { assistantCopy } from "@/i18n/assistant";
import { trpc } from "@/lib/trpc";
import Services from "./Services";
import { useState } from "react";
import {
  comparablePrices,
  hasPricingBasis,
  compareQuoteAmounts,
  quantityQuoteExact,
  priceCurrencies,
  type PriceCurrency,
} from "../../../shared/pricing";
import { pricingCopy } from "@/i18n/pricing";
import { CatalogueState } from "@/components/CatalogueState";
import { catalogueCopy, percentLabel } from "@/i18n/catalogue";
import { comparisonSelection } from "@/lib/catalogue";
import {
  ProviderAvatar,
  ScoreRing,
  VerifiedBadge,
} from "@/components/Marketplace";
import { PublicLayout } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { type Service } from "@/data/marketplace";
import {
  formatNumber,
  localizeData,
  localizeDuration,
  pageCopy,
} from "@/i18n/messages";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  DollarSign,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";

export default function Compare() {
  const { locale } = useLocale();
  const t = pageCopy[locale];
  const wt = workspaceCopy[locale];
  const ar = locale === "ar";
  const assistantText = assistantCopy[locale];
  const initialQuantity = Number(
    new URLSearchParams(window.location.search).get("quantity") ?? 1000
  );
  const [quantity, setQuantity] = useState(
    Number.isSafeInteger(initialQuantity) && initialQuantity > 0
      ? initialQuantity
      : 1000
  );
  const requestedCurrency = new URLSearchParams(window.location.search).get(
    "currency"
  );
  const [currency, setCurrency] = useState<PriceCurrency>(
    priceCurrencies.includes(requestedCurrency as PriceCurrency)
      ? (requestedCurrency as PriceCurrency)
      : "USD"
  );
  const requestedIds = (
    new URLSearchParams(window.location.search).get("services") ?? ""
  )
    .split(",")
    .filter(id => /^service-[1-9]\d{0,9}$/.test(id))
    .slice(0, 4);
  const convertedQuotes = trpc.assistant.quotes.useQuery(
    { serviceIds: requestedIds, quantity, currency },
    {
      enabled:
        requestedIds.length >= 2 &&
        Number.isSafeInteger(quantity) &&
        quantity > 0 &&
        quantity <= 2147483647,
      staleTime: 10000,
      retry: false,
    }
  );
  const { providerFor, serviceFor } = useMarketplaceData();
  const { selected: compared, missing } = comparisonSelection(
    new URLSearchParams(window.location.search).get("services"),
    serviceFor
  );
  if (!new URLSearchParams(window.location.search).get("services"))
    return new URLSearchParams(window.location.search).get("manual") === "1" ? (
      <QuoteWorkbench />
    ) : (
      <Services />
    );
  if (missing || compared.length < 2)
    return (
      <PublicLayout>
        <CatalogueState
          kind={missing ? "comparisonMissing" : "comparisonEmpty"}
        />
      </PublicLayout>
    );
  const nativeComparable =
    comparablePrices(compared) &&
    !!comparisonGroup(compared[0]!) &&
    compared.every(s => comparisonGroup(s) === comparisonGroup(compared[0]!)) &&
    compared.every(
      service =>
        service.priceType !== "from" &&
        quantityQuoteExact(service, quantity) != null
    );
  const comparable = convertedQuotes.data?.comparable ?? nativeComparable;
  const quotes = compared.map(service => quantityQuoteExact(service, quantity));
  const lowest = nativeComparable
    ? quotes.reduce<string | null>(
        (best, amount) =>
          best == null || compareQuoteAmounts(amount!, best) < 0
            ? amount
            : best,
        null
      )
    : null;
  const isLowest = (service: Service) =>
    convertedQuotes.data
      ? (convertedQuotes.data.offers.find(offer => offer.id === service.id)
          ?.lowest ?? false)
      : nativeComparable &&
        compareQuoteAmounts(quantityQuoteExact(service, quantity)!, lowest!) ===
          0;
  const bestScore = Math.max(
    ...compared.flatMap(service => {
      const score = providerFor(service).score;
      return score == null ? [] : [score];
    })
  );
  const rows: [
    string,
    React.ReactNode,
    (service: Service) => React.ReactNode,
  ][] = [
    [
      t.beaconScore,
      <ShieldCheck />,
      service => (
        <div className="flex items-center gap-3">
          <ScoreRing score={providerFor(service).score} />
          <div>
            <p className="font-bold text-foreground">
              {providerFor(service).score == null
                ? catalogueCopy[locale].insufficient
                : t.explainableScore}
            </p>
            <p className="text-xs text-muted-foreground">
              {providerFor(service).score == null
                ? catalogueCopy[locale].noScore
                : t.explainableScore}
            </p>
          </div>
        </div>
      ),
    ],
    [
      t.priceAmount,
      <DollarSign />,
      service => (
        <div>
          <OfferPrice service={service} />
          {service.packageDescription && (
            <p className="mt-2 text-sm text-secondary-foreground" dir="auto">
              {serviceScope(locale, service)}
            </p>
          )}
        </div>
      ),
    ],
    [
      t.startDelivery,
      <Clock3 />,
      service => (
        <div>
          <bdi dir="ltr" className="font-bold text-foreground">
            {localizeDuration(locale, service.startTime)}
          </bdi>
          <p className="text-xs text-muted-foreground">
            {t.delivery}:{" "}
            <bdi dir="ltr">{localizeDuration(locale, service.delivery)}</bdi>
          </p>
        </div>
      ),
    ],
    [
      t.refillProtection,
      <RefreshCw />,
      service => (
        <div>
          <p className="font-bold text-foreground">
            {localizeData(locale, service.refill)}
          </p>
          <p className="text-xs text-muted-foreground">{t.providerPolicy}</p>
        </div>
      ),
    ],
    [
      t.retention,
      <CheckCircle2 />,
      service => (
        <div>
          <bdi dir="ltr" className="font-bold text-foreground">
            {percentLabel(service.retention)}
          </bdi>
          <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-silver"
              style={{ width: `${service.retention ?? 0}%` }}
            />
          </div>
        </div>
      ),
    ],
    [
      t.orderRange,
      <Sparkles />,
      service => (
        <bdi dir="ltr" className="font-bold text-foreground">
          {formatNumber(locale, service.min)}–
          {formatNumber(locale, service.max)}
        </bdi>
      ),
    ],
  ];

  if (compared.some(service => service.billingCycle === "monthly")) {
    rows.splice(
      2,
      rows.length - 2,
      [
        locale === "ar" ? "شروط وتكاليف إضافية" : "Terms and extra costs",
        <CheckCircle2 />,
        service => (
          <p className="max-w-xs text-sm leading-6">
            {serviceTerms(locale, service) ?? "—"}
          </p>
        ),
      ],
      [
        locale === "ar" ? "المصدر وتاريخ الفحص" : "Source and checked date",
        <Clock3 />,
        service => <OfferEvidence service={service} />,
      ]
    );
  }
  if (!compared.some(service => service.billingCycle === "monthly")) {
    rows.splice(0, 1); // Published prices and order terms lead; scores without evidence remain in profiles.
    rows.splice(1, 0, [
      ar ? "تكلفة الكمية المحددة" : "Cost for selected quantity",
      <DollarSign />,
      service => {
        const converted = convertedQuotes.data?.offers.find(
          offer => offer.id === service.id
        );
        return (
          <>
            <QuoteCost
              service={service}
              quantity={quantity}
              lowest={isLowest(service)}
            />
            {converted?.convertedTotal && converted.fxAsOf != null && (
              <ConvertedQuote
                amount={converted.convertedTotal}
                currency={currency}
                asOf={converted.fxAsOf}
                lowest={isLowest(service)}
              />
            )}
            {service.priceCurrency !== currency &&
              converted?.total &&
              !converted.convertedTotal && (
                <p className="mt-2 text-xs text-warning">
                  {assistantText.fxUnavailable}
                </p>
              )}
          </>
        );
      },
    ]);
    rows.push(
      [
        ar ? "السوق المستهدف" : "Target market",
        <Sparkles />,
        service =>
          service.countryCode === "WW"
            ? ar
              ? "عالمي"
              : "Worldwide"
            : (service.countryCode ?? (ar ? "غير محدد" : "Unspecified")),
      ],
      [
        ar ? "المصدر وشروط العرض" : "Source and offer terms",
        <CheckCircle2 />,
        service => (
          <div>
            {service.sourceServiceId && (
              <p className="text-xs">
                ID <bdi>{service.sourceServiceId}</bdi>
              </p>
            )}
            <OfferEvidence service={service} showTerms />
          </div>
        ),
      ]
    );
  }
  return (
    <PublicLayout>
      <section className="border-b border-border bg-card">
        <div className="container py-10">
          <Button variant="ghost" asChild className="mb-5 -ms-3 text-muted-foreground">
            <Link href="/services">
              <ArrowLeft className="size-4 rtl:rotate-180" />
              {t.backServices}
            </Link>
          </Button>
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="eyebrow light">
                <Sparkles className="size-4" />
                {t.compareEyebrow}
              </div>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                {t.compareTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-secondary-foreground">{t.compareBody}</p>
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              <bdi>{formatNumber(locale, compared.length)}</bdi>{" "}
              {t.selectedServices}
            </p>
          </div>
        </div>
      </section>
      <section className="container py-10">
        {compared.every(service => service.priceUnit !== "package") && (
          <div className="mb-5 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
            <label className="grid gap-2 text-sm font-bold">
              {assistantText.currency}
              <select
                value={currency}
                onChange={event =>
                  setCurrency(event.target.value as PriceCurrency)
                }
                className="h-12 rounded-xl border border-border px-3"
                dir="ltr"
              >
                {priceCurrencies.map(code => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              {ar ? "كمية المقارنة" : "Comparison quantity"}
              <input
                type="number"
                min={1}
                max={2147483647}
                step={1}
                value={Number.isFinite(quantity) ? quantity : ""}
                onChange={event => setQuantity(event.target.valueAsNumber)}
                className="h-12 w-48 rounded-xl border border-border px-3"
              />
            </label>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              {assistantText.priceNote}
            </p>
          </div>
        )}
        {!comparable && (
          <p
            role="note"
            className="mb-5 rounded-xl border border-warning-border bg-warning-muted p-4 text-sm text-warning"
          >
            {pricingCopy[locale].mixed}
          </p>
        )}
        <ComparisonExplanation
          services={compared}
          quantity={quantity}
          comparable={comparable}
        />
        <div
          className={`mb-6 grid items-stretch gap-4 md:grid-cols-2 ${compared.length === 3 ? "xl:grid-cols-3" : compared.length > 3 ? "xl:grid-cols-4" : ""}`}
        >
          {compared.map(service => {
            const quote = convertedQuotes.data?.offers.find(
              o => o.id === service.id
            );
            return (
              <DecisionOffer
                key={service.id}
                service={service}
                provider={providerFor(service)}
                quantity={quantity}
                lowest={isLowest(service)}
                convertedTotal={quote?.convertedTotal}
                fxAsOf={quote?.fxAsOf}
                currency={currency}
              />
            );
          })}
        </div>
        <div className="mb-6">
          <SaveComparison
            serviceIds={compared.map(s => s.id)}
            quantity={quantity}
            currency={currency}
            name={compared.map(s => providerFor(s).name).join(" / ")}
          />
        </div>
        <details className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <summary className="mb-4 cursor-pointer font-extrabold text-foreground">
            {wt.details}
          </summary>
          <PriceLegend
            hasUnconfirmed={compared.some(service => !hasPricingBasis(service))}
          />
          <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-none">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr>
                  <th className="w-[220px] bg-muted p-6 text-start align-bottom">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t.comparison}
                    </p>
                    <p className="mt-2 text-lg font-extrabold text-foreground">
                      {t.serviceSignals}
                    </p>
                  </th>
                  {compared.map(service => {
                    const provider = providerFor(service);
                    return (
                      <th
                        key={service.id}
                        className="border-s border-border p-6 text-start align-top"
                      >
                        <div className="flex items-center gap-3">
                          <ProviderAvatar provider={provider} />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-extrabold text-foreground">
                                {provider.name}
                              </p>
                              {provider.verified && <VerifiedBadge compact />}
                            </div>
                            <p className="mt-1 text-xs font-medium text-muted-foreground">
                              {service.platform} ·{" "}
                              {localizeData(locale, service.category)}
                            </p>
                          </div>
                        </div>
                        <h2 className="mt-5 max-w-[250px] text-base font-bold text-foreground">
                          {serviceName(locale, service)}
                        </h2>
                        {provider.score === bestScore && (
                          <span className="mt-4 inline-flex rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground">
                            {t.bestOverallScore}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, icon, render]) => (
                  <tr key={label} className="border-t border-border">
                    <th className="bg-muted px-6 py-5 text-start">
                      <div className="flex items-center gap-2 text-sm font-bold text-secondary-foreground">
                        <span className="text-foreground [&_svg]:size-4">
                          {icon}
                        </span>
                        {label}
                      </div>
                    </th>
                    {compared.map(service => (
                      <td
                        key={service.id}
                        className="border-s border-border px-6 py-5"
                      >
                        {render(service)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <th className="bg-muted p-6 text-start text-sm text-muted-foreground">
                    {t.chooseConfidence}
                  </th>
                  {compared.map(service => {
                    const provider = providerFor(service);
                    return (
                      <td
                        key={service.id}
                        className="border-s border-border p-6"
                      >
                        <Button
                          asChild
                          className="w-full rounded-xl"
                        >
                          <Link href={`/providers/${provider.slug}`}>
                            {t.viewProvider}
                          </Link>
                        </Button>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </details>
      </section>
    </PublicLayout>
  );
}
