CREATE TABLE IF NOT EXISTS `assistant_usage_buckets` (
  `bucket_key` varchar(128) NOT NULL,
  `used` int NOT NULL DEFAULT 0,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`bucket_key`),
  KEY `assistant_usage_expiry_idx` (`expires_at`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assistant_exchange_rates` (
  `base_code` varchar(3) NOT NULL,
  `rates` json NOT NULL,
  `as_of` bigint NOT NULL,
  `next_update` bigint NOT NULL,
  PRIMARY KEY (`base_code`)
);
