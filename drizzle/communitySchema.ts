import {
  index,
  json,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import type { GroupLinkMetadata } from "../shared/linkMetadata";
import { memberAccounts } from "./memberSchema";
import { providerRecords } from "./schema";
import {
  groupLanguages,
  groupPlatforms,
  groupStatuses,
  groupTopics,
  reportReasons,
} from "../shared/community";

export const communityGroups = mysqlTable(
  "community_groups",
  {
    id: int("id").autoincrement().primaryKey(),
    submittedBy: int("submitted_by").references(() => memberAccounts.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 600 }).notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    urlKey: varchar("url_key", { length: 64 }).notNull(),
    platform: mysqlEnum("platform", groupPlatforms).notNull(),
    topic: mysqlEnum("topic", groupTopics).notNull(),
    language: mysqlEnum("language", groupLanguages).notNull(),
    providerId: int("provider_id").references(() => providerRecords.id, {
      onDelete: "set null",
    }),
    evidenceUrl: varchar("evidence_url", { length: 500 }),
    linkMetadata: json("link_metadata").$type<GroupLinkMetadata>(),
    status: mysqlEnum("status", groupStatuses).default("pending").notNull(),
    revision: int("revision").default(1).notNull(),
    reviewNote: varchar("review_note", { length: 600 }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  t => [
    uniqueIndex("community_group_url_unique").on(t.urlKey),
    index("community_group_public_idx").on(t.status, t.id),
    index("community_group_filter_idx").on(
      t.status,
      t.platform,
      t.topic,
      t.language,
      t.id
    ),
    index("community_group_member_idx").on(t.submittedBy, t.id),
  ]
);
export const communityReports = mysqlTable(
  "community_reports",
  {
    id: int("id").autoincrement().primaryKey(),
    groupId: int("group_id")
      .notNull()
      .references(() => communityGroups.id, { onDelete: "cascade" }),
    memberId: int("member_id")
      .notNull()
      .references(() => memberAccounts.id, { onDelete: "cascade" }),
    reason: mysqlEnum("reason", reportReasons).notNull(),
    note: varchar("note", { length: 500 }).notNull(),
    status: mysqlEnum("status", ["open", "resolved"]).default("open").notNull(),
    revision: int("revision").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  t => [
    uniqueIndex("community_report_member_unique").on(t.groupId, t.memberId),
    index("community_report_queue_idx").on(t.groupId, t.status, t.id),
  ]
);
