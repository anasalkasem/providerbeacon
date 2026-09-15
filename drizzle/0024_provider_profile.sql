ALTER TABLE `provider_records`
  ADD COLUMN `logoUrl` varchar(500) NULL,
  ADD COLUMN `websitePreviewUrl` varchar(500) NULL,
  ADD COLUMN `telegramUrl` varchar(500) NULL,
  ADD COLUMN `profileRevision` int NOT NULL DEFAULT 1;
