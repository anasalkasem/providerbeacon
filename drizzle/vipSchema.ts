import {
  date,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { providerRecords } from "./schema";
import { memberAccounts } from "./memberSchema";
import { vipStatuses } from "../shared/providerVip";

export const providerVipCards = mysqlTable(
  "provider_vip_cards",
  {
    providerId: int("provider_id")
      .primaryKey()
      .references(() => providerRecords.id, { onDelete: "cascade" }),
    ownerMemberId: int("owner_member_id").references(() => memberAccounts.id, {
      onDelete: "set null",
    }),
    websiteHost: varchar("website_host", { length: 255 }).notNull(),
    tagline: varchar("tagline", { length: 140 }).notNull(),
    specialties: json("specialties").$type<string[]>().notNull(),
    coverId: varchar("cover_id", { length: 64 }).notNull(),
    placement: mysqlEnum("placement", ["subscription", "complimentary"])
      .default("subscription")
      .notNull(),
    complimentaryEndsAt: timestamp("complimentary_ends_at", { fsp: 3 }),
    offer: varchar("offer", { length: 80 }).notNull(),
    offerEndsAt: timestamp("offer_ends_at", { fsp: 3 }),
    status: mysqlEnum("status", vipStatuses).default("pending").notNull(),
    revision: int("revision").default(1).notNull(),
    reviewNote: varchar("review_note", { length: 600 }),
    reviewedAt: timestamp("reviewed_at", { fsp: 3 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  t => [index("vip_queue_idx").on(t.status, t.updatedAt)]
);

export const providerVipDaily = mysqlTable(
  "provider_vip_daily",
  {
    providerId: int("provider_id")
      .notNull()
      .references(() => providerRecords.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    impressions: int("impressions").default(0).notNull(),
    clicks: int("clicks").default(0).notNull(),
  },
  t => [
    primaryKey({ columns: [t.providerId, t.day] }),
    index("vip_daily_day_idx").on(t.day),
  ]
);
export const providerVipDedupe = mysqlTable(
  "provider_vip_dedupe",
  {
    providerId: int("provider_id")
      .notNull()
      .references(() => providerRecords.id, { onDelete: "cascade" }),
    visitorKey: varchar("visitor_key", { length: 64 }).notNull(),
    kind: mysqlEnum("kind", ["impression", "click"]).notNull(),
    lastCountedAt: timestamp("last_counted_at", { fsp: 3 }).notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
  },
  t => [
    primaryKey({ columns: [t.providerId, t.visitorKey, t.kind] }),
    index("vip_dedupe_expiry_idx").on(t.expiresAt),
  ]
);
