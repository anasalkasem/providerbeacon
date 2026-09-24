import { useState } from "react";
import { ArrowRight, Calculator, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/SiteChrome";
import { useLocale } from "@/contexts/LocaleContext";
import { discoveryText } from "@/i18n/discovery";
import { priceCurrencies } from "../../../shared/pricing";
import { quoteTotal } from "../../../shared/quoteCalculator";
export default function QuoteWorkbench() {
  const { locale } = useLocale();
  const t = discoveryText(locale);
  const [currency, setCurrency] = useState("USD");
  const [quantity, setQuantity] = useState("1000");
  const [quotes, setQuotes] = useState([
    { name: "", amount: "" },
    { name: "", amount: "" },
    { name: "", amount: "" },
  ]);
  const [matched, setMatched] = useState(false);
  const totals = quotes.map(q =>
    quoteTotal(q.amount, Number(quantity), "per_1000")
  );
  const valid = totals.filter((n): n is number => n !== null);
  const lowest = matched && valid.length >= 2 ? Math.min(...valid) : null;
  const change = (i: number, patch: Partial<(typeof quotes)[number]>) =>
    setQuotes(current =>
      current.map((q, j) => (i === j ? { ...q, ...patch } : q))
    );
  const field =
    "mt-2 h-12 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-input";
  return (
    <PublicLayout>
      <div className="container py-12" lang={locale === "ar" ? "ar" : "en"}>
        <p className="section-kicker">BEACON COMPARE</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-relaxed text-foreground sm:text-5xl">
          {t.quoteTitle}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-secondary-foreground">
          {t.quoteBody}
        </p>
        <div className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
          <label className="text-sm font-bold">
            {t.currency}
            <select
              className={field}
              value={currency}
              onChange={e => setCurrency(e.target.value)}
            >
              {priceCurrencies.map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            {t.quantity}
            <input
              className={field}
              type="number"
              dir="ltr"
              min="1"
              max="1000000"
              step="1"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {quotes.map((q, i) => (
            <section
              key={i}
              aria-label={`${t.quote} ${i + 1}`}
              className={`rounded-2xl border bg-card p-6 ${lowest !== null && totals[i] === lowest ? "border-input ring-1 ring-input" : "border-border"}`}
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-extrabold">
                  {t.quote} {i + 1}
                </h2>
                <Calculator className="size-5 text-foreground" />
              </div>
              <label className="block text-sm font-semibold text-secondary-foreground">
                {t.quoteName}
                <input
                  className={field}
                  maxLength={80}
                  value={q.name}
                  onChange={e => change(i, { name: e.target.value })}
                />
              </label>
              <label className="mt-5 block text-sm font-semibold text-secondary-foreground">
                {t.amount}
                <input
                  className={field}
                  dir="ltr"
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.0001"
                  value={q.amount}
                  onChange={e => change(i, { amount: e.target.value })}
                />
              </label>
              <div className="mt-7 rounded-xl bg-muted p-5">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t.total}
                </p>
                <output
                  aria-live="polite"
                  className="mt-3 block break-words text-2xl font-extrabold text-foreground"
                  dir="ltr"
                >
                  {totals[i] === null
                    ? "—"
                    : `${currency} ${totals[i]!.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 7 })}`}
                </output>
                <p className="mt-2 min-h-5 text-xs font-bold text-foreground">
                  {lowest !== null && totals[i] === lowest ? t.lowest : ""}
                </p>
              </div>
            </section>
          ))}
        </div>
        <label className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-sm font-bold leading-7">
          <input
            type="checkbox"
            className="mt-1.5 size-4 shrink-0 accent-ring"
            checked={matched}
            onChange={e => setMatched(e.target.checked)}
          />
          {t.scopeAgreement}
        </label>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-muted-foreground">
          {t.compareHint}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{t.privateInputs}</p>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <button
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-bold"
            onClick={() => {
              setQuotes([
                { name: "", amount: "" },
                { name: "", amount: "" },
                { name: "", amount: "" },
              ]);
              setMatched(false);
              setQuantity("1000");
            }}
          >
            <RotateCcw className="size-4" />
            {t.reset}
          </button>
          <Link href="/services" className="text-sm font-bold text-foreground">
            {t.explore}
            <ArrowRight className="ms-2 inline size-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
