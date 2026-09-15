# Provider analytics

The staff dashboard at `/admin/analytics` reports public provider profile visits and clicks on that profile's **Website** and **Telegram** buttons. Access requires the existing `providers.read` permission, checked against active staff membership on every report request. A provider filter, 7/30/90-day UTC ranges, daily chart and accessible daily table, and paginated provider rankings are included. Providers are ordered by measured contact clicks, then visits, then ID. This analytics ordering does not alter public price comparisons or trust scores.

## Measurement

- A visible profile lasting one second produces a `view`; a contact-button activation also records the view, so a quick departure is eligible. Hidden pages, prerenders and `navigator.webdriver` browsers are skipped.
- Direct HTTPS links remain intact. Primary, keyboard and middle-button activations send a non-blocking, same-origin `fetch` with `keepalive`. There is no redirect service and no caller-supplied destination. Image enlargement, catalogue source links, group links and context-menu navigation are outside this release's scope.
- A random first-party browser ID changes each UTC day. The server applies its own rolling 30-minute deduplication independently for each provider and event type within that day. Repeated requests do not move the last-counted time. Clearing storage, using another browser or the UTC day boundary can produce another counted action. Metrics are **not unique people, confirmed arrivals, purchases, commissions or billable verified leads**.
- Known bot user agents, preview/prefetch requests and requests carrying staff-session cookies are excluded. Do Not Track and Global Privacy Control are honoured. Browser privacy settings, blocked storage/network requests and unrecognised automation can affect coverage. No system guarantees perfect bot detection.
- `/api/provider-analytics` accepts a strict bounded POST body and a canonical application Origin. Requests are capped at 60/minute and 1,000/day per daily keyed IP digest across server replicas. Railway's trusted `X-Real-IP` policy matches existing account/assistant limits; other deployments use the socket address. Arbitrary `X-Forwarded-For` is ignored.
- Duplicate checks, rate reservations and daily increments run in a transaction. Concurrent duplicate events count once. Counters cannot be supplied by a client. Only currently visible providers and currently valid configured contact destinations count.

## Storage and operations

Migration `0025_provider_analytics` creates the collection start record, daily provider counters, expiring deduplication rows and rate buckets. There is no backfill. Earlier chart dates are marked unmeasured instead of zero. Suspending a provider stops new collection without erasing historical totals; deleting its database record cascades its analytics.

The existing server-only `AUTH_PEPPER` signs daily domain-separated visitor and rate-limit digests; no new external analytics subscription or environment variable is required. `PUBLIC_APP_URL` supplies the canonical origin. Missing configuration makes collection skip safely and the staff dashboard shows an unavailable notice. No analytics identifier, raw IP, email, user agent, referrer or credentials are returned by the report API. Raw browser IDs/IPs are never written to the analytics tables or event logs. Public privacy text explains measurement and retention.

An hourly cleanup worker, also run at startup, deletes expired digest rows and rate buckets in bounded batches. Their expiration is within two UTC days. Daily aggregates older than 400 days are removed independently. Cleanup errors are retried on the next run; temporary cleanup delays do not revive expired rate windows or associate identifiers across days.

## Verification

Unit and DOM tests cover event/origin validation, bot and staff filters, daily identifier rotation, privacy/storage failures, visibility/Strict Mode/navigation behaviour, dashboard filters, empty/error states, Arabic and permission gating. MySQL acceptance tests cover concurrent deduplication, rolling and UTC boundaries, independent providers/browsers/channels, real rate limits, transaction rollback, report aggregation/pagination/access, hidden providers and retention. Production smoke checks must not generate synthetic analytics events.
