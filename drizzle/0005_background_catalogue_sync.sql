CREATE TABLE `provider_sync_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`integrationId` int NOT NULL,
	`providerId` int NOT NULL,
	`activeProviderId` int,
	`actorUserId` int,
	`scheduled` boolean NOT NULL DEFAULT false,
	`configFingerprint` varchar(64) NOT NULL,
	`sourceUrl` varchar(500) NOT NULL,
	`status` enum('queued','preparing','importing','reconciling','completed','failed') NOT NULL DEFAULT 'queued',
	`totalCount` int NOT NULL DEFAULT 0,
	`processedCount` int NOT NULL DEFAULT 0,
	`reviewCount` int NOT NULL DEFAULT 0,
	`priceChangeCount` int NOT NULL DEFAULT 0,
	`missingCount` int NOT NULL DEFAULT 0,
	`leaseToken` varchar(36),
	`leaseUntil` timestamp,
	`snapshotAt` timestamp,
	`startedAt` timestamp,
	`finishedAt` timestamp,
	`lastError` varchar(500),
	`stagingCleared` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_sync_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `sync_active_provider_unique` UNIQUE(`activeProviderId`)
);
--> statement-breakpoint
CREATE TABLE `provider_sync_rows` (
	`jobId` int NOT NULL,
	`ordinal` int NOT NULL,
	`externalId` varchar(160) NOT NULL,
	`payload` json NOT NULL,
	CONSTRAINT `provider_sync_rows_jobId_ordinal_pk` PRIMARY KEY(`jobId`,`ordinal`),
	CONSTRAINT `sync_row_external_unique` UNIQUE(`jobId`,`externalId`)
);
--> statement-breakpoint
ALTER TABLE `provider_sync_jobs` ADD CONSTRAINT `provider_sync_jobs_integrationId_provider_integrations_id_fk` FOREIGN KEY (`integrationId`) REFERENCES `provider_integrations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_sync_jobs` ADD CONSTRAINT `provider_sync_jobs_providerId_provider_records_id_fk` FOREIGN KEY (`providerId`) REFERENCES `provider_records`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_sync_jobs` ADD CONSTRAINT `provider_sync_jobs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_sync_rows` ADD CONSTRAINT `provider_sync_rows_jobId_provider_sync_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `provider_sync_jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sync_integration_id_idx` ON `provider_sync_jobs` (`integrationId`,`id`);--> statement-breakpoint
CREATE INDEX `sync_claim_idx` ON `provider_sync_jobs` (`status`,`leaseUntil`,`id`);--> statement-breakpoint
CREATE INDEX `sync_cleanup_idx` ON `provider_sync_jobs` (`stagingCleared`,`activeProviderId`,`id`);