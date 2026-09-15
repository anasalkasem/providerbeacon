CREATE TABLE `link_metadata_cache` (
  `cache_key` varchar(64) NOT NULL PRIMARY KEY,
  `kind` enum('website','telegram') NOT NULL,
  `payload` json NOT NULL,
  `expires_at` timestamp NOT NULL,
  INDEX `link_metadata_expiry_idx` (`expires_at`)
);
--> statement-breakpoint
CREATE TABLE `imported_media` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `mime` varchar(40) NOT NULL,
  `content` mediumtext NOT NULL,
  `bytes` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE `community_groups` ADD `link_metadata` json;
