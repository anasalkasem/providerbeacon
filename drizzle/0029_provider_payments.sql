CREATE TABLE `payment_credentials` (
  `id` varchar(36) PRIMARY KEY NOT NULL,
  `gateway` enum('paypal','nowpayments') NOT NULL,
  `environment` enum('live','sandbox') NOT NULL,
  `ciphertext` text NOT NULL, `iv` varchar(64) NOT NULL, `tag` varchar(64) NOT NULL,
  `version` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `payment_gateway_settings` (
  `gateway` enum('paypal','nowpayments') PRIMARY KEY NOT NULL,
  `enabled` boolean NOT NULL DEFAULT false,
  `credential_id` varchar(36), `revision` int NOT NULL DEFAULT 0,
  FOREIGN KEY (`credential_id`) REFERENCES `payment_credentials` (`id`)
);
--> statement-breakpoint
INSERT INTO `payment_gateway_settings` (`gateway`) VALUES ('paypal'), ('nowpayments');
--> statement-breakpoint
CREATE TABLE `provider_payments` (
  `id` varchar(36) PRIMARY KEY NOT NULL,
  `provider_id` int, `member_id` int, `credential_id` varchar(36) NOT NULL,
  `gateway` enum('paypal','nowpayments') NOT NULL,
  `environment` enum('live','sandbox') NOT NULL,
  `state` enum('creating','pending','paid','review','failed','expired','refunded') NOT NULL DEFAULT 'creating',
  `amount_cents` int NOT NULL, `currency` varchar(3) NOT NULL DEFAULT 'USD',
  `account_revision` int NOT NULL,
  `gateway_order_id` varchar(128), `transaction_id` varchar(128),
  `checkout_url` varchar(1000), `gateway_status` varchar(40), `review_reason` varchar(80),
  `verified_at` timestamp(3), `applied_at` timestamp(3),
  `period_starts_at` timestamp(3), `period_ends_at` timestamp(3),
  `expires_at` timestamp(3) NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (`provider_id`) REFERENCES `provider_records` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`member_id`) REFERENCES `member_accounts` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`credential_id`) REFERENCES `payment_credentials` (`id`),
  UNIQUE KEY `payment_order_unique` (`gateway`,`environment`,`gateway_order_id`),
  UNIQUE KEY `payment_transaction_unique` (`gateway`,`environment`,`transaction_id`),
  KEY `payment_provider_idx` (`provider_id`,`created_at`),
  KEY `payment_member_idx` (`member_id`,`created_at`),
  KEY `payment_review_idx` (`state`,`created_at`)
);
