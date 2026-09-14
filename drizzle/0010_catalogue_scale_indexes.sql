CREATE INDEX `provider_status_id_idx` ON `provider_records` (`status`,`id`);
--> statement-breakpoint
CREATE INDEX `service_public_state_idx` ON `service_records` (`status`,`reviewStatus`,`available`,`incomplete`,`providerId`,`id`);
--> statement-breakpoint
CREATE INDEX `service_public_category_price_idx` ON `service_records` (`status`,`reviewStatus`,`priceCurrency`,`priceUnit`,`platform`,`category`,`pricePerThousandUsd`,`id`);
