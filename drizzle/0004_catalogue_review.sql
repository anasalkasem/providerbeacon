ALTER TABLE `service_records` MODIFY COLUMN `refillMode` enum('none','manual','automatic','lifetime','unknown') NOT NULL DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE `service_records` ADD `countryCode` varchar(2);--> statement-breakpoint
ALTER TABLE `service_records` ADD `reviewStatus` enum('pending','approved','changes_requested') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `service_records` ADD `revision` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `service_records` ADD `normalizationVersion` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `service_records` ADD `incomplete` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `service_records` ADD `sourceData` json;--> statement-breakpoint
ALTER TABLE `service_records` ADD `originalSourceData` json;--> statement-breakpoint
ALTER TABLE `service_records` ADD `sourceHash` varchar(64);--> statement-breakpoint
ALTER TABLE `service_records` ADD `sourceUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `service_records` ADD `sourceKind` enum('legacy','provider_api') DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `service_records` ADD `classificationNotes` json;--> statement-breakpoint
ALTER TABLE `service_records` ADD `pricingConfirmed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `service_records` ADD `policyReviewed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `service_records` ADD `evidenceUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `service_records` ADD `priceCheckedAt` timestamp;--> statement-breakpoint
ALTER TABLE `service_records` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `service_records` ADD `reviewedByUserId` int;--> statement-breakpoint
ALTER TABLE `service_records` ADD `reviewReason` text;--> statement-breakpoint
ALTER TABLE `service_records` ADD `available` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `service_records` ADD `missingSourceAt` timestamp;--> statement-breakpoint
ALTER TABLE `service_records` ADD `lastPriceChangeAt` timestamp;--> statement-breakpoint
ALTER TABLE `service_records` ADD CONSTRAINT `service_records_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `service_provider_external_idx` ON `service_records` (`providerId`,`externalId`);--> statement-breakpoint
CREATE INDEX `service_review_id_idx` ON `service_records` (`reviewStatus`,`id`);--> statement-breakpoint
CREATE INDEX `service_normalization_id_idx` ON `service_records` (`normalizationVersion`,`id`);--> statement-breakpoint
CREATE INDEX `service_incomplete_id_idx` ON `service_records` (`incomplete`,`id`);--> statement-breakpoint
CREATE INDEX `service_available_id_idx` ON `service_records` (`available`,`id`);--> statement-breakpoint
CREATE INDEX `service_price_change_idx` ON `service_records` (`lastPriceChangeAt`,`id`);