ALTER TABLE service_records ADD COLUMN sourcePricingMode enum('auto','manual','blocked') NOT NULL DEFAULT 'auto';
--> statement-breakpoint
ALTER TABLE provider_sync_jobs ADD COLUMN pricingSnapshot json NULL;
--> statement-breakpoint
UPDATE service_records SET sourcePricingMode='manual' WHERE sourcePriceUnit IS NOT NULL;
--> statement-breakpoint
-- A previously withdrawn confirmation must not be restored automatically.
UPDATE service_records s
JOIN audit_entries a ON a.entityType='service'
  AND a.entityId=CAST(s.id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
  AND a.action='service.source_pricing.revoke'
SET s.sourcePricingMode='blocked'
WHERE s.sourcePriceUnit IS NULL AND NOT EXISTS (
  SELECT 1 FROM audit_entries newer WHERE newer.entityType='service'
    AND newer.entityId=a.entityId AND newer.id>a.id
    AND newer.action IN ('service.source_pricing.confirm','service.source_pricing.revoke')
);
--> statement-breakpoint
-- Refresh existing connected catalogues through the normal authenticated worker.
-- No currency, unit, service approval or provider score is guessed here.
UPDATE provider_integrations SET nextSyncAt=CURRENT_TIMESTAMP
WHERE status='active' AND credentialCiphertext IS NOT NULL;
