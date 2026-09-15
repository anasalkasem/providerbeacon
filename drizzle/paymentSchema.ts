import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { providerRecords } from "./schema";
import { memberAccounts } from "./memberSchema";
import { paymentGateways, paymentStates } from "../shared/providerPayments";

// Immutable credential versions let already-created payments retain their verifier.
export const paymentCredentials = mysqlTable("payment_credentials", {
  id: varchar("id", { length: 36 }).primaryKey(),
  gateway: mysqlEnum("gateway", paymentGateways).notNull(),
  environment: mysqlEnum("environment", ["live", "sandbox"]).notNull(),
  ciphertext: text("ciphertext").notNull(),
  iv: varchar("iv", { length: 64 }).notNull(),
  tag: varchar("tag", { length: 64 }).notNull(),
  version: int("version").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const paymentGatewaySettings = mysqlTable("payment_gateway_settings", {
  gateway: mysqlEnum("gateway", paymentGateways).primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  credentialId: varchar("credential_id", { length: 36 }).references(
    () => paymentCredentials.id
  ),
  revision: int("revision").default(0).notNull(),
});
export const providerPayments = mysqlTable(
  "provider_payments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    providerId: int("provider_id").references(() => providerRecords.id, {
      onDelete: "set null",
    }),
    memberId: int("member_id").references(() => memberAccounts.id, {
      onDelete: "set null",
    }),
    credentialId: varchar("credential_id", { length: 36 })
      .notNull()
      .references(() => paymentCredentials.id),
    gateway: mysqlEnum("gateway", paymentGateways).notNull(),
    environment: mysqlEnum("environment", ["live", "sandbox"]).notNull(),
    state: mysqlEnum("state", paymentStates).default("creating").notNull(),
    amountCents: int("amount_cents").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    accountRevision: int("account_revision").notNull(),
    gatewayOrderId: varchar("gateway_order_id", { length: 128 }),
    transactionId: varchar("transaction_id", { length: 128 }),
    checkoutUrl: varchar("checkout_url", { length: 1000 }),
    gatewayStatus: varchar("gateway_status", { length: 40 }),
    reviewReason: varchar("review_reason", { length: 80 }),
    verifiedAt: timestamp("verified_at", { fsp: 3 }),
    appliedAt: timestamp("applied_at", { fsp: 3 }),
    periodStartsAt: timestamp("period_starts_at", { fsp: 3 }),
    periodEndsAt: timestamp("period_ends_at", { fsp: 3 }),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  t => [
    uniqueIndex("payment_order_unique").on(
      t.gateway,
      t.environment,
      t.gatewayOrderId
    ),
    uniqueIndex("payment_transaction_unique").on(
      t.gateway,
      t.environment,
      t.transactionId
    ),
    index("payment_provider_idx").on(t.providerId, t.createdAt),
    index("payment_member_idx").on(t.memberId, t.createdAt),
    index("payment_review_idx").on(t.state, t.createdAt),
  ]
);
export type ProviderPayment = typeof providerPayments.$inferSelect;
