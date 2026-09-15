# Buyer workspace

ProviderBeacon now starts with a buyer's request, then explains the current offers and lets the buyer keep track of their choices.

- `/find` uses the existing Beacon assistant to interpret quantity, platform, service type, country, budget, currency and minimum refill duration. It returns public catalogue records with their original provider terms. Refinements retain the current conversation; the conversation is not a saved comparison.
- For a cheapest-price or budget request with an SMM quantity, the server scans the entire eligible catalogue. It retains four exact lowest rates per currency and sale-unit bucket, then compares converted quantity totals using rational arithmetic. Missing exchange rates are disclosed. Price ranking does not establish service quality or equivalence.
- `/compare` explains missing and different terms before showing offer cards. The lowest-cost badge requires the same known service group, a valid quantity, confirmed pricing and comparable totals. The detailed table remains available below the cards. Paid placement does not affect this label.
- `/services` retains a compact desktop table, mobile cards, 25/50/100 rows, quantity filtering and the country/refill-duration filters carried from assistant search.
- `/account` is the buyer workspace. `/account/settings` retains the existing profile, Google-link and security settings. Signed-out visitors can browse normally and are prompted to sign in when saving.

## Persistence and ownership

Migration `0019_buyer_workspace.sql` adds member-owned watches and comparisons plus a nullable comparison fingerprint on price observations. Existing observations are not retroactively treated as verified history.

An account can keep 20 watched services and 20 comparisons. Repeated saves are idempotent; saving an existing service does not silently replace its baseline or quantity. Remove and follow it again to start a new baseline. A comparison stores 2–4 service IDs, quantity and display currency and reloads current public records when opened.

Writes use the existing member-session and account-lock checks, trusted origins and per-account limits. Read-query account IDs partition client caches and must match the authenticated session; they never select another account's data. Account deletion cascades to saved items. Hidden or removed services do not reappear through the workspace or its history endpoint. Public service IDs and computed prices are resolved by the server, not accepted from the client.

## Price changes and targets

Following a service records the currently observed original price and quantity. Subsequent source imports record real rate/basis changes. History includes only observations matching the current currency, sale unit, source/review mode and material service terms. Unknown or incompatible old observations are excluded. Dates are observation dates, not claimed dates of the provider's price change.

A currency, unit, refill, quantity-limit, service-identity or other material term change pauses discount and target comparisons. The workspace states why instead of showing a misleading drop. Sparse history is presented as sparse history; no earlier points are generated.

Price targets refer to the total for the saved quantity in the original confirmed currency. The workspace evaluates them on refresh. Verified members can separately opt in to a price-target email for each followed service. All existing and new watches default to email off; marketing consent and Google sign-in do not enable these alerts.

The background worker reads one due watch every two seconds across replicas, with a five-minute recheck delay per watch, independently of email delivery. Checks depend on provider sync cadence and backlog, not a promised instant notification. Missing/hidden offers, changed terms and prices over 24 hours old pause alerts. FX changes never trigger them. A target that is already reached may generate its one email after saving.

Migration `0020_price_email_alerts.sql` records per-watch consent time/version, target revision, due time and trigger time, and adds an outbox reference to the watch/revision. Account locks serialize changes, evaluation and deletion. There is one durable outbox key per target revision: repeated saves of a numerically equal target, repeated syncs and worker restarts do not generate another message. Changing the target or switching off then on starts a new alert; it cancels pending previous alerts. Target hits and actual mail delivery statuses are distinct in the interface.

Before dispatch, the sender rechecks account verification, suppression, watch ownership/consent/revision, public offer eligibility, terms, freshness and the target against uncached data. A price increase above the observed quote cancels a pending alert. Further decreases remain eligible: the message explicitly dates its observed cost. Frozen messages expire within one hour (and never later than 24 hours after the source observation). Uncertain delivery retries retain the existing provider idempotency key and payload. Cancelled or terminal alerts are not automatically rearmed; the workspace shows the outcome.

Each price email includes the provider/service, saved quantity, original currency, cost when saved, dated observed cost, target, comparison link and an independent one-click price unsubscribe link. The latter disables all price-email watches for that account without changing marketing consent or account emails. GET never unsubscribes; POST requires the signed address-bound token. Per-service disable remains available even when the offer is hidden or its terms change. Already dispatched messages cannot be recalled. No SMS or WhatsApp messages are sent.

## Verification

Run `pnpm check`, `pnpm test` and `pnpm build`. The required GitHub quality workflow additionally provides an isolated MySQL 8.4 database. Acceptance cases cover concurrent saves, account/origin/cache boundaries, cascades, a real sync price change, incompatible history, exact targets, catalogue-wide currency/unit ranking and minimum refill duration.
