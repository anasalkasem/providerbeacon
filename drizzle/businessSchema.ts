import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { providerRecords } from "./schema";
import { memberAccounts } from "./memberSchema";
import {
  claimStatuses,
  planStatuses,
  promotionStatuses,
} from "../shared/providerBusiness";

export const providerBusinessAccounts = mysqlTable(
  "provider_business_accounts",
  {
    providerId: int("provider_id")
      .primaryKey()
      .references(() => providerRecords.id, { onDelete: "cascade" }),
    ownerMemberId: int("owner_member_id").references(() => memberAccounts.id, {
      onDelete: "set null",
    }),
    ownerHost: varchar("owner_host", { length: 255 }),
    ownershipVerifiedAt: timestamp("ownership_verified_at", { fsp: 3 }),
    status: mysqlEnum("status", planStatuses).default("inactive").notNull(),
    startsAt: timestamp("starts_at", { fsp: 3 }),
    endsAt: timestamp("ends_at", { fsp: 3 }),
    firstActivatedAt: timestamp("first_activated_at", { fsp: 3 }),
    revision: int("revision").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    index("business_owner_idx").on(t.ownerMemberId, t.providerId),
    index("business_plan_expiry_idx").on(t.status, t.endsAt),
  ]
);

export const providerOwnershipClaims = mysqlTable(
  "provider_ownership_claims",
  {
    id: int("id").autoincrement().primaryKey(),
    providerId: int("provider_id")
      .notNull()
      .references(() => providerRecords.id, { onDelete: "cascade" }),
    memberId: int("member_id")
      .notNull()
      .references(() => memberAccounts.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 80 }).notNull(),
    proofUrl: varchar("proof_url", { length: 500 }),
    websiteHost: varchar("website_host", { length: 255 }).notNull(),
    status: mysqlEnum("status", claimStatuses).default("draft").notNull(),
    revision: int("revision").default(1).notNull(),
    reviewNote: varchar("review_note", { length: 600 }),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    reviewedAt: timestamp("reviewed_at", { fsp: 3 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    uniqueIndex("business_claim_identity_unique").on(t.providerId, t.memberId),
    index("business_claim_queue_idx").on(t.status, t.id),
    index("business_claim_member_idx").on(t.memberId, t.id),
  ]
);

export const providerPromotions = mysqlTable(
  "provider_promotions",
  {
    id: int("id").autoincrement().primaryKey(),
    providerId: int("provider_id")
      .notNull()
      .references(() => providerRecords.id, { onDelete: "cascade" }),
    createdByMemberId: int("created_by_member_id").references(
      () => memberAccounts.id,
      { onDelete: "set null" }
    ),
    title: varchar("title", { length: 120 }).notNull(),
    description: varchar("description", { length: 1200 }).notNull(),
    couponCode: varchar("coupon_code", { length: 64 }),
    destinationUrl: varchar("destination_url", { length: 500 }).notNull(),
    coverId: varchar("cover_id", { length: 64 }),
    category: varchar("category", { length: 32 }).default("all").notNull(),
    placement: mysqlEnum("placement", ["subscription", "platform"])
      .default("subscription")
      .notNull(),
    showInExplorer: boolean("show_in_explorer").default(false).notNull(),
    startsAt: timestamp("starts_at", { fsp: 3 }).notNull(),
    endsAt: timestamp("ends_at", { fsp: 3 }).notNull(),
    status: mysqlEnum("status", promotionStatuses).default("pending").notNull(),
    revision: int("revision").default(1).notNull(),
    reviewNote: varchar("review_note", { length: 600 }),
    reviewedAt: timestamp("reviewed_at", { fsp: 3 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    index("promotion_provider_idx").on(t.providerId, t.id),
    index("promotion_month_idx").on(t.providerId, t.createdAt),
    index("promotion_public_idx").on(t.status, t.endsAt, t.id),
    index("promotion_queue_idx").on(t.status, t.id),
  ]
);
