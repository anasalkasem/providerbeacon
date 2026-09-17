ALTER TABLE `site_appearance` MODIFY COLUMN `theme` varchar(24) NOT NULL DEFAULT 'beacon';
--> statement-breakpoint
UPDATE `site_appearance` SET `theme` = 'beacon', `revision` = `revision` + 1 WHERE `theme` <> 'beacon';
