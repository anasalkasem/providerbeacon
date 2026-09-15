import {
  index,
  int,
  json,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import type { LinkMetadata } from "../shared/linkMetadata";

export const linkMetadataCache = mysqlTable(
  "link_metadata_cache",
  {
    key: varchar("cache_key", { length: 64 }).primaryKey(),
    kind: mysqlEnum("kind", ["website", "telegram"]).notNull(),
    payload: json("payload").$type<LinkMetadata>().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  t => [index("link_metadata_expiry_idx").on(t.expiresAt)]
);

// Small, content-addressed assets survive deployments without a filesystem volume.
export const importedMedia = mysqlTable("imported_media", {
  id: varchar("id", { length: 64 }).primaryKey(),
  mime: varchar("mime", { length: 40 }).notNull(),
  content: mediumtext("content").notNull(),
  bytes: int("bytes").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
