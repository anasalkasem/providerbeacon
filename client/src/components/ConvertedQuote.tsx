import { useLocale } from "@/contexts/LocaleContext";
import { assistantCopy } from "@/i18n/assistant";

export default function ConvertedQuote({
  amount,
  currency,
  asOf,
  lowest = false,
}: {
  amount: string;
  currency: string;
  asOf: number;
  lowest?: boolean;
}) {
  const { locale } = useLocale();
  const t = assistantCopy[locale];
  return (
    <div
      className={`mt-2 rounded-lg px-3 py-2 text-xs leading-5 ${lowest ? "bg-success-muted text-success" : "bg-secondary text-secondary-foreground"}`}
    >
      <p>{t.conversion}</p>
      <bdi dir="ltr" className="block break-all text-base font-extrabold">
        ≈ {currency} {amount}
      </bdi>
      <p className="mt-1">
        {t.asOf}:{" "}
        <time dateTime={new Date(asOf).toISOString()}>
          {new Date(asOf).toLocaleString(locale, {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </time>
      </p>
      <a
        href="https://www.exchangerate-api.com"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        {t.fxSource}
      </a>
    </div>
  );
}
