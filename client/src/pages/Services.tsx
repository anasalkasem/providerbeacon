import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { PublicLayout } from "@/components/SiteChrome";
import { CataloguePagination } from "@/components/CataloguePagination";
import { useLocale } from "@/contexts/LocaleContext";
import { useMarketplaceData } from "@/contexts/MarketplaceDataContext";
import { type Service } from "@/data/marketplace";
import { platforms, serviceTypes } from "../../../shared/serviceReview";
import { priceCurrencies, type PriceCurrency } from "../../../shared/pricing";
import { localizeData } from "@/i18n/messages";
import { GuideGrid } from "@/components/Discovery";
import SmmOfferTable from "@/components/SmmOfferTable";

export default function Services() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const params = new URLSearchParams(window.location.search);
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
  const [currency, setCurrency] = useState<PriceCurrency | "">("USD");
  const [sort, setSort] = useState<"recommended" | "price">("recommended");
  const [refillOnly, setRefillOnly] = useState(false);
  const [quantity, setQuantity] = useState(1000);
  const [selected, setSelected] = useState<Service[]>([]);
  const field =
    "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm";
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters({
          q: query.trim(),
          market,
          platform: platform === "all" ? undefined : platform,
          category:
            category === "all"
              ? undefined
              : (category as (typeof serviceTypes)[number]),
          priceCurrency: currency || undefined,
          priceUnit: market === "smm" ? "per_1000" : "package",
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
        <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl">
          {ar
            ? "عروض SMM. قارن قبل أن تختار."
            : "SMM offers. Compare before you choose."}
        </h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-600">
          {ar
            ? "متابعون، مشاهدات وإعجابات من مزودين مختلفين. قارن سعر الألف والكمية والتعويض مع رابط المصدر لكل عرض."
            : "Followers, views and likes from different providers. Compare unit prices, quantities and refill terms, with a source for every offer."}
        </p>
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
                setRefillOnly(false);
                setSelected([]);
                setSort("recommended");
              }}
              className={`rounded-xl border px-5 py-3 text-sm font-bold ${market === value ? "border-[#0B2A48] bg-[#0B2A48] text-white" : "border-slate-200 bg-white text-slate-600"}`}
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
        <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
              onChange={e => setCurrency(e.target.value as PriceCurrency | "")}
            >
              <option value="">{ar ? "جميع العملات" : "All currencies"}</option>
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
                {ar ? "ترتيب الدليل" : "Directory order"}
              </option>
              <option
                value="price"
                disabled={!currency || market === "packages"}
              >
                {ar ? "سعر الألف: من الأقل" : "Price per 1,000: low to high"}
              </option>
            </select>
          </label>
          {market === "smm" && (
            <>
              <label className="grid gap-2 text-sm font-bold">
                {ar ? "كمية المقارنة" : "Comparison quantity"}
                <input
                  type="number"
                  min={1}
                  max={2147483647}
                  step={1}
                  className={field}
                  value={Number.isFinite(quantity) ? quantity : ""}
                  onChange={e => setQuantity(e.target.valueAsNumber)}
                />
              </label>
              <label className="flex items-center gap-3 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={refillOnly}
                  onChange={e => setRefillOnly(e.target.checked)}
                  className="size-5 accent-teal-700"
                />
                {ar ? "عروض مع تعويض فقط" : "Refill available only"}
              </label>
            </>
          )}
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-bold text-slate-700">
            {pagination.total.toLocaleString(locale)} {ar ? "عرض" : "offers"}
          </p>
          <button
            type="button"
            className="text-sm font-bold text-teal-700"
            onClick={() => {
              setQuery("");
              setPlatform("all");
              setCategory("all");
              setCurrency("USD");
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
          <p className="rounded-xl bg-slate-50 p-8 text-center">
            {ar
              ? "لا توجد عروض منشورة تطابق هذه الفلاتر حاليًا."
              : "No published offers match these filters yet."}
          </p>
        )}
        <CataloguePagination />
        <p className="mt-5 text-sm leading-7 text-slate-500">
          {ar
            ? "الأسعار وشروط التنفيذ معلنة من المزودين؛ فحص المصدر لا يعني اختبار جودة التنفيذ. ترتيب السعر لا يساوي ترتيب الجودة."
            : "Prices and delivery terms are provider claims. Checking a source does not test delivery quality. Price order is not a quality ranking."}
        </p>
        <details className="mt-8 rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer font-bold">
            {ar ? "أدلة اختيار الخدمات" : "Service buying guides"}
          </summary>
          <div className="mt-4">
            <GuideGrid query={query} />
            <Link
              href="/compare?manual=1"
              className="mt-5 inline-block font-bold text-teal-700"
            >
              {ar
                ? "مقارنة عروض أسعار مخصصة يدويًا"
                : "Compare custom quotes manually"}
            </Link>
          </div>
        </details>
        {selected.length > 0 && (
          <div className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B2A48] p-4 text-white shadow-xl">
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
                className="rounded-xl bg-teal-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-40"
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
