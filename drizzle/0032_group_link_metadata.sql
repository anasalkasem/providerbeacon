ALTER TABLE `link_metadata_cache`
  MODIFY COLUMN `kind` enum('website','telegram','whatsapp','discord') NOT NULL;
