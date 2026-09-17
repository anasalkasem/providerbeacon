CREATE TABLE `site_appearance` (
 `id` int NOT NULL PRIMARY KEY,
 `edge_glow_enabled` boolean NOT NULL DEFAULT true,
 `revision` int NOT NULL DEFAULT 1,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `site_appearance` (`id`, `edge_glow_enabled`, `revision`) VALUES (1, true, 1);
