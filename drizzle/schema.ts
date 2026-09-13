import { boolean, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const providerRecords = mysqlTable("provider_records", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 160 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  initials: varchar("initials", { length: 12 }).notNull(),
  status: mysqlEnum("status", ["draft", "pending_review", "active", "suspended"]).default("draft").notNull(),
  tier: mysqlEnum("tier", ["tier_1_direct", "verified_enterprise", "certified_wholesale", "specialized_partner"]).default("specialized_partner").notNull(),
  countryCode: varchar("countryCode", { length: 2 }),
  location: varchar("location", { length: 160 }),
  description: text("description"),
  websiteUrl: varchar("websiteUrl", { length: 500 }),
  verified: boolean("verified").default(false).notNull(),
  score: int("score").default(0).notNull(),
  ratingBasisPoints: int("ratingBasisPoints").default(0).notNull(),
  reviewCount: int("reviewCount").default(0).notNull(),
  responseMinutes: int("responseMinutes"),
  apiLatencyMs: int("apiLatencyMs"),
  apiUptimeBasisPoints: int("apiUptimeBasisPoints"),
  successRateBasisPoints: int("successRateBasisPoints"),
  minDepositUsd: decimal("minDepositUsd", { precision: 10, scale: 2 }),
  totalOrdersLabel: varchar("totalOrdersLabel", { length: 40 }),
  activeServicesCount: int("activeServicesCount").default(0).notNull(),
  refillPolicy: varchar("refillPolicy", { length: 180 }),
  paymentMethods: json("paymentMethods").$type<string[]>(),
  specialties: json("specialties").$type<string[]>(),
  strengths: json("strengths").$type<string[]>(),
  auditSignals: json("auditSignals").$type<Record<string, number>>(),
  sourceUpdatedAt: timestamp("sourceUpdatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("provider_slug_unique").on(table.slug), index("provider_status_score_idx").on(table.status, table.score)]);

export const serviceRecords = mysqlTable("service_records", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("providerId").notNull().references(() => providerRecords.id, { onDelete: "cascade" }),
  externalId: varchar("externalId", { length: 160 }),
  slug: varchar("slug", { length: 190 }).notNull(),
  platform: varchar("platform", { length: 80 }).notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  status: mysqlEnum("status", ["draft", "active", "paused", "archived"]).default("draft").notNull(),
  pricePerThousandUsd: decimal("pricePerThousandUsd", { precision: 12, scale: 4 }).notNull(),
  minOrder: int("minOrder").notNull(),
  maxOrder: int("maxOrder").notNull(),
  startMinutesMin: int("startMinutesMin"),
  startMinutesMax: int("startMinutesMax"),
  deliveryMinutesMin: int("deliveryMinutesMin"),
  deliveryMinutesMax: int("deliveryMinutesMax"),
  refillMode: mysqlEnum("refillMode", ["none", "manual", "automatic", "lifetime"]).default("none").notNull(),
  refillDays: int("refillDays"),
  quality: mysqlEnum("quality", ["standard", "premium", "elite"]).default("standard").notNull(),
  retentionBasisPoints: int("retentionBasisPoints"),
  featured: boolean("featured").default(false).notNull(),
  sourceUpdatedAt: timestamp("sourceUpdatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("service_provider_slug_unique").on(table.providerId, table.slug), index("service_marketplace_idx").on(table.status, table.platform, table.category)]);

export const teamMembers = mysqlTable("team_members", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["owner", "administrator", "operations_manager", "provider_reviewer", "catalogue_editor", "translation_manager", "auditor"]).notNull(),
  status: mysqlEnum("status", ["invited", "active", "suspended"]).default("invited").notNull(),
  invitedByUserId: int("invitedByUserId").references(() => users.id, { onDelete: "set null" }),
  invitationTokenHash: varchar("invitationTokenHash", { length: 128 }),
  invitationExpiresAt: timestamp("invitationExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("team_member_email_unique").on(table.email), index("team_member_user_status_idx").on(table.userId, table.status)]);

export const auditEntries = mysqlTable("audit_entries", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 160 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 160 }).notNull(),
  summary: varchar("summary", { length: 500 }).notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("audit_entity_idx").on(table.entityType, table.entityId), index("audit_actor_created_idx").on(table.actorUserId, table.createdAt)]);

export const providerIntegrations = mysqlTable("provider_integrations", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("providerId").notNull().references(() => providerRecords.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  baseUrl: varchar("baseUrl", { length: 500 }).notNull(),
  credentialReference: varchar("credentialReference", { length: 240 }),
  status: mysqlEnum("status", ["disabled", "active", "error"]).default("disabled").notNull(),
  lastSyncedAt: timestamp("lastSyncedAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("integration_provider_status_idx").on(table.providerId, table.status)]);

export const priceSnapshots = mysqlTable("price_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull().references(() => serviceRecords.id, { onDelete: "cascade" }),
  pricePerThousandUsd: decimal("pricePerThousandUsd", { precision: 12, scale: 4 }).notNull(),
  capturedAt: timestamp("capturedAt").defaultNow().notNull(),
}, table => [index("price_service_captured_idx").on(table.serviceId, table.capturedAt)]);

export const localizedContent = mysqlTable("localized_content", {
  id: int("id").autoincrement().primaryKey(),
  entityType: mysqlEnum("entityType", ["provider", "service", "page"]).notNull(),
  entityId: varchar("entityId", { length: 160 }).notNull(),
  fieldName: varchar("fieldName", { length: 100 }).notNull(),
  locale: mysqlEnum("locale", ["en", "es", "ar", "hi", "zh"]).notNull(),
  value: text("value").notNull(),
  status: mysqlEnum("status", ["draft", "machine_translated", "reviewed", "published"]).default("draft").notNull(),
  updatedByUserId: int("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("localized_content_unique").on(table.entityType, table.entityId, table.fieldName, table.locale), index("localized_status_idx").on(table.locale, table.status)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ProviderRecord = typeof providerRecords.$inferSelect;
export type ServiceRecord = typeof serviceRecords.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type TeamRole = TeamMember["role"];
export type AuditEntry = typeof auditEntries.$inferSelect;
