CREATE INDEX `service_provider_id_idx` ON `service_records` (`providerId`,`id`);--> statement-breakpoint
CREATE INDEX `service_status_id_idx` ON `service_records` (`status`,`id`);--> statement-breakpoint
CREATE INDEX `service_platform_id_idx` ON `service_records` (`platform`,`id`);--> statement-breakpoint
CREATE INDEX `service_public_featured_idx` ON `service_records` (`status`,`featured`,`id`);--> statement-breakpoint
CREATE INDEX `service_public_price_idx` ON `service_records` (`status`,`pricePerThousandUsd`,`id`);