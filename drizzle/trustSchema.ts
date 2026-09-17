import {
  boolean,
  index,
  int,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { providerRecords } from "./schema";
import { memberAccounts } from "./memberSchema";

export const providerRatings = mysqlTable(
  "provider_ratings",
  {
    id: int("id").autoincrement().primaryKey(),
    providerId: int("provider_id")
      .notNull()
      .references(() => providerRecords.id, { onDelete: "cascade" }),
    memberId: int("member_id")
      .notNull()
      .references(() => memberAccounts.id, { onDelete: "cascade" }),
    stars: int("stars").notNull(),
    revision: int("revision").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    uniqueIndex("provider_rating_member_unique").on(t.providerId, t.memberId),
    index("provider_rating_member_idx").on(t.memberId),
  ]
);

// One durable lease coordinates background workers across replicas and restarts.
export const screeningControl = mysqlTable("service_screening_control", {
  id: int("id").primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
  leaseToken: varchar("lease_token", { length: 64 }),
  leaseUntil: timestamp("lease_until", { fsp: 3 }),
  budgetDay: varchar("budget_day", { length: 10 }),
  requestsUsed: int("requests_used").default(0).notNull(),
  lastRunAt: timestamp("last_run_at", { fsp: 3 }),
  lastError: varchar("last_error", { length: 40 }),
});
