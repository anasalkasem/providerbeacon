ALTER TABLE `member_accounts` ADD `locale` varchar(5) NOT NULL DEFAULT 'en', ADD `marketing_opt_in` boolean NOT NULL DEFAULT false, ADD `marketing_consent_at` timestamp NULL, ADD `marketing_consent_version` varchar(32) NULL;
--> statement-breakpoint
CREATE TABLE `email_outbox` (
 `id` int AUTO_INCREMENT PRIMARY KEY, `member_id` int NOT NULL, `dedupe_key` varchar(160) NOT NULL, `kind` varchar(24) NOT NULL, `locale` varchar(5) NOT NULL, `subject` varchar(200) NOT NULL, `recipient_hash` varchar(64) NOT NULL, `payload` json NULL, `status` varchar(24) NOT NULL DEFAULT 'queued', `attempts` int NOT NULL DEFAULT 0, `available_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `expires_at` timestamp NOT NULL, `first_attempt_at` timestamp NULL, `lease_token` varchar(64) NULL, `lease_until` timestamp NULL, `provider_id` varchar(100) NULL, `last_error` varchar(64) NULL, `actor_id` int NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT `email_outbox_member_fk` FOREIGN KEY (`member_id`) REFERENCES `member_accounts` (`id`) ON DELETE CASCADE,
 UNIQUE KEY `email_dedupe_unique` (`dedupe_key`), UNIQUE KEY `email_provider_unique` (`provider_id`), KEY `email_due_idx` (`status`,`available_at`), KEY `email_member_idx` (`member_id`,`id`)
);
--> statement-breakpoint
CREATE TABLE `member_email_tokens` (
 `token_hash` varchar(64) PRIMARY KEY, `member_id` int NOT NULL, `kind` varchar(16) NOT NULL, `email` varchar(320) NOT NULL, `credential_hash` varchar(64) NOT NULL, `expires_at` timestamp NOT NULL,
 CONSTRAINT `member_email_token_member_fk` FOREIGN KEY (`member_id`) REFERENCES `member_accounts` (`id`) ON DELETE CASCADE,
 KEY `email_token_member_idx` (`member_id`), KEY `email_token_expiry_idx` (`expires_at`)
);
--> statement-breakpoint
CREATE TABLE `email_suppressions` (`recipient_hash` varchar(64) PRIMARY KEY, `reason` varchar(24) NOT NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE `email_events` (`id` varchar(160) PRIMARY KEY, `provider_id` varchar(100) NOT NULL, `type` varchar(40) NOT NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY `email_event_provider_idx` (`provider_id`), KEY `email_event_created_idx` (`created_at`));
--> statement-breakpoint
CREATE INDEX `email_created_idx` ON `email_outbox` (`created_at`);
--> statement-breakpoint
CREATE INDEX `email_expiry_idx` ON `email_outbox` (`expires_at`);
