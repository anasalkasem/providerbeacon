-- The owner requested visibility for their newly connected second provider.
-- Publish only the matching synced account. Do not change service reviews, pricing or verification.
INSERT INTO audit_entries (action,entityType,entityId,summary,metadata)
SELECT 'provider.api_catalogue.publish','provider',CAST(p.id AS CHAR),
  'Owner requested publication of the connected paksmmportal source catalogue',
  JSON_OBJECT('reason','Owner reported their successfully synced second provider missing from the public directory',
    'before',JSON_OBJECT('status',p.status,'apiCataloguePublished',p.apiCataloguePublished),
    'after',JSON_OBJECT('status','active','apiCataloguePublished',true),
    'qualityVerified',false,'serviceReviewsUnchanged',true)
FROM provider_records p WHERE p.slug = 'paksmmportal' AND p.status <> 'suspended' AND p.apiCataloguePublished = false
  AND EXISTS (SELECT 1 FROM provider_integrations i WHERE i.providerId=p.id
    AND i.baseUrl IN ('https://paksmmportal.com/api/v2','https://paksmmportal.com/api/v2/')
    AND i.status='active' AND i.lastSyncedAt IS NOT NULL AND i.credentialCiphertext IS NOT NULL)
  AND EXISTS (SELECT 1 FROM service_records s WHERE s.providerId=p.id AND s.sourceKind='provider_api'
    AND s.reviewStatus='pending' AND s.status IN ('draft','active') AND s.available=true
    AND s.externalId IS NOT NULL AND s.sourceUpdatedAt IS NOT NULL AND s.normalizationVersion>=1
    AND s.pricePerThousandUsd BETWEEN 0.0001 AND 100000 AND s.minOrder>=1 AND s.maxOrder>=s.minOrder
    AND s.sourceRate REGEXP '^[0-9]+([.][0-9]+)?$' AND CAST(s.sourceRate AS DECIMAL(20,10)) BETWEEN 0.0001 AND 100000);
--> statement-breakpoint
UPDATE provider_records p SET p.status='active',p.apiCataloguePublished=true WHERE p.slug = 'paksmmportal' AND p.status <> 'suspended' AND p.apiCataloguePublished = false
  AND EXISTS (SELECT 1 FROM provider_integrations i WHERE i.providerId=p.id
    AND i.baseUrl IN ('https://paksmmportal.com/api/v2','https://paksmmportal.com/api/v2/')
    AND i.status='active' AND i.lastSyncedAt IS NOT NULL AND i.credentialCiphertext IS NOT NULL)
  AND EXISTS (SELECT 1 FROM service_records s WHERE s.providerId=p.id AND s.sourceKind='provider_api'
    AND s.reviewStatus='pending' AND s.status IN ('draft','active') AND s.available=true
    AND s.externalId IS NOT NULL AND s.sourceUpdatedAt IS NOT NULL AND s.normalizationVersion>=1
    AND s.pricePerThousandUsd BETWEEN 0.0001 AND 100000 AND s.minOrder>=1 AND s.maxOrder>=s.minOrder
    AND s.sourceRate REGEXP '^[0-9]+([.][0-9]+)?$' AND CAST(s.sourceRate AS DECIMAL(20,10)) BETWEEN 0.0001 AND 100000);
