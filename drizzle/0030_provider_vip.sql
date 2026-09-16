CREATE TABLE `provider_vip_cards` (
  `provider_id` int PRIMARY KEY,
  `owner_member_id` int,
  `website_host` varchar(255) NOT NULL,
  `tagline` varchar(140) NOT NULL,
  `specialties` json NOT NULL,
  `cover_id` varchar(64) NOT NULL,
  `offer` varchar(80) NOT NULL,
  `offer_ends_at` timestamp(3) NULL,
  `status` enum('pending','approved','rejected','hidden') NOT NULL DEFAULT 'pending',
  `revision` int NOT NULL DEFAULT 1,
  `review_note` varchar(600),
  `reviewed_at` timestamp(3) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `vip_queue_idx` (`status`, `updated_at`),
  FOREIGN KEY (`provider_id`) REFERENCES `provider_records` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`owner_member_id`) REFERENCES `member_accounts` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `provider_vip_daily` (
  `provider_id` int NOT NULL,
  `day` date NOT NULL,
  `impressions` int NOT NULL DEFAULT 0,
  `clicks` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`provider_id`, `day`),
  KEY `vip_daily_day_idx` (`day`),
  FOREIGN KEY (`provider_id`) REFERENCES `provider_records` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `provider_vip_dedupe` (
  `provider_id` int NOT NULL,
  `visitor_key` varchar(64) NOT NULL,
  `kind` enum('impression','click') NOT NULL,
  `last_counted_at` timestamp(3) NOT NULL,
  `expires_at` timestamp(3) NOT NULL,
  PRIMARY KEY (`provider_id`, `visitor_key`, `kind`),
  KEY `vip_dedupe_expiry_idx` (`expires_at`),
  FOREIGN KEY (`provider_id`) REFERENCES `provider_records` (`id`) ON DELETE CASCADE
);
