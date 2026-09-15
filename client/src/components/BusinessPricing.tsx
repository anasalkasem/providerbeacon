import { useLocale } from "@/contexts/LocaleContext";
import { providerPricingText } from "@/i18n/providerPricing";
import {
  PROVIDER_PLAN,
  providerPlanPricing,
} from "../../../shared/providerBusinessPricing";
import { useBusinessClock } from "./BusinessUi";

const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);

export function BusinessPricing({
  firstActivatedAt,
}: {
  firstActivatedAt?: Date | null;
}) {
  const { locale } = useLocale();
  const t = providerPricingText(locale);
  const now = useBusinessClock();
  const candidate = firstActivatedAt ? new Date(firstActivatedAt) : null;
  const anchor =
    candidate && Number.isFinite(candidate.getTime()) ? candidate : null;
  const pricing = providerPlanPricing(anchor, now);
  const standard = pricing.phase === "standard";
  const date = (value: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(value);
  return (
    <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50/60 p-5">
      <p className="text-sm font-bold text-teal-800">
        {standard ? t.current : t.launch}
      </p>
      <p className="mt-3 flex flex-wrap items-baseline gap-2 text-[#0B2A68]">
        <bdi dir="ltr" className="text-4xl font-extrabold">
          {usd(pricing.currentMonthlyCents)}
        </bdi>
        <span className="text-sm font-semibold">USD {t.monthly}</span>
      </p>
      {!standard && (
        <>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            {t.intro.replace("{months}", String(PROVIDER_PLAN.introMonths))}
          </p>
          <p className="mt-3 border-t border-teal-200 pt-3 text-sm font-bold text-[#0B2A68]">
            {t.then.replace("{month}", String(PROVIDER_PLAN.introMonths + 1))}:{" "}
            <bdi dir="ltr">{usd(PROVIDER_PLAN.monthlyCents)} USD</bdi>{" "}
            {t.monthly}
          </p>
        </>
      )}
      <p className="mt-4 text-sm leading-7 text-slate-600">
        {t.terms.replace("{months}", String(PROVIDER_PLAN.introMonths))}
      </p>
      {anchor && pricing.introEndsAt ? (
        <dl className="mt-4 grid gap-3 border-t border-teal-200 pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">{t.first}</dt>
            <dd className="mt-1 font-semibold text-slate-800">
              <bdi>{date(anchor)} UTC</bdi>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">
              {t.regularFrom}{" "}
              <bdi dir="ltr">{usd(PROVIDER_PLAN.monthlyCents)} USD</bdi>
            </dt>
            <dd className="mt-1 font-semibold text-slate-800">
              <bdi>{date(pricing.introEndsAt)} UTC</bdi>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm leading-7 text-slate-600">{t.awaiting}</p>
      )}
      <p className="mt-3 text-xs leading-6 text-slate-500">
        {t.currency} {t.manual}
      </p>
    </div>
  );
}
