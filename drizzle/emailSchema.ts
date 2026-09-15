import {
  index,
  int,
  json,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { memberAccounts } from "./memberSchema";

export type EncryptedMail = {
  ciphertext: string;
  iv: string;
  tag: string;
  version: number;
};
export const emailOutbox = mysqlTable(
  "email_outbox",
  {
    id: int("id").autoincrement().primaryKey(),
    memberId: int("member_id")
      .notNull()
      .references(() => memberAccounts.id, { onDelete: "cascade" }),
    dedupeKey: varchar("dedupe_key", { length: 160 }).notNull(),
    kind: varchar("kind", { length: 24 }).notNull(),
    locale: varchar("locale", { length: 5 }).notNull(),
    subject: varchar("subject", { length: 200 }).notNull(),
    recipientHash: varchar("recipient_hash", { length: 64 }).notNull(),
    payload: json("payload").$type<EncryptedMail>(),
    status: varchar("status", { length: 24 }).default("queued").notNull(),
    attempts: int("attempts").default(0).notNull(),
    availableAt: timestamp("available_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    firstAttemptAt: timestamp("first_attempt_at"),
    leaseToken: varchar("lease_token", { length: 64 }),
    leaseUntil: timestamp("lease_until"),
    providerId: varchar("provider_id", { length: 100 }),
    lastError: varchar("last_error", { length: 64 }),
    actorId: int("actor_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    uniqueIndex("email_dedupe_unique").on(t.dedupeKey),
    uniqueIndex("email_provider_unique").on(t.providerId),
    index("email_due_idx").on(t.status, t.availableAt),
    index("email_member_idx").on(t.memberId, t.id),
    index("email_created_idx").on(t.createdAt),
    index("email_expiry_idx").on(t.expiresAt),
  ]
);

export const memberEmailTokens = mysqlTable(
  "member_email_tokens",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    memberId: int("member_id")
      .notNull()
      .references(() => memberAccounts.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 16 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    credentialHash: varchar("credential_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  t => [
    index("email_token_member_idx").on(t.memberId),
    index("email_token_expiry_idx").on(t.expiresAt),
  ]
);

export const emailSuppressions = mysqlTable("email_suppressions", {
  recipientHash: varchar("recipient_hash", { length: 64 }).primaryKey(),
  reason: varchar("reason", { length: 24 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const emailEvents = mysqlTable(
  "email_events",
  {
    id: varchar("id", { length: 160 }).primaryKey(),
    providerId: varchar("provider_id", { length: 100 }).notNull(),
    type: varchar("type", { length: 40 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  t => [
    index("email_event_provider_idx").on(t.providerId),
    index("email_event_created_idx").on(t.createdAt),
  ]
);
