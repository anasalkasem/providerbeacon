/** One provider plan, priced in integer US cents. Checkout and manual activation share this price schedule. */
export const PROVIDER_PLAN = Object.freeze({
  key: "provider-monthly-v1",
  currency: "USD",
  introMonths: 3,
  introMonthlyCents: 1900,
  monthlyCents: 2900,
} as const);

/** Calendar anniversaries use the original day and clamp at month end, in UTC. */
export function providerMonthAnniversary(start: Date, months: number) {
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isInteger(months) ||
    months < 0
  )
    throw new RangeError("Invalid subscription anniversary");
  const result = new Date(start);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const monthEnd = new Date(result);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCDate(0);
  result.setUTCDate(Math.min(day, monthEnd.getUTCDate()));
  return result;
}

export function providerPlanPricing(
  firstActivatedAt: Date | null,
  now = Date.now()
) {
  const introEndsAt = firstActivatedAt
    ? providerMonthAnniversary(firstActivatedAt, PROVIDER_PLAN.introMonths)
    : null;
  const phase = !firstActivatedAt
    ? "not_started"
    : now < firstActivatedAt.getTime()
      ? "scheduled"
      : now < introEndsAt!.getTime()
        ? "intro"
        : "standard";
  return {
    ...PROVIDER_PLAN,
    firstActivatedAt,
    introEndsAt,
    phase,
    currentMonthlyCents:
      phase === "standard"
        ? PROVIDER_PLAN.monthlyCents
        : PROVIDER_PLAN.introMonthlyCents,
  };
}
