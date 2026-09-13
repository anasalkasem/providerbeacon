# Catalogue classification and review

## Workflow

The shared English/Arabic catalogue and review pages use the same components, API and permissions. Lists return 25 rows by default (100 maximum); source JSON is fetched only for the selected service. Select at most 50 rows from the current page for a reasoned, atomic review action.

1. Import or legacy classification creates a pending draft. It never grants verification or publication.
2. An editor corrects the platform, service type, target country, quantities and refill terms. Unknown information stays unspecified. Original and latest retained source records remain available.
3. An editor explicitly confirms the currency is USD and the rate is per 1,000 units, against a public evidence URL, and checks publication eligibility. A source response containing only a rate is insufficient to make those claims.
4. A reviewer approves complete records with price/source evidence no older than 30 days. Approval does not publish a draft.
5. A publisher publishes approved records only when their provider is active and the service is available. Paused/archived services must first return to draft.
6. Source changes reset approval and withdraw active services to draft. A service missing from a complete, valid API catalogue is held, never deleted. Empty responses and invalid/duplicate catalogue identities preserve the existing catalogue and report failure. Stable-ID rows with invalid values are quarantined while valid rows continue; see background-catalogue-sync.md.

Every human review mutation requires a reason. Revisions reject outdated decisions; bulk decisions are all-or-nothing. Audit writes and data mutations share a transaction. Review audit entries retain actor, request IP, reason and before/after values. Automated changes record provider source, changed values and revisions; they do not pretend to have a human reviewer or request IP.

## Actionable review queues

The review page opens all review states by default so previously requested corrections remain visible. Search, platform, country, publication status and review-state filters constrain both the table and its worklist counts. The worklist adds eight needs: unconfirmed pricing, missing evidence, unchecked eligibility, incomplete classification, invalid numeric values, unavailable source, stale evidence and ready for approval. These categories overlap. Choosing a need narrows the table without hiding the other counts; pagination never changes the totals. Each queue explains the next required action in Arabic and English.

`admin.services.reviewSummary` is protected by `services.read` and returns nine numeric fields from a SQL aggregate. It does not load service objects or source JSON, and it is requested only on the review page. Counts refresh every 30 seconds and after service edits. The existing bounded list adds current blocker codes and server-computed approval/publication readiness using the same checks as the review mutation. Raw evidence URLs, source JSON and helper fields are excluded from the list response. Table rows display each missing requirement, and stale or otherwise blocked selections disable approval/publication controls. The API still rechecks the latest revision and requirements at submission.

Ready for approval means complete current evidence and a review state other than approved. It does not set approval, attest a price, publish a service or activate a provider. Existing provider/status gates continue to control publication separately.

## Permissions

| Action | Permission | Initial roles |
| --- | --- | --- |
| Read catalogue and evidence | `services.read` | Existing catalogue readers |
| Correct details | `services.write` | Owner, administrator, operations manager, catalogue editor |
| Approve / request changes | `services.review` | Owner, administrator, operations manager, provider reviewer |
| Publish | `services.publish` | Owner, administrator, operations manager |
| Read connection alerts | `integrations.read` | Existing integration readers |

The API enforces each permission. The legacy edit endpoint rejects activation; it cannot bypass the publication workflow. Approval is attached to the current record revision, not merely a checkbox in the browser.

## Evidence and eligibility policy for the initial batch

The operator must inspect actual provider terms and evidence. Do not approve based on a name, an AI suggestion or a provider's unverifiable marketing claim. Check that the described service and delivery method are eligible under the catalogue policy and the destination platform's applicable rules. Prefer verifiable advertising, content and sustainable marketing services. Bought engagement and automated traffic are flagged for explicit review; the classifier does not certify them as authentic or compliant.

Do not invent target countries from a user's language, derive refill days from a boolean, or treat a provider claim as independent verification. Unsupported refill duration stays unspecified. No Beacon score or verified badge is granted by this workflow.

The [JustAnotherPanel API documentation](https://justanotherpanel.com/api) describes `service`, `name`, `type`, `category`, `rate`, `min`, `max`, `refill` and `cancel`. Its service-list example does not itself establish a per-service currency, price unit or refill duration. These require evidence at review time. A change in source pricing clears prior price confirmation.

## Legacy repair and deployment

Migration `0004_catalogue_review.sql` adds source, review, revision and availability fields plus indexes; it does not drop records. Existing offers default to pending/incomplete, so activation alone no longer makes them public. Startup classification processes at most 100 legacy services per transaction, yielding between batches. It is idempotent, preserves original changed values and source timestamps, and resumes remaining rows on the next startup after a failure. The dashboard exposes the number awaiting classification. The historical API response cannot be reconstructed: legacy records are explicitly labelled as reconstructed from saved fields.

Classification scans recognizable platform names and explicit country claims. Website traffic takes precedence over social referrer lists. Ambiguous fields require review. Classification notes describe the initial source; the approval blockers reflect the current edited record.

Deploy after the MySQL quality job passes. Wait for the `[Catalogue] Legacy normalization completed` log and verify the pending count, sample country/platform separation, RTL/LTR, filters, review detail and public visibility. Do not approve/publish a real batch without its missing evidence. A rollback should keep the additive schema and return services to draft first if reverting to older code that lacks the review boundary.

## Bounds and alerts

- Import: durable background jobs, 100-row transactions, a 50,000-row / 16 MiB response safety limit and a 30-second upstream timeout. Invalid values are quarantined without inventing replacements. See [background synchronization](background-catalogue-sync.md) for checkpoints, recovery, source issues and explicit failure semantics.
- A provider lock serializes imports, while an indexed, bounded metadata lookup replaces one SELECT per service. Raw source JSON stays in the database during this lookup. New records and audit/price inserts use small batches. Only initial/changed prices add snapshots. Changed service updates remain individual inside the transaction; large updates can occupy a connection and need a separate import worker at higher scale.
- Legacy normalization: 100 rows per transaction. No API key is required for classifying already-stored records.
- Review: 50 unique IDs maximum, server revisions, stable lock order. No operation selects all matching pages invisibly.
- Dashboard: SQL aggregates. Incomplete/pending/stale categories overlap. Stale means the most recent source or explicit price check is older than 30 days or absent. Price-change cards cover the last seven days; missing-source cards cover currently unavailable records.
- Connection alerts show up to 50 affected connections, including quarantined records from the last completed import, failures or schedules overdue by more than one hour. Source reports open on demand; see [background synchronization](background-catalogue-sync.md). These are in-app alerts, not external notifications. The existing scheduled workflow must remain configured for ongoing synchronization. No configured connection is not evidence of a healthy provider API.
- The MySQL acceptance fixture exercises 50,000 stored services and bounded public/admin queries. It is not a guarantee of latency at arbitrary volume. SQL counts and substring search still scan eligible records; dedicated search and cached aggregates should follow measured bottlenecks.

## Validation

The existing quality workflow runs type checking, unit/API/RTL checks, real MySQL 8.4 migration and transactional acceptance tests, and production builds. Added cases cover country/platform separation, unknown refill duration, invalid/duplicate response handling, atomic review rollback, stale revision rejection, permission boundaries, unavailable/returned services and stable price history.

Review-worklist acceptance fixtures check all eight need counts against the matching rows and detailed review checks, including case-sensitive classification and missing dates. They verify combined filters, overlapping causes, 25-row paging without changing counts, readiness against actual approval/publication gates and a compact summary over the existing 50,000-service fixture. API checks reject unknown needs and unauthorized summary access.
