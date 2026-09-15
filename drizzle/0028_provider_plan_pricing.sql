ALTER TABLE `provider_business_accounts` ADD COLUMN `first_activated_at` timestamp(3) NULL;
--> statement-breakpoint
UPDATE `provider_business_accounts`
SET `first_activated_at` = `starts_at`
WHERE `starts_at` IS NOT NULL AND `ends_at` > `starts_at`;
