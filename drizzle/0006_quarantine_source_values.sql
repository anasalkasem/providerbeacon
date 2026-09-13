ALTER TABLE `provider_sync_jobs` MODIFY COLUMN `status` enum('queued','preparing','importing','reconciling','completed','completed_with_issues','failed') NOT NULL DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE `provider_sync_jobs` ADD `invalidCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_sync_rows` ADD `invalid` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `sync_row_issue_idx` ON `provider_sync_rows` (`jobId`,`invalid`,`ordinal`);