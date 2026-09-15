CREATE TABLE `member_accounts` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `name` varchar(120) NOT NULL,
  `email` varchar(320) NOT NULL,
  `password_hash` varchar(255),
  `google_subject_hash` varchar(64),
  `recovery_code_hash` varchar(64),
  `email_verified_at` timestamp NULL,
  `status` enum('active','suspended') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `member_email_unique` (`email`),
  UNIQUE KEY `member_google_subject_unique` (`google_subject_hash`)
);
--> statement-breakpoint
CREATE TABLE `member_sessions` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `member_id` int NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `method` enum('password','google','recovery') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  UNIQUE KEY `member_session_token_unique` (`token_hash`),
  KEY `member_session_expiry_idx` (`expires_at`),
  KEY `member_session_owner_idx` (`member_id`,`id`),
  CONSTRAINT `member_session_owner_fk` FOREIGN KEY (`member_id`) REFERENCES `member_accounts` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `member_oauth_flows` (
  `state_hash` varchar(64) NOT NULL PRIMARY KEY,
  `browser_hash` varchar(64) NOT NULL,
  `payload` json NOT NULL,
  `expires_at` timestamp NOT NULL,
  KEY `member_oauth_expiry_idx` (`expires_at`)
);
--> statement-breakpoint
CREATE TABLE `member_auth_buckets` (
  `bucket_key` varchar(160) NOT NULL PRIMARY KEY,
  `used` int NOT NULL DEFAULT 0,
  `expires_at` timestamp NOT NULL,
  KEY `member_auth_bucket_expiry_idx` (`expires_at`)
);
