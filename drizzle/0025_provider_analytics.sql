CREATE TABLE `provider_analytics_state` (
  `id` int NOT NULL PRIMARY KEY,
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `provider_analytics_state` (`id`) VALUES (1);
--> statement-breakpoint
CREATE TABLE `provider_analytics_daily` (
  `provider_id` int NOT NULL,
  `day` date NOT NULL,
  `views` int NOT NULL DEFAULT 0,
  `website` int NOT NULL DEFAULT 0,
  `telegram` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`provider_id`, `day`),
  INDEX `provider_analytics_day_idx` (`day`),
  FOREIGN KEY (`provider_id`) REFERENCES `provider_records` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `provider_analytics_dedupe` (
  `provider_id` int NOT NULL,
  `visitor_key` varchar(64) NOT NULL,
  `kind` enum('view', 'website', 'telegram') NOT NULL,
  `last_counted_at` timestamp NOT NULL,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`provider_id`, `visitor_key`, `kind`),
  INDEX `provider_analytics_dedupe_expiry_idx` (`expires_at`),
  FOREIGN KEY (`provider_id`) REFERENCES `provider_records` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `provider_analytics_limits` (
  `bucket_key` varchar(100) NOT NULL PRIMARY KEY,
  `used` int NOT NULL DEFAULT 0,
  `expires_at` timestamp NOT NULL,
  INDEX `provider_analytics_limits_expiry_idx` (`expires_at`)
);
