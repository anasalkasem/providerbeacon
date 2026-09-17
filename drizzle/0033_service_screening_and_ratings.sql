ALTER TABLE `service_records`
 ADD `screening_status` enum('pending','clear','held','review','manual_clear') NOT NULL DEFAULT 'pending',
 ADD `screening_revision` int NOT NULL DEFAULT 0,
 ADD `screening_reason` varchar(40) NOT NULL DEFAULT 'none',
 ADD `screening_evidence` varchar(500),
 ADD `screening_checked_at` timestamp NULL,
 ADD `screening_next_at` timestamp NULL,
 ADD `screening_attempts` int NOT NULL DEFAULT 0,
 ADD `screening_error` varchar(40),
 ADD `screening_model` varchar(100),
 ADD INDEX `service_screening_status_idx` (`screening_status`, `id`);
--> statement-breakpoint
CREATE TABLE `service_screening_control` (
 `id` int NOT NULL PRIMARY KEY,
 `enabled` boolean NOT NULL DEFAULT true,
 `lease_token` varchar(64),
 `lease_until` timestamp(3) NULL,
 `budget_day` varchar(10),
 `requests_used` int NOT NULL DEFAULT 0,
 `last_run_at` timestamp(3) NULL,
 `last_error` varchar(40)
);
--> statement-breakpoint
CREATE TABLE `provider_ratings` (
 `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
 `provider_id` int NOT NULL,
 `member_id` int NOT NULL,
 `stars` int NOT NULL,
 `revision` int NOT NULL DEFAULT 1,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY `provider_rating_member_unique` (`provider_id`, `member_id`),
 INDEX `provider_rating_member_idx` (`member_id`),
 CONSTRAINT `provider_rating_provider_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider_records` (`id`) ON DELETE CASCADE,
 CONSTRAINT `provider_rating_member_fk` FOREIGN KEY (`member_id`) REFERENCES `member_accounts` (`id`) ON DELETE CASCADE,
 CONSTRAINT `provider_rating_stars_check` CHECK (`stars` BETWEEN 1 AND 5)
);
