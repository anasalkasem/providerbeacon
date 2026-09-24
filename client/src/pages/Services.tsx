import { MobileDisclosure } from "@/components/MobileDisclosure";
import { mobileLayoutCopy } from "@/i18n/mobileLayout";
import { workspaceCopy } from "@/i18n/workspace";
import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { PublicLayout } from "@/components/SiteChrome";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { type Service } from "@/data/marketplace";
import { platforms, serviceTypes } from "../../../shared/serviceReview";
import { priceCurrencies, type PriceCurrency } from "../../../shared/pricing";
import { localizeData } from "@/i18n/messages";
import InlineServiceComparison from "@/components/InlineServiceComparison";
import { useServiceSelection } from "@/hooks/useServiceSelection";
import CataloguePromotions from "@/components/CataloguePromotions";
import SmmOfferTable from "@/components/SmmOfferTable";
import {
  providerSelection,
  providerSearchUrl,
} from "../../../shared/providerSelection";
import { homeDiscoveryCopy } from "@/i18n/homeDiscovery";
import { offerResultsCopy } from "@/i18n/offerResults";

export default function Services() {
  const search = useSearch();
  return <ServicesPage key={search} />;
}

function ServicesPage() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const wt = workspaceCopy[locale];
  const params = new URLSearchParams(useSearch());
  const providerIds = providerSelection(params.get("providers"));
  const scopeCopy = homeDiscoveryCopy[locale];
  const { services, setFilters, pagination, isLoading, source } =
    useMarketplaceData();
  const [market, setMarket] = useState<"smm" | "packages">(
    params.get("market") === "packages" ? "packages" : "smm"
  );
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [platform, setPlatform] = useState(
    platforms.includes(params.get("platform") as any)
      ? params.get("platform")!
      : "all"
  );
  const [category, setCategory] = useState(
    serviceTypes.includes(params.get("category") as any)
      ? params.get("category")!
      : "all"
  );
  const [currency, setCurrency] = useState<PriceCurrency | "">(
    params.get("market") === "packages" ? "" : "USD"
  );
  const [sort, setSort] = useState<"recommended" | "price">(
    params.get("market") === "packages" ? "recommended" : "price"
  );
  const [refillOnly, setRefillOnly] = useState(params.get("refill") === "1");
  const [countryCode, setCountryCode] = useState(
    /^[A-Z]{2}$/.test(params.get("countryCode") ?? "")
      ? params.get("countryCode")!
      : ""
  );
  const [refillDays, setRefillDays] = useState(
    Math.min(3650, Math.max(0, Number(params.get("refillDays") || 0))) || 0
  );
  const [limit, setLimit] = useState(25);
  const selection = useServiceSelection();
  const selected = selection.ids.map(id => ({ id }));
  const field =
    "h-12 w-full rounded-xl border border-border bg-card px-3 text-sm";
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters({
          q: query.trim(),
          limit,
          countryCode: countryCode.length === 2 ? countryCode : undefined,
          minRefillDays:
            market === "smm" && refillDays > 0 ? refillDays : undefined,
          market,
          platform: platform === "all" ? undefined : platform,
          category:
            category === "all"
              ? undefined
              : (category as (typeof serviceTypes)[number]),
          priceCurrency: currency || undefined,
          priceUnit: market === "packages" ? "package" : "per_1000",
          refillOnly: market === "smm" && refillOnly,
          sort: market === "smm" && currency ? sort : "recommended",
        }),
      250
    );
    return () => clearTimeout(timer);
  }, [
    query,
    market,
    platform,
    category,
    currency,
    refillOnly,
    sort,
    countryCode,
    refillDays,
    limit,
    setFilters,
  ]);
  const toggle = (service: Service) => selection.toggle(service.id);
  const activeFilters = [
    platform !== "all",
    category !== "all",
    !!currency,
    refillOnly,
    !!countryCode,
    refillDays > 0,
    sort !== "recommended",
  ].filter(Boolean).length;
  return (
    <PublicLayout>
      <section className="catalogue-page container py-8 sm:py-12">
        <p className="section-kicker">PROVIDERBEACON MARKETPLACE</p>
        <h1 className="mt-3 text-3xl font-extrabold text-foreground sm:text-4xl">
          {ar
            ? "عروض SMM. قارن قبل أن تختار."
            : "SMM offers. Compare before you choose."}
        </h1>
        <p className="mt-3 max-w-3xl leading-7 text-secondary-foreground">
          {ar
            ? "ابحث حسب المنصة ونوع الخدمة. قارن أسعار المزوّدين بوحدات بيعها، وراجع حدود الطلب وشروط التنفيذ."
            : "Search by platform and service type. Compare provider prices with their sale units, order limits and delivery terms."}
        </p>
        {providerIds.length > 0 && (
          <p className="mt-4 rounded-xl border border-border p-3 text-sm">
            {scopeCopy.scopeNotice}{" "}
            <Link
              className="ms-3 inline-flex min-h-11 items-center underline underline-offset-4"
              href={(() => {
                const next = new URLSearchParams(params);
                next.delete("providers");
                return "/services" + (next.size ? "?" + next.toString() : "");
              })()}
            >
              {scopeCopy.clearScope}
            </Link>
          </p>
        )}
        <Link
          href={providerSearchUrl("", providerIds)}
          className="mt-5 inline-flex rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white"
        >
          {wt.search} ✦
        </Link>
        <div
          className="my-6 flex flex-wrap gap-2"
          role="group"
          aria-label={ar ? "نوع السوق" : "Marketplace type"}
        >
          {(["smm", "packages"] as const).map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={market === value}
              onClick={() => {
                setMarket(value);
                setCategory("all");
                setCurrency(value === "smm" ? "USD" : "");
                setRefillOnly(false);
                setSort(value === "smm" ? "price" : "recommended");
              }}
              className={`rounded-xl border px-5 py-3 text-sm font-bold ${market === value ? "border-ink bg-ink text-white" : "border-border bg-card text-secondary-foreground"}`}
            >
              {value === "smm"
                ? ar
                  ? "خدمات SMM بالجملة"
                  : "Wholesale SMM"
                : ar
                  ? "باقات وكالات التسويق"
                  : "Agency packages"}
            </button>
          ))}
        </div>
        <label className="grid gap-2 text-sm font-bold catalogue-search">
          {ar ? "ابحث عن خدمة أو مزود" : "Find a service or provider"}
          <input
            className={field}
            value={query}
            maxLength={100}
            placeholder={
              ar ? "مثال: متابعين إنستغرام" : "e.g. Instagram followers"
            }
            onChange={e => setQuery(e.target.value)}
          />
        </label>
        <CataloguePromotions />
        <MobileDisclosure
          className="catalogue-filters"
          label={
            <>
              {mobileLayoutCopy[locale].filters}
              {activeFilters > 0 && (
                <span className="filter-count">{activeFilters}</span>
              )}
            </>
          }
        >
          <div className="mb-6 grid gap-3 rounded-2xl border border-border bg-muted p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-2 text-sm font-bold">
              {ar ? "المنصة" : "Platform"}
              <select
                className={field}
                value={platform}
                onChange={e => setPlatform(e.target.value)}
              >
                <option value="all">
                  {ar ? "جميع المنصات" : "All platforms"}
                </option>
                {platforms
                  .filter(p => p !== "Unknown")
                  .map(p => (
                    <option key={p}>{p}</option>
                  ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              {ar ? "نوع الخدمة" : "Service type"}
              <select
                className={field}
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option value="all">{ar ? "جميع الأنواع" : "All types"}</option>
                {serviceTypes
                  .filter(
                    c =>
                      c !== "Other" &&
                      (market === "packages" ||
                        [
                          "Followers",
                          "Views",
                          "Likes",
                          "Comments",
                          "Shares",
                          "Subscribers",
                        ].includes(c))
                  )
                  .map(c => (
                    <option key={c} value={c}>
                      {localizeData(locale, c)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              {ar ? "العملة" : "Currency"}
              <select
                className={field}
                value={currency}
                onChange={e => {
                  setCurrency(e.target.value as PriceCurrency | "");
                  if (!e.target.value) setSort("recommended");
                }}
              >
                <option value="">
                  {ar ? "جميع العملات" : "All currencies"}
                </option>
                {priceCurrencies.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              {ar ? "الترتيب" : "Sort"}
              <select
                className={field}
                value={sort}
                onChange={e => setSort(e.target.value as typeof sort)}
              >
                <option value="recommended">
                  {offerResultsCopy[locale].recommended}
                </option>
                <option
                  value="price"
                  disabled={!currency || market === "packages"}
                >
                  {ar ? "السعر: من الأقل للأعلى" : "Price: low to high"}
                </option>
              </select>
              {market === "smm" && !currency && (
                <span className="text-xs font-normal text-muted-foreground">
                  {ar
                    ? "اختر العملة لتفعيل ترتيب السعر."
                    : "Select a currency to enable price sorting."}
                </span>
              )}
            </label>
            {market === "smm" && (
              <>
                <label className="flex items-center gap-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={refillOnly}
                    onChange={e => setRefillOnly(e.target.checked)}
                    className="size-5 accent-ring"
                  />
                  {ar ? "عروض مع تعويض فقط" : "Refill available only"}
                </label>
              </>
            )}
          </div>
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-xs font-bold">
              {wt.country}
              <input
                dir="ltr"
                maxLength={2}
                placeholder="WW / PA"
                className="h-11 w-36 rounded-xl border border-border bg-card px-3"
                value={countryCode}
                onChange={e =>
                  setCountryCode(
                    e.target.value.toUpperCase().replace(/[^A-Z]/g, "")
                  )
                }
              />
            </label>
            {market === "smm" && (
              <label className="grid gap-2 text-xs font-bold">
                {wt.refillDays}
                <select
                  className="h-11 rounded-xl border border-border bg-card px-3"
                  value={refillDays}
                  onChange={e => setRefillDays(Number(e.target.value))}
                >
                  <option value={0}>{wt.any}</option>
                  {Array.from(
                    new Set([
                      7,
                      30,
                      60,
                      90,
                      365,
                      ...(refillDays > 0 ? [refillDays] : []),
                    ])
                  )
                    .sort((a, b) => a - b)
                    .map(n => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="grid gap-2 text-xs font-bold">
              {wt.rows}
              <select
                className="h-11 rounded-xl border border-border bg-card px-3"
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
              >
                {[25, 50, 100].map(n => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
        </MobileDisclosure>
        <InlineServiceComparison
          ids={selection.ids}
          remove={selection.toggle}
          clear={selection.clear}
        />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-bold text-secondary-foreground">
            {pagination.total.toLocaleString(locale)} {ar ? "عرض" : "offers"}
            <span className="ms-3 text-xs font-normal text-muted-foreground">
              {market === "smm" && sort === "price" && currency
                ? `${currency} · ${ar ? "لكل 1,000" : "per 1,000"} · ${ar ? "من الأقل إلى الأعلى" : "low to high"}`
                : offerResultsCopy[locale].recommended}
            </span>
          </p>
          <button
            type="button"
            className="text-sm font-bold text-foreground"
            onClick={() => {
              setQuery("");
              setCountryCode("");
              setRefillDays(0);
              setPlatform("all");
              setCategory("all");
              setCurrency("");
              setRefillOnly(false);
              setSort("recommended");
            }}
          >
            {ar ? "مسح الفلاتر" : "Clear filters"}
          </button>
        </div>
        <SmmOfferTable
          services={services}
          selected={selected}
          toggle={toggle}
          pageSize={limit}
          priceSorted={
            market === "smm" && Boolean(currency) && sort === "price"
          }
        />
        {isLoading && (
          <p className="p-8 text-center" role="status">
            {ar ? "جارٍ تحميل العروض…" : "Loading offers…"}
          </p>
        )}
        {!isLoading && services.length === 0 && source !== "unavailable" && (
          <p className="rounded-xl bg-muted p-8 text-center">
            {ar
              ? "لا توجد عروض منشورة تطابق هذه الفلاتر حاليًا."
              : "No published offers match these filters yet."}
          </p>
        )}
        <p className="mt-5 text-sm leading-7 text-muted-foreground">
          {ar
            ? "الأسعار وشروط التنفيذ معلنة من المزودين؛ فحص المصدر لا يعني اختبار جودة التنفيذ. ترتيب السعر لا يساوي ترتيب الجودة."
            : "Prices and delivery terms are provider claims. Checking a source does not test delivery quality. Price order is not a quality ranking."}
        </p>
        <Link
          href="/compare?manual=1"
          className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline"
        >
          {ar
            ? "مقارنة عروض أسعار مخصصة يدويًا"
            : "Compare custom quotes manually"}
        </Link>
        {selected.length > 0 && (
          <div
            data-compare-tray
            className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink p-4 text-white shadow-none"
          >
            <p>
              {ar
                ? `اخترت ${selected.length} من ٤ عروض`
                : `${selected.length} of 4 offers selected`}
            </p>
            <div className="flex gap-3">
              <button onClick={selection.clear} className="px-3 text-sm">
                {ar ? "إلغاء الاختيار" : "Clear selection"}
              </button>
              <button
                onClick={() => {
                  const heading = document.getElementById(
                    "inline-comparison-title"
                  );
                  heading?.focus({ preventScroll: true });
                  document
                    .getElementById("service-comparison")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="rounded-xl bg-secondary px-5 py-3 font-bold text-foreground disabled:opacity-40"
              >
                {ar ? "اعرض المقارنة أعلاه" : "View comparison above"}
              </button>
            </div>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
