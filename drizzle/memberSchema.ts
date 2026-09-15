import {
  index,
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// Visitor identities never share rows or role fields with the staff user tables.
export const memberAccounts = mysqlTable(
  "member_accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    googleSubjectHash: varchar("google_subject_hash", { length: 64 }),
    recoveryCodeHash: varchar("recovery_code_hash", { length: 64 }),
    emailVerifiedAt: timestamp("email_verified_at"),
    locale: varchar("locale", { length: 5 }).default("en").notNull(),
    marketingOptIn: boolean("marketing_opt_in").default(false).notNull(),
    marketingConsentAt: timestamp("marketing_consent_at"),
    marketingConsentVersion: varchar("marketing_consent_version", { length: 32 }),
    status: mysqlEnum("status", ["active", "suspended"])
      .default("active")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("member_email_unique").on(table.email),
    uniqueIndex("member_google_subject_unique").on(table.googleSubjectHash),
  ]
);

export const memberSessions = mysqlTable(
  "member_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    memberId: int("member_id")
      .notNull()
      .references(() => memberAccounts.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    method: mysqlEnum("method", ["password", "google", "recovery"]).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  table => [
    uniqueIndex("member_session_token_unique").on(table.tokenHash),
    index("member_session_expiry_idx").on(table.expiresAt),
    index("member_session_owner_idx").on(table.memberId, table.id),
  ]
);

export const memberOAuthFlows = mysqlTable(
  "member_oauth_flows",
  {
    stateHash: varchar("state_hash", { length: 64 }).primaryKey(),
    browserHash: varchar("browser_hash", { length: 64 }).notNull(),
    payload: json("payload")
      .$type<{ ciphertext: string; iv: string; tag: string; version: number }>()
      .notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  table => [index("member_oauth_expiry_idx").on(table.expiresAt)]
);

export const memberAuthBuckets = mysqlTable(
  "member_auth_buckets",
  {
    key: varchar("bucket_key", { length: 160 }).primaryKey(),
    used: int("used").default(0).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  table => [index("member_auth_bucket_expiry_idx").on(table.expiresAt)]
);
