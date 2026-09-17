CREATE TABLE `messaging_preferences` (
 `user_id` int NOT NULL PRIMARY KEY, `locale` varchar(5) NOT NULL DEFAULT 'en',
 `available` boolean NOT NULL DEFAULT false, `last_seen_at` timestamp(3) NULL, `last_assigned_at` timestamp(3) NULL,
 FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `messaging_control` (`id` int NOT NULL PRIMARY KEY, `revision` int NOT NULL DEFAULT 1);
--> statement-breakpoint
INSERT INTO `messaging_control` (`id`) VALUES (1);
--> statement-breakpoint
CREATE TABLE `messaging_conversations` (
 `id` varchar(36) NOT NULL PRIMARY KEY, `kind` enum('direct','support') NOT NULL,
 `direct_key` varchar(50) NULL, `visitor_key` varchar(64) NULL, `visitor_expires_at` timestamp(3) NULL, `visitor_name` varchar(80) NULL,
 `visitor_locale` varchar(5) NOT NULL DEFAULT 'en', `visitor_read_id` int NOT NULL DEFAULT 0,
 `status` enum('waiting','assigned','closed') NOT NULL DEFAULT 'waiting', `assigned_user_id` int NULL,
 `last_message_id` int NOT NULL DEFAULT 0,
 `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY `messaging_direct_unique` (`direct_key`), UNIQUE KEY `messaging_visitor_unique` (`visitor_key`),
 KEY `messaging_assigned_idx` (`assigned_user_id`,`status`,`updated_at`), KEY `messaging_queue_idx` (`kind`,`status`,`created_at`),
 FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `messaging_members` (
 `conversation_id` varchar(36) NOT NULL, `user_id` int NOT NULL, `read_id` int NOT NULL DEFAULT 0,
 PRIMARY KEY (`conversation_id`,`user_id`), KEY `messaging_member_user_idx` (`user_id`,`conversation_id`),
 FOREIGN KEY (`conversation_id`) REFERENCES `messaging_conversations` (`id`) ON DELETE CASCADE,
 FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `messaging_messages` (
 `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY, `conversation_id` varchar(36) NOT NULL, `client_id` varchar(80) NOT NULL,
 `sender` enum('staff','visitor','assistant') NOT NULL, `sender_user_id` int NULL,
 `original` text NOT NULL, `source_locale` varchar(5) NOT NULL, `imported` boolean NOT NULL DEFAULT false,
 `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY `messaging_message_retry_unique` (`conversation_id`,`client_id`), KEY `messaging_thread_id_idx` (`conversation_id`,`id`),
 FOREIGN KEY (`conversation_id`) REFERENCES `messaging_conversations` (`id`) ON DELETE CASCADE,
 FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `messaging_translations` (
 `message_id` int NOT NULL, `locale` varchar(5) NOT NULL, `text` text NULL, `source_locale` varchar(10) NULL,
 `status` enum('queued','working','done','failed') NOT NULL DEFAULT 'queued', `needs_review` boolean NOT NULL DEFAULT false,
 `attempts` int NOT NULL DEFAULT 0, `retry_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `lease` varchar(36) NULL, `lease_until` timestamp(3) NULL,
 PRIMARY KEY (`message_id`,`locale`), KEY `messaging_translation_queue_idx` (`status`,`retry_at`), KEY `messaging_translation_lease_idx` (`status`,`lease_until`),
 FOREIGN KEY (`message_id`) REFERENCES `messaging_messages` (`id`) ON DELETE CASCADE
);
