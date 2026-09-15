CREATE TABLE `provider_business_accounts` (
  `provider_id` int NOT NULL PRIMARY KEY,
  `owner_member_id` int NULL,
  `owner_host` varchar(255) NULL,
  `ownership_verified_at` timestamp(3) NULL,
  `status` enum('inactive','active','suspended') NOT NULL DEFAULT 'inactive',
  `starts_at` timestamp(3) NULL,
  `ends_at` timestamp(3) NULL,
  `revision` int NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `business_provider_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider_records` (`id`) ON DELETE CASCADE,
  CONSTRAINT `business_owner_fk` FOREIGN KEY (`owner_member_id`) REFERENCES `member_accounts` (`id`) ON DELETE SET NULL,
  INDEX `business_owner_idx` (`owner_member_id`,`provider_id`),
  INDEX `business_plan_expiry_idx` (`status`,`ends_at`)
);
--> statement-breakpoint
CREATE TABLE `provider_ownership_claims` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `provider_id` int NOT NULL,
  `member_id` int NOT NULL,
  `token` varchar(80) NOT NULL,
  `proof_url` varchar(500) NULL,
  `website_host` varchar(255) NOT NULL,
  `status` enum('draft','pending','approved','rejected','revoked') NOT NULL DEFAULT 'draft',
  `revision` int NOT NULL DEFAULT 1,
  `review_note` varchar(600) NULL,
  `expires_at` timestamp(3) NOT NULL,
  `reviewed_at` timestamp(3) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `claim_provider_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider_records` (`id`) ON DELETE CASCADE,
  CONSTRAINT `claim_member_fk` FOREIGN KEY (`member_id`) REFERENCES `member_accounts` (`id`) ON DELETE CASCADE,
  UNIQUE INDEX `business_claim_identity_unique` (`provider_id`,`member_id`),
  INDEX `business_claim_queue_idx` (`status`,`id`),
  INDEX `business_claim_member_idx` (`member_id`,`id`)
);
--> statement-breakpoint
CREATE TABLE `provider_promotions` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `provider_id` int NOT NULL,
  `created_by_member_id` int NULL,
  `title` varchar(120) NOT NULL,
  `description` varchar(1200) NOT NULL,
  `coupon_code` varchar(64) NULL,
  `destination_url` varchar(500) NOT NULL,
  `starts_at` timestamp(3) NOT NULL,
  `ends_at` timestamp(3) NOT NULL,
  `status` enum('pending','approved','rejected','hidden') NOT NULL DEFAULT 'pending',
  `revision` int NOT NULL DEFAULT 1,
  `review_note` varchar(600) NULL,
  `reviewed_at` timestamp(3) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `promotion_provider_fk` FOREIGN KEY (`provider_id`) REFERENCES `provider_records` (`id`) ON DELETE CASCADE,
  CONSTRAINT `promotion_member_fk` FOREIGN KEY (`created_by_member_id`) REFERENCES `member_accounts` (`id`) ON DELETE SET NULL,
  INDEX `promotion_provider_idx` (`provider_id`,`id`),
  INDEX `promotion_month_idx` (`provider_id`,`created_at`),
  INDEX `promotion_public_idx` (`status`,`ends_at`,`id`),
  INDEX `promotion_queue_idx` (`status`,`id`)
);
--> statement-breakpoint
ALTER TABLE `community_groups` ADD COLUMN `requires_subscription` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE `community_groups` SET `requires_subscription` = true WHERE `provider_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `community_group_provider_idx` ON `community_groups` (`provider_id`,`id`);
