import {
  and,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  not,
  or,
  sql,
} from "drizzle-orm";
import { providerRecords, serviceRecords } from "../drizzle/schema";
import {
  platforms,
  serviceTypes,
  STALE_DAYS,
  type catalogueViews,
  type ReviewNeed,
} from "../shared/serviceReview";
import { priceCurrencies, priceUnits } from "../shared/pricing";
import { NORMALIZATION_VERSION } from "./serviceNormalizer";

export const pricingBasis = sql`coalesce((${inArray(sql`binary ${serviceRecords.priceCurrency}`, priceCurrencies)} and ${inArray(serviceRecords.priceUnit, priceUnits)} and (${serviceRecords.priceUnit} <> 'package' or char_length(trim(${serviceRecords.packageDescription})) >= 8)), false)`;
const unconfirmedPricing = or(
  eq(serviceRecords.pricingConfirmed, false),
  not(pricingBasis)
)!;
export const lastEvidenceAt = sql`greatest(coalesce(${serviceRecords.priceCheckedAt}, '1970-01-01'), coalesce(${serviceRecords.sourceUpdatedAt}, '1970-01-01'))`;

// SQL counterparts of reviewBlockers/isStale. Acceptance fixtures check their
// agreement against actual review decisions, including legacy/case variants.
export function reviewNeedFilter(need?: ReviewNeed, now = Date.now()) {
  const classification = or(
    lt(serviceRecords.normalizationVersion, NORMALIZATION_VERSION),
    not(
      inArray(
        sql`binary ${serviceRecords.platform}`,
        platforms.filter(value => value !== "Unknown")
      )
    ),
    not(
      inArray(
        sql`binary ${serviceRecords.category}`,
        serviceTypes.filter(value => value !== "Other")
      )
    )
  )!;
  const invalidValues = or(
    lt(serviceRecords.priceAmount, "0.0001"),
    gt(serviceRecords.priceAmount, "100000"),
    lt(serviceRecords.minOrder, 1),
    lt(serviceRecords.maxOrder, serviceRecords.minOrder)
  )!;
  const noEvidence = or(
    isNull(serviceRecords.evidenceUrl),
    sql`char_length(${serviceRecords.evidenceUrl}) = 0`
  )!;
  const stale = lt(lastEvidenceAt, new Date(now - STALE_DAYS * 86400000));
  switch (need) {
    case "pricing_unconfirmed":
      return unconfirmedPricing;
    case "evidence_missing":
      return noEvidence;
    case "policy_check":
      return eq(serviceRecords.policyReviewed, false);
    case "classification":
      return classification;
    case "invalid_values":
      return invalidValues;
    case "source_missing":
      return eq(serviceRecords.available, false);
    case "stale":
      return stale;
    case "ready":
      return and(
        not(classification),
        not(invalidValues),
        not(noEvidence),
        not(stale),
        not(unconfirmedPricing),
        eq(serviceRecords.policyReviewed, true),
        eq(serviceRecords.available, true),
        ne(serviceRecords.reviewStatus, "approved")
      );
    default:
      return undefined;
  }
}
export function approvedService() {
  return and(
    ne(serviceRecords.screeningStatus, "held"),
    eq(serviceRecords.status, "active"),
    eq(serviceRecords.reviewStatus, "approved"),
    eq(serviceRecords.available, true),
    eq(serviceRecords.incomplete, false),
    not(unconfirmedPricing)
  );
}
export function catalogueViewFilter(view?: (typeof catalogueViews)[number]) {
  switch (view) {
    case "pending":
    case "approved":
    case "changes_requested":
      return eq(serviceRecords.reviewStatus, view);
    case "incomplete":
      return eq(serviceRecords.incomplete, true);
    case "stale":
      return lt(lastEvidenceAt, new Date(Date.now() - STALE_DAYS * 86400000));
    case "published":
      return and(approvedService(), eq(providerRecords.status, "active"));
    case "price_changed":
      return gte(
        serviceRecords.lastPriceChangeAt,
        new Date(Date.now() - 7 * 86400000)
      );
    case "missing":
      return eq(serviceRecords.available, false);
    default:
      return undefined;
  }
}

// Explicit human holds stay in place until released or deliberately requeued.
export function screeningQueued() {
  return and(
    or(eq(serviceRecords.screeningStatus, "pending"), ne(serviceRecords.screeningRevision, serviceRecords.revision)),
    not(and(eq(serviceRecords.screeningStatus, "held"), sql`coalesce(${serviceRecords.screeningModel}, '') = 'manual'`)!)
  );
}
