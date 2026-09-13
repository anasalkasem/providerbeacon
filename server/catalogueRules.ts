import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { providerRecords, serviceRecords } from "../drizzle/schema";
import { STALE_DAYS, type catalogueViews } from "../shared/serviceReview";

export const lastEvidenceAt = sql`greatest(coalesce(${serviceRecords.priceCheckedAt}, '1970-01-01'), coalesce(${serviceRecords.sourceUpdatedAt}, '1970-01-01'))`;
export function approvedService() {
  return and(
    eq(serviceRecords.status, "active"),
    eq(serviceRecords.reviewStatus, "approved"),
    eq(serviceRecords.available, true),
    eq(serviceRecords.incomplete, false)
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
