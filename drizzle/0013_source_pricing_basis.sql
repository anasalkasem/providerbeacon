-- No pricing unit is inferred or backfilled without evidence.
ALTER TABLE service_records
  ADD COLUMN sourcePriceUnit enum('per_1000','per_item','package') NULL,
  ADD COLUMN sourcePackageDescription varchar(300) NULL,
  ADD COLUMN sourcePricingEvidenceUrl varchar(500) NULL,
  ADD COLUMN sourcePricingConfirmedAt timestamp NULL,
  ADD COLUMN sourcePricingIdentity varchar(64) NULL;
