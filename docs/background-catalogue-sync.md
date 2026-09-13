# Background provider catalogue synchronization

The production connection returned 5,798 services, including a source row rejected by required-value validation. The previous import rejected the complete response and ran all database writes inside the administrator's HTTP request. Increasing that limit alone would extend request duration and hold provider locks across a large transaction.

## Operation

- `admin.integrations.syncNow` and the authenticated scheduled endpoint enqueue a durable database job and return its ID. The existing server permissions and GitHub OIDC checks still apply.
- One active job per provider is enforced by a unique database key and provider locks. Repeated clicks return the existing job. Each application instance runs at most one worker step at a time; leases prevent instances from processing the same job together.
- The worker retrieves the encrypted credential only on the server. Jobs contain a configuration fingerprint, never an API key. Configuration edits and deletion are blocked while a job is active. An out-of-band configuration change stops the job before the next operation.
- Fetches have a 30-second deadline, HTTPS/public-host checks, no redirects, and a 16 MiB body limit. Responses must contain between 1 and 50,000 services. These are explicit safety limits, not a claimed production capacity benchmark.
- The complete response is inspected before changing service records. Empty responses, missing/duplicate IDs and entirely invalid catalogues fail without applying catalogue changes. Stable-ID rows with unsupported names, prices or quantities are quarantined with whitelisted source fields and precise problem codes; valid rows continue. No replacement values are invented. Normalization yields to the event loop every 50 rows.
- The inspected snapshot is staged in MySQL, with invalid rows explicitly marked. Every import transaction processes at most 100 services and commits its service changes, price history, audit entries and progress checkpoint together. It reads only matching metadata for that batch.
- Preparation restarts after a crashed lease expires; committed imports resume from their checkpoint. Lease tokens prevent an obsolete worker from applying changes. The worker starts with the application and continues after the browser closes.
- Only after the entire snapshot has been imported does reconciliation mark absent API services unavailable, in batches of 100. It never deletes the service history.
- A failed job preserves completed batches and shows the processed count. Retrying fetches a new validated snapshot; unchanged services do not receive duplicate price snapshots. A job failure is not a whole-catalogue rollback.
- Completed and failed jobs release the active-provider key. Temporary valid staging rows are deleted in batches of 1,000. Quarantined evidence, compact job metadata and the audit log remain available. Historical evidence/audit retention is a separate policy.
- The connection's existing schedule is respected. Disabling it during a run does not cancel the manual/in-flight work and never re-enables the schedule at completion.

## Review and UI

Arabic and English use the same component and behavior. The connection page polls progress every three seconds while a job is active and every 30 seconds otherwise. It shows source count, processed count, quarantine count, review count, price changes and missing services. Completion with quarantined rows is explicitly labeled. A permission-protected report pages through 25 issues at a time, showing the source ID, original rate/quantity fields and localized validation reasons. Duplicate sync, edit and delete actions are disabled during a run; scheduling can still be toggled.

Quarantined rows are not mistaken for removed services. Existing matching offers retain their previous numeric/source values, are held from publication and return to review; new invalid rows do not create service records. A successful import does not attest USD/per-1,000 pricing, guarantee terms, identity verification or policy eligibility. New or changed records return to review. Existing paused/archived states are preserved. Unchanged approved records retain their review state. Provider publication remains independently required for public visibility.

## Verification

The MySQL acceptance suite covers a 5,001-row source import, 100-row checkpoints, recovery after an expired lease, no repeated fetch during import recovery, exactly one price snapshot per new service, delayed source-removal handling, duplicate enqueue/worker protection, disabled scheduling, configuration changes, sanitized upstream failures and batch/audit rollback. The existing 50,000-row stored-catalogue test verifies bounded public and admin pagination. Production verification and the actual provider count are recorded in the pull request after deployment.

Additional MySQL cases cover mixed valid/invalid catalogues, preservation and publication holds for existing invalid records, exclusion of arbitrary response secrets, retained evidence after cleanup, an all-invalid batch within a partly valid catalogue, issue pagination, and entirely invalid response rejection.
