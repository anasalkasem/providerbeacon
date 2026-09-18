import {
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/mysql-core";
export const pushDevices = mysqlTable(
  "messaging_push_devices",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    actor: varchar("actor", { length: 70 }).notNull(),
    sessionHash: varchar("session_hash", { length: 64 }),
    encrypted: text("encrypted").notNull(),
    locale: varchar("locale", { length: 5 }).notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    queuedId: int("queued_id").default(0).notNull(),
    sentId: int("sent_id").default(0).notNull(),
    nextAt: timestamp("next_at", { fsp: 3 }),
    lease: varchar("lease", { length: 36 }),
    leaseUntil: timestamp("lease_until", { fsp: 3 }),
    attempts: int("attempts").default(0).notNull(),
  },
  t => [
    index("push_actor_idx").on(t.actor),
    index("push_due_idx").on(t.nextAt),
    index("push_expiry_idx").on(t.expiresAt),
  ]
);
