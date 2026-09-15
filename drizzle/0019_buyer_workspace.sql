ALTER TABLE price_snapshots ADD COLUMN comparisonKey varchar(64) NULL;
--> statement-breakpoint
CREATE INDEX price_history_basis_idx ON price_snapshots(serviceId, comparisonKey, capturedAt);
--> statement-breakpoint
CREATE TABLE member_watches (
  id int AUTO_INCREMENT PRIMARY KEY,
  member_id int NOT NULL,
  service_id int NULL,
  quantity int NOT NULL,
  baseline json NOT NULL,
  provider_name varchar(200) NOT NULL,
  target_total varchar(24) NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT member_watch_account_fk FOREIGN KEY (member_id) REFERENCES member_accounts(id) ON DELETE CASCADE,
  CONSTRAINT member_watch_service_fk FOREIGN KEY (service_id) REFERENCES service_records(id) ON DELETE SET NULL,
  UNIQUE KEY member_watch_unique(member_id, service_id),
  INDEX member_watch_owner_idx(member_id, id)
);
--> statement-breakpoint
CREATE TABLE member_comparisons (
  id int AUTO_INCREMENT PRIMARY KEY,
  member_id int NOT NULL,
  fingerprint varchar(64) NOT NULL,
  name varchar(100) NOT NULL,
  service_ids json NOT NULL,
  quantity int NOT NULL,
  currency varchar(3) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT member_comparison_account_fk FOREIGN KEY (member_id) REFERENCES member_accounts(id) ON DELETE CASCADE,
  UNIQUE KEY member_comparison_unique(member_id, fingerprint),
  INDEX member_comparison_owner_idx(member_id, id)
);
