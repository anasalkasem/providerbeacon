ALTER TABLE member_watches
  ADD COLUMN email_alert_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN email_alert_consent_at timestamp NULL,
  ADD COLUMN email_alert_consent_version varchar(24) NULL,
  ADD COLUMN email_alert_revision int NOT NULL DEFAULT 0,
  ADD COLUMN email_alert_triggered_at timestamp NULL,
  ADD COLUMN email_alert_next_check_at timestamp NULL;
--> statement-breakpoint
CREATE INDEX member_watch_email_due_idx ON member_watches(email_alert_enabled, email_alert_triggered_at, email_alert_next_check_at, id);
--> statement-breakpoint
ALTER TABLE email_outbox ADD COLUMN price_alert json NULL;
