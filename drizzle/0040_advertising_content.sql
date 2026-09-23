ALTER TABLE `provider_promotions` ADD `cover_id` varchar(64);
--> statement-breakpoint
ALTER TABLE `provider_promotions` ADD `category` varchar(32) NOT NULL DEFAULT 'all';
--> statement-breakpoint
ALTER TABLE `provider_promotions` ADD `placement` enum('subscription','platform') NOT NULL DEFAULT 'subscription';
--> statement-breakpoint
ALTER TABLE `provider_promotions` ADD `show_in_explorer` boolean NOT NULL DEFAULT false;
