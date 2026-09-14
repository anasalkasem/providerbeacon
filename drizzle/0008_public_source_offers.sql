ALTER TABLE `service_records` MODIFY COLUMN `sourceKind` enum('legacy','provider_api','public_web') NOT NULL DEFAULT 'legacy';
