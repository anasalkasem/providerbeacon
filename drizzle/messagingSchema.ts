import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { users } from "./schema";

export const messagingPreferences = mysqlTable("messaging_preferences", {
  userId: int("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 5 }).default("en").notNull(),
  available: boolean("available").default(false).notNull(),
  lastSeenAt: timestamp("last_seen_at", { fsp: 3 }),
  lastAssignedAt: timestamp("last_assigned_at", { fsp: 3 }),
});
export const messagingControl = mysqlTable("messaging_control", {
  id: int("id").primaryKey(),
  revision: int("revision").default(1).notNull(),
});
export const conversations = mysqlTable(
  "messaging_conversations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    kind: mysqlEnum("kind", ["direct", "support"]).notNull(),
    directKey: varchar("direct_key", { length: 50 }),
    visitorKey: varchar("visitor_key", { length: 64 }),
    visitorExpiresAt: timestamp("visitor_expires_at", { fsp: 3 }),
    visitorName: varchar("visitor_name", { length: 80 }),
    visitorLocale: varchar("visitor_locale", { length: 5 })
      .default("en")
      .notNull(),
    visitorReadId: int("visitor_read_id").default(0).notNull(),
    status: mysqlEnum("status", ["waiting", "assigned", "closed"])
      .default("waiting")
      .notNull(),
    assignedUserId: int("assigned_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lastMessageId: int("last_message_id").default(0).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).defaultNow().notNull(),
  },
  t => [
    uniqueIndex("messaging_direct_unique").on(t.directKey),
    uniqueIndex("messaging_visitor_unique").on(t.visitorKey),
    index("messaging_assigned_idx").on(t.assignedUserId, t.status, t.updatedAt),
    index("messaging_queue_idx").on(t.kind, t.status, t.createdAt),
  ]
);
export const conversationMembers = mysqlTable(
  "messaging_members",
  {
    conversationId: varchar("conversation_id", { length: 36 })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readId: int("read_id").default(0).notNull(),
  },
  t => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("messaging_member_user_idx").on(t.userId, t.conversationId),
  ]
);
export const conversationMessages = mysqlTable(
  "messaging_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    conversationId: varchar("conversation_id", { length: 36 })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    clientId: varchar("client_id", { length: 80 }).notNull(),
    sender: mysqlEnum("sender", ["staff", "visitor", "assistant"]).notNull(),
    senderUserId: int("sender_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    original: text("original").notNull(),
    sourceLocale: varchar("source_locale", { length: 5 }).notNull(),
    imported: boolean("imported").default(false).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  },
  t => [
    uniqueIndex("messaging_message_retry_unique").on(
      t.conversationId,
      t.clientId
    ),
    index("messaging_thread_id_idx").on(t.conversationId, t.id),
  ]
);
export const messageTranslations = mysqlTable(
  "messaging_translations",
  {
    messageId: int("message_id")
      .notNull()
      .references(() => conversationMessages.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 5 }).notNull(),
    text: text("text"),
    sourceLocale: varchar("source_locale", { length: 10 }),
    status: mysqlEnum("status", ["queued", "working", "done", "failed"])
      .default("queued")
      .notNull(),
    needsReview: boolean("needs_review").default(false).notNull(),
    attempts: int("attempts").default(0).notNull(),
    retryAt: timestamp("retry_at", { fsp: 3 }).defaultNow().notNull(),
    lease: varchar("lease", { length: 36 }),
    leaseUntil: timestamp("lease_until", { fsp: 3 }),
  },
  t => [
    primaryKey({ columns: [t.messageId, t.locale] }),
    index("messaging_translation_queue_idx").on(t.status, t.retryAt),
    index("messaging_translation_lease_idx").on(t.status, t.leaseUntil),
  ]
);
