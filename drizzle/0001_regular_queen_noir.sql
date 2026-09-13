CREATE TABLE `audit_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(160) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(160) NOT NULL,
	`summary` varchar(500) NOT NULL,
	`metadata` json,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `localized_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('provider','service','page') NOT NULL,
	`entityId` varchar(160) NOT NULL,
	`fieldName` varchar(100) NOT NULL,
	`locale` enum('en','es','ar','hi','zh') NOT NULL,
	`value` text NOT NULL,
	`status` enum('draft','machine_translated','reviewed','published') NOT NULL DEFAULT 'draft',
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `localized_content_id` PRIMARY KEY(`id`),
	CONSTRAINT `localized_content_unique` UNIQUE(`entityType`,`entityId`,`fieldName`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `price_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`pricePerThousandUsd` decimal(12,4) NOT NULL,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provider_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`baseUrl` varchar(500) NOT NULL,
	`credentialReference` varchar(240),
	`status` enum('disabled','active','error') NOT NULL DEFAULT 'disabled',
	`lastSyncedAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provider_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`name` varchar(200) NOT NULL,
	`initials` varchar(12) NOT NULL,
	`status` enum('draft','pending_review','active','suspended') NOT NULL DEFAULT 'draft',
	`tier` enum('tier_1_direct','verified_enterprise','certified_wholesale','specialized_partner') NOT NULL DEFAULT 'specialized_partner',
	`countryCode` varchar(2),
	`location` varchar(160),
	`description` text,
	`websiteUrl` varchar(500),
	`verified` boolean NOT NULL DEFAULT false,
	`score` int NOT NULL DEFAULT 0,
	`ratingBasisPoints` int NOT NULL DEFAULT 0,
	`reviewCount` int NOT NULL DEFAULT 0,
	`responseMinutes` int,
	`apiLatencyMs` int,
	`apiUptimeBasisPoints` int,
	`successRateBasisPoints` int,
	`minDepositUsd` decimal(10,2),
	`totalOrdersLabel` varchar(40),
	`activeServicesCount` int NOT NULL DEFAULT 0,
	`refillPolicy` varchar(180),
	`paymentMethods` json,
	`specialties` json,
	`strengths` json,
	`auditSignals` json,
	`sourceUpdatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `service_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` int NOT NULL,
	`externalId` varchar(160),
	`slug` varchar(190) NOT NULL,
	`platform` varchar(80) NOT NULL,
	`category` varchar(120) NOT NULL,
	`name` varchar(300) NOT NULL,
	`status` enum('draft','active','paused','archived') NOT NULL DEFAULT 'draft',
	`pricePerThousandUsd` decimal(12,4) NOT NULL,
	`minOrder` int NOT NULL,
	`maxOrder` int NOT NULL,
	`startMinutesMin` int,
	`startMinutesMax` int,
	`deliveryMinutesMin` int,
	`deliveryMinutesMax` int,
	`refillMode` enum('none','manual','automatic','lifetime') NOT NULL DEFAULT 'none',
	`refillDays` int,
	`quality` enum('standard','premium','elite') NOT NULL DEFAULT 'standard',
	`retentionBasisPoints` int,
	`featured` boolean NOT NULL DEFAULT false,
	`sourceUpdatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_provider_slug_unique` UNIQUE(`providerId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`email` varchar(320) NOT NULL,
	`role` enum('owner','administrator','operations_manager','provider_reviewer','catalogue_editor','translation_manager','auditor') NOT NULL,
	`status` enum('invited','active','suspended') NOT NULL DEFAULT 'invited',
	`invitedByUserId` int,
	`invitationTokenHash` varchar(128),
	`invitationExpiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `team_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `team_member_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `audit_entries` ADD CONSTRAINT `audit_entries_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `localized_content` ADD CONSTRAINT `localized_content_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_snapshots` ADD CONSTRAINT `price_snapshots_serviceId_service_records_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `service_records`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_integrations` ADD CONSTRAINT `provider_integrations_providerId_provider_records_id_fk` FOREIGN KEY (`providerId`) REFERENCES `provider_records`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_records` ADD CONSTRAINT `service_records_providerId_provider_records_id_fk` FOREIGN KEY (`providerId`) REFERENCES `provider_records`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_invitedByUserId_users_id_fk` FOREIGN KEY (`invitedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_entries` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `audit_actor_created_idx` ON `audit_entries` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `localized_status_idx` ON `localized_content` (`locale`,`status`);--> statement-breakpoint
CREATE INDEX `price_service_captured_idx` ON `price_snapshots` (`serviceId`,`capturedAt`);--> statement-breakpoint
CREATE INDEX `integration_provider_status_idx` ON `provider_integrations` (`providerId`,`status`);--> statement-breakpoint
CREATE INDEX `provider_status_score_idx` ON `provider_records` (`status`,`score`);--> statement-breakpoint
CREATE INDEX `service_marketplace_idx` ON `service_records` (`status`,`platform`,`category`);--> statement-breakpoint
CREATE INDEX `team_member_user_status_idx` ON `team_members` (`userId`,`status`);