import {
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { providerRecords } from "./schema";

export const providerAnalyticsState = mysqlTable("provider_analytics_state", {
  id: int("id").primaryKey(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
});

export const providerAnalyticsDaily = mysqlTable(
  "provider_analytics_daily",
  {
    providerId: int("provider_id")
      .notNull()
      .references(() => providerRecords.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    views: int("views").default(0).notNull(),
    website: int("website").default(0).notNull(),
    telegram: int("telegram").default(0).notNull(),
  },
  table => [
    primaryKey({ columns: [table.providerId, table.day] }),
    index("provider_analytics_day_idx").on(table.day),
  ]
);

// Daily, keyed digests only. No raw visitor ID, IP, user agent or referrer.
export const providerAnalyticsDedupe = mysqlTable(
  "provider_analytics_dedupe",
  {
    providerId: int("provider_id")
      .notNull()
      .references(() => providerRecords.id, { onDelete: "cascade" }),
    visitorKey: varchar("visitor_key", { length: 64 }).notNull(),
    kind: mysqlEnum("kind", ["view", "website", "telegram"]).notNull(),
    lastCountedAt: timestamp("last_counted_at", { fsp: 3 }).notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
  },
  table => [
    primaryKey({ columns: [table.providerId, table.visitorKey, table.kind] }),
    index("provider_analytics_dedupe_expiry_idx").on(table.expiresAt),
  ]
);

export const providerAnalyticsLimits = mysqlTable(
  "provider_analytics_limits",
  {
    key: varchar("bucket_key", { length: 100 }).primaryKey(),
    used: int("used").default(0).notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
  },
  table => [index("provider_analytics_limits_expiry_idx").on(table.expiresAt)]
);
