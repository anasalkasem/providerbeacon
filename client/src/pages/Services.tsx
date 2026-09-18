import { workspaceCopy } from "@/i18n/workspace";
import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { PublicLayout } from "@/components/SiteChrome";
import { CataloguePagination } from "@/components/CataloguePagination";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { type Service } from "@/data/marketplace";
import { platforms, serviceTypes } from "../../../shared/serviceReview";
import {
  priceCurrencies,
  priceUnits,
  type PriceCurrency,
  type PriceUnit,
} from "../../../shared/pricing";
import { localizeData } from "@/i18n/messages";
import { GuideGrid } from "@/components/Discovery";
import SmmOfferTable from "@/components/SmmOfferTable";

export default function Services() {
  const search = useSearch();
  return <ServicesPage key={search} />;
}

function ServicesPage() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const wt = workspaceCopy[locale];
  const params = new URLSearchParams(useSearch());
  const { services, setFilters, pagination, isLoading, source } =
    useMarketplaceData();
  const [, navigate] = useLocation();
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
  const [currency, setCurrency] = useState<PriceCurrency | "">("");
  const [unit, setUnit] = useState<PriceUnit | "">("");
  const [onlyMatching, setOnlyMatching] = useState(params.has("quantity"));
  const [sort, setSort] = useState<"recommended" | "price">("recommended");
  const [refillOnly, setRefillOnly] = useState(params.get("refill") === "1");
  const [quantity, setQuantity] = useState(
    Number(params.get("quantity") || 1000)
  );
  const [countryCode, setCountryCode] = useState(
    /^[A-Z]{2}$/.test(params.get("countryCode") ?? "")
      ? params.get("countryCode")!
      : ""
  );
  const [refillDays, setRefillDays] = useState(
    Math.min(3650, Math.max(0, Number(params.get("refillDays") || 0))) || 0
  );
  const [limit, setLimit] = useState(25);
  const validQuantity =
    Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 2147483647;
  const filterQuantity =
    market === "smm" && onlyMatching && validQuantity ? quantity : undefined;
  const [selected, setSelected] = useState<Service[]>([]);
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
          priceUnit: market === "packages" ? "package" : unit || undefined,
          quantity: filterQuantity,
          refillOnly: market === "smm" && refillOnly,
          sort:
            market === "smm" && currency && unit && unit !== "package"
              ? sort
              : "recommended",
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
    unit,
    filterQuantity,
    refillOnly,
    sort,
    countryCode,
    refillDays,
    limit,
    setFilters,
  ]);
  const toggle = (service: Service) =>
    setSelected(current =>
      current.some(item => item.id === service.id)
        ? current.filter(item => item.id !== service.id)
        : current.length < 4
          ? [...current, service]
          : current
    );
  return (
    <PublicLayout>
      <section className="container py-8 sm:py-12">
        <p className="section-kicker">PROVIDERBEACON MARKETPLACE</p>
        <h1 className="mt-3 text-3xl font-extrabold text-foreground sm:text-4xl">
          {ar
            ? "عروض SMM. قارن قبل أن تختار."
            : "SMM offers. Compare before you choose."}
        </h1>
        <p className="mt-3 max-w-3xl leading-7 text-secondary-foreground">
          {ar
            ? "ابحث حسب المنصة ونوع الخدمة وحدود الطلب. استعرض أسعار المزوّدين بوحدات بيعها، واحسب تكلفة الكمية للعروض التي تتوفر بيانات تسعيرها."
            : "Search by platform, service type and order limits. Browse provider prices with their sale units and calculate quantity totals where pricing data is available."}
        </p>
        <Link
          href="/find"
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
                setUnit("");
                setOnlyMatching(false);
                setRefillOnly(false);
                setSelected([]);
                setSort("recommended");
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
        {market === "smm" && (
          <section
            aria-label={ar ? "حاسبة تكلفة الخدمات" : "Service cost calculator"}
            className="mb-6 rounded-2xl border border-input bg-secondary/50 p-5"
          >
            <h2 className="text-lg font-extrabold text-foreground">
              {ar
                ? "كم ستكلفك الكمية التي تحتاجها؟"
                : "What will your quantity cost?"}
            </h2>
            <p className="mt-2 text-sm text-secondary-foreground">
              {ar
                ? "أدخل الكمية لتظهر تكلفة كل عرض مؤكد التسعير ضمن حدود الطلب."
                : "Enter a quantity to calculate each offer with confirmed pricing and valid order limits."}
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <label className="grid w-full gap-2 text-sm font-bold sm:w-56">
                {ar ? "الكمية المطلوبة" : "Required quantity"}
                <input
                  type="number"
                  min={1}
                  max={2147483647}
                  step={1}
                  className={field}
                  value={Number.isFinite(quantity) ? quantity : ""}
                  onChange={e => setQuantity(e.target.valueAsNumber)}
                  aria-invalid={!validQuantity}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {[1000, 5000, 10000].map(q => (
                  <button
                    key={q}
                    type="button"
                    aria-pressed={quantity === q}
                    onClick={() => setQuantity(q)}
                    className={`rounded-lg border px-4 py-3 text-sm font-bold ${quantity === q ? "border-ring bg-graphite text-white" : "border-input bg-card text-foreground"}`}
                  >
                    {q.toLocaleString(locale)}
                  </button>
                ))}
              </div>
            </div>
            {!validQuantity && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {ar
                  ? "أدخل عددًا صحيحًا من 1 إلى 2,147,483,647."
                  : "Enter a whole number from 1 to 2,147,483,647."}
              </p>
            )}
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={onlyMatching}
                onChange={e => setOnlyMatching(e.target.checked)}
                className="size-4 accent-ring"
              />
              {ar
                ? "اعرض فقط العروض التي تقبل هذه الكمية"
                : "Only show offers that accept this quantity"}
            </label>
          </section>
        )}
        <div className="mb-6 grid gap-3 rounded-2xl border border-border bg-muted p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-2 text-sm font-bold sm:col-span-2">
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
              <option value="">{ar ? "جميع العملات" : "All currencies"}</option>
              {priceCurrencies.map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {market === "smm" && (
            <label className="grid gap-2 text-sm font-bold">
              {ar ? "وحدة السعر" : "Sale unit"}
              <select
                className={field}
                value={unit}
                onChange={e => {
                  setUnit(e.target.value as PriceUnit | "");
                  if (!e.target.value || e.target.value === "package")
                    setSort("recommended");
                }}
              >
                <option value="">{ar ? "جميع الوحدات" : "All units"}</option>
                {priceUnits.map(u => (
                  <option key={u} value={u}>
                    {u === "per_1000"
                      ? ar
                        ? "لكل 1,000"
                        : "Per 1,000"
                      : u === "per_item"
                        ? ar
                          ? "للوحدة الواحدة"
                          : "Per item"
                        : ar
                          ? "للباقة"
                          : "Per package"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="grid gap-2 text-sm font-bold">
            {ar ? "الترتيب" : "Sort"}
            <select
              className={field}
              value={sort}
              onChange={e => setSort(e.target.value as typeof sort)}
            >
              <option value="recommended">
                {ar ? "ترتيب الدليل" : "Directory order"}
              </option>
              <option
                value="price"
                disabled={
                  !currency ||
                  !unit ||
                  unit === "package" ||
                  market === "packages"
                }
              >
                {ar ? "السعر: من الأقل للأعلى" : "Price: low to high"}
              </option>
            </select>
            {market === "smm" && (!currency || !unit) && (
              <span className="text-xs font-normal text-muted-foreground">
                {ar
                  ? "اختر العملة ووحدة السعر لتفعيل الترتيب."
                  : "Select a currency and sale unit to enable price sorting."}
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-bold text-secondary-foreground">
            {pagination.total.toLocaleString(locale)} {ar ? "عرض" : "offers"}
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
              setUnit("");
              setOnlyMatching(false);
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
          quantity={quantity}
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
        <CataloguePagination />
        <p className="mt-5 text-sm leading-7 text-muted-foreground">
          {ar
            ? "الأسعار وشروط التنفيذ معلنة من المزودين؛ فحص المصدر لا يعني اختبار جودة التنفيذ. ترتيب السعر لا يساوي ترتيب الجودة."
            : "Prices and delivery terms are provider claims. Checking a source does not test delivery quality. Price order is not a quality ranking."}
        </p>
        <details className="mt-8 rounded-xl border border-border p-4">
          <summary className="cursor-pointer font-bold">
            {ar ? "أدلة اختيار الخدمات" : "Service buying guides"}
          </summary>
          <div className="mt-4">
            <GuideGrid query={query} />
            <Link
              href="/compare?manual=1"
              className="mt-5 inline-block font-bold text-foreground"
            >
              {ar
                ? "مقارنة عروض أسعار مخصصة يدويًا"
                : "Compare custom quotes manually"}
            </Link>
          </div>
        </details>
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
              <button onClick={() => setSelected([])} className="px-3 text-sm">
                {ar ? "إلغاء الاختيار" : "Clear selection"}
              </button>
              <button
                disabled={selected.length < 2}
                onClick={() =>
                  navigate(
                    `/compare?services=${selected.map(s => s.id).join(",")}&quantity=${Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 1000}`
                  )
                }
                className="rounded-xl bg-secondary px-5 py-3 font-bold text-foreground disabled:opacity-40"
              >
                {ar ? "افتح المقارنة" : "Open comparison"}
              </button>
            </div>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
