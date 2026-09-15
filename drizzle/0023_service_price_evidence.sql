-- Re-read active source catalogues with the service-specific pricing adapter.
-- Preserve disabled connections, manual decisions, currencies and all prices.
UPDATE provider_integrations SET nextSyncAt=CURRENT_TIMESTAMP
WHERE status='active' AND credentialCiphertext IS NOT NULL;
