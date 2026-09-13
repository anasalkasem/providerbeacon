DROP INDEX `service_public_price_idx` ON `service_records`;--> statement-breakpoint
ALTER TABLE `price_snapshots` ADD `sourceRate` varchar(2000);--> statement-breakpoint
ALTER TABLE `price_snapshots` ADD `priceCurrency` varchar(3);--> statement-breakpoint
ALTER TABLE `price_snapshots` ADD `priceUnit` enum('per_1000','per_item','package');--> statement-breakpoint
ALTER TABLE `price_snapshots` ADD `packageDescription` varchar(300);--> statement-breakpoint
ALTER TABLE `price_snapshots` ADD `kind` enum('legacy','source','review') DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `service_records` ADD `sourceRate` varchar(2000);--> statement-breakpoint
ALTER TABLE `service_records` ADD `priceCurrency` varchar(3);--> statement-breakpoint
ALTER TABLE `service_records` ADD `priceUnit` enum('per_1000','per_item','package');--> statement-breakpoint
ALTER TABLE `service_records` ADD `packageDescription` varchar(300);--> statement-breakpoint
CREATE INDEX `service_public_price_idx` ON `service_records` (`status`,`priceCurrency`,`priceUnit`,`pricePerThousandUsd`,`id`);
--> statement-breakpoint
-- Preserve exact retained API rates, never reconstruct them from reviewed amounts.
UPDATE `service_records` SET `sourceRate` = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`sourceData`, '$.rate')), JSON_UNQUOTE(JSON_EXTRACT(`sourceData`, '$.price'))) WHERE `sourceKind` = 'provider_api';
--> statement-breakpoint
-- The old confirmation explicitly attested USD / 1,000. Unconfirmed imports stay unknown.
UPDATE `service_records` SET `priceCurrency` = 'USD', `priceUnit` = 'per_1000' WHERE `pricingConfirmed` = true AND `evidenceUrl` IS NOT NULL AND CHAR_LENGTH(`evidenceUrl`) > 0;
