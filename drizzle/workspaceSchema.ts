import {
  boolean,
  index,
  int,
  json,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { memberAccounts } from "./memberSchema";
import { serviceRecords } from "./schema";
import type { SavedPrice } from "../shared/buyerWorkspace";

export const memberWatches = mysqlTable(
  "member_watches",
  {
    id: int("id").autoincrement().primaryKey(),
    memberId: int("member_id")
      .notNull()
      .references(() => memberAccounts.id, { onDelete: "cascade" }),
    serviceId: int("service_id").references(() => serviceRecords.id, {
      onDelete: "set null",
    }),
    quantity: int("quantity").notNull(),
    baseline: json("baseline").$type<SavedPrice>().notNull(),
    providerName: varchar("provider_name", { length: 200 }).notNull(),
    targetTotal: varchar("target_total", { length: 24 }),
    emailAlertEnabled: boolean("email_alert_enabled").default(false).notNull(),
    emailAlertConsentAt: timestamp("email_alert_consent_at"),
    emailAlertConsentVersion: varchar("email_alert_consent_version", {
      length: 24,
    }),
    emailAlertRevision: int("email_alert_revision").default(0).notNull(),
    emailAlertTriggeredAt: timestamp("email_alert_triggered_at"),
    emailAlertNextCheckAt: timestamp("email_alert_next_check_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  t => [
    uniqueIndex("member_watch_unique").on(t.memberId, t.serviceId),
    index("member_watch_owner_idx").on(t.memberId, t.id),
    index("member_watch_email_due_idx").on(
      t.emailAlertEnabled,
      t.emailAlertTriggeredAt,
      t.emailAlertNextCheckAt,
      t.id
    ),
  ]
);

export const memberComparisons = mysqlTable(
  "member_comparisons",
  {
    id: int("id").autoincrement().primaryKey(),
    memberId: int("member_id")
      .notNull()
      .references(() => memberAccounts.id, { onDelete: "cascade" }),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    serviceIds: json("service_ids").$type<string[]>().notNull(),
    quantity: int("quantity").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  t => [
    uniqueIndex("member_comparison_unique").on(t.memberId, t.fingerprint),
    index("member_comparison_owner_idx").on(t.memberId, t.id),
  ]
);
