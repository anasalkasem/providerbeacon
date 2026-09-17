# Service screening and visitor ratings

Automatic screening supplements the existing publication rules. It never sets
`reviewStatus`, `pricingConfirmed`, `policyReviewed` or provider verification.
Pending API catalogue imports are not inherently invalid. Both reviewed listings
and opted-in API source listings exclude `screening_status = held`; all search,
comparison, assistant and service-count queries inherit this gate.

The production worker uses the existing `assistantJson` integration. It screens
at most eight services per request, with one durable MySQL lease shared across
replicas. A 2,400-request UTC daily ceiling is configurable with
`BEACON_SCREENING_DAILY_REQUESTS` (1–4,000). `BEACON_SERVICE_SCREENING_ENABLED=false`
stops worker startup. Staff with `services.review` can pause/resume processing in
the catalogue review panel; all existing holds remain in force while paused.

New rows and changed revisions are queued. Original source payloads and manual
review attestations are retained. Model input contains only the bounded service
name, category and description; no raw JSON, credentials or member information.
Deterministic checks handle invalid values and known missing sources. Model
decisions must contain every requested ID exactly once and issue evidence must
be an exact substring of supplied content. High-confidence issues cause reversible
holds; low-confidence issues request human review. A model's confidence is not
proof of real service quality or availability. Successful screening means only
that no content problem was detected.

Transactions never hold locks during a model call. Results require the current
lease and unchanged service revision; stale results are discarded. Provider locks
precede service locks. A failed/malformed model response schedules bounded
exponential retries and leaves the current visibility unchanged. A low-confidence
recheck cannot lift an existing hold. Explicit human holds survive other revisions
until deliberately retried or released. Releases require a recorded reason and
cannot bypass invalid source values or ordinary publication requirements.

Staff can see counts, pending/held/review filters, the last check, source evidence
and errors, and can request a recheck, hold or release individual services. Holds,
releases and review decisions have audit entries. In-process catalogue caches are
invalidated after changes; other replicas expire their snapshots within 10 seconds.

Visitor ratings are 1–5 stars, one row per verified member and provider. Visitors
can edit/remove their vote; active session, account identity, origin and revision
are checked on writes. Writes share a durable 20-per-hour member limit. Provider
owners cannot vote on their own provider. Aggregation excludes suspended,
unverified and current owner accounts and never uses legacy manually supplied
rating totals. Deleting a member removes their votes by foreign-key cascade.
Public APIs expose only the average/count; private APIs return only the current
member's vote. The UI states that visitor ratings are not verified purchases or
provider certification. No seeded votes, comments or automatic reviews are added.

Migration: `0033_service_screening_and_ratings.sql` adds screening fields, worker
control and the ratings table. Existing services enter the queue without being
blanket-hidden; existing review and source-availability rules remain enforced.
