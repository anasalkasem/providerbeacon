ALTER TABLE `team_members`
  ADD `invitation_locale` varchar(5) NOT NULL DEFAULT 'en',
  ADD `invite_email_id` int,
  ADD `revision` int NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `email_outbox`
  MODIFY `member_id` int NULL,
  ADD `team_member_id` int,
  ADD `invite_token_hash` varchar(64),
  ADD CONSTRAINT `email_team_fk` FOREIGN KEY (`team_member_id`) REFERENCES `team_members` (`id`) ON DELETE CASCADE,
  ADD INDEX `email_team_idx` (`team_member_id`, `id`);
