CREATE TABLE `staff_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`passwordChangedAt` timestamp NOT NULL DEFAULT (now()),
	`failedLoginAttempts` int NOT NULL DEFAULT 0,
	`lockedUntil` timestamp,
	`mfaEnabled` boolean NOT NULL DEFAULT false,
	`mfaSecretCiphertext` text,
	`mfaSecretIv` varchar(64),
	`mfaSecretTag` varchar(64),
	`mfaSecretVersion` int NOT NULL DEFAULT 1,
	`recoveryCodeHashes` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_account_user_unique` UNIQUE(`userId`),
	CONSTRAINT `staff_account_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `staff_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`mfaVerified` boolean NOT NULL DEFAULT false,
	`ipAddress` varchar(64),
	`userAgent` varchar(500),
	`expiresAt` timestamp NOT NULL,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_session_token_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `provider_integrations` ADD `credentialCiphertext` text;--> statement-breakpoint
ALTER TABLE `provider_integrations` ADD `credentialIv` varchar(64);--> statement-breakpoint
ALTER TABLE `provider_integrations` ADD `credentialTag` varchar(64);--> statement-breakpoint
ALTER TABLE `provider_integrations` ADD `credentialVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_integrations` ADD `syncIntervalMinutes` int DEFAULT 360 NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_integrations` ADD `nextSyncAt` timestamp;--> statement-breakpoint
ALTER TABLE `provider_integrations` ADD `syncLockUntil` timestamp;--> statement-breakpoint
ALTER TABLE `provider_integrations` ADD `consecutiveFailures` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `staff_accounts` ADD CONSTRAINT `staff_accounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_sessions` ADD CONSTRAINT `staff_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `staff_session_user_expiry_idx` ON `staff_sessions` (`userId`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `integration_due_idx` ON `provider_integrations` (`status`,`nextSyncAt`);