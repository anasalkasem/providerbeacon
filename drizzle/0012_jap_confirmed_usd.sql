-- The owner confirmed US dollars for the existing JustAnotherPanel API account.
-- Currency confirmation does not establish a sale unit, approval or service quality.
ALTER TABLE provider_integrations ADD COLUMN sourceCurrency varchar(3) NULL;
--> statement-breakpoint
ALTER TABLE service_records ADD COLUMN sourceCurrency varchar(3) NULL;
--> statement-breakpoint
INSERT INTO audit_entries (action,entityType,entityId,summary,metadata)
SELECT 'integration.source_currency.confirm','integration',CAST(i.id AS CHAR),
  'Owner confirmed USD for the connected JustAnotherPanel API account',
  JSON_OBJECT('providerId',p.id,'before',i.sourceCurrency,'after','USD','basis','owner_confirmation','saleUnitConfirmed',false,'serviceReviewsUnchanged',true)
FROM provider_integrations i JOIN provider_records p ON p.id=i.providerId
WHERE p.slug='justanotherpanel' AND i.baseUrl='https://justanotherpanel.com/api/v2'
  AND i.lastSyncedAt IS NOT NULL AND i.credentialCiphertext IS NOT NULL AND i.sourceCurrency IS NULL;
--> statement-breakpoint
UPDATE provider_integrations i JOIN provider_records p ON p.id=i.providerId
SET i.sourceCurrency='USD'
WHERE p.slug='justanotherpanel' AND i.baseUrl='https://justanotherpanel.com/api/v2'
  AND i.lastSyncedAt IS NOT NULL AND i.credentialCiphertext IS NOT NULL AND i.sourceCurrency IS NULL;
--> statement-breakpoint
UPDATE service_records s JOIN provider_integrations i ON i.providerId=s.providerId AND i.baseUrl=s.sourceUrl
JOIN provider_records p ON p.id=s.providerId
SET s.sourceCurrency=i.sourceCurrency,s.priceCurrency=COALESCE(s.priceCurrency,i.sourceCurrency),s.revision=s.revision+1
WHERE p.slug='justanotherpanel' AND i.baseUrl='https://justanotherpanel.com/api/v2'
  AND i.sourceCurrency='USD' AND i.lastSyncedAt IS NOT NULL AND i.credentialCiphertext IS NOT NULL
  AND s.sourceKind='provider_api' AND s.sourceCurrency IS NULL;
