ALTER TABLE `provider_vip_cards`
  ADD COLUMN `placement` enum('subscription','complimentary') NOT NULL DEFAULT 'subscription',
  ADD COLUMN `complimentary_ends_at` timestamp(3) NULL;
