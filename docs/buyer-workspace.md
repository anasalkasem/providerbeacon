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

Price targets refer to the total for the saved quantity in the original confirmed currency. They are evaluated when the buyer loads or refreshes the workspace. This release displays target hits inside the workspace; it does not send price-target emails, SMS or WhatsApp messages. Provider sync cadence and missing source data affect freshness.

## Verification

Run `pnpm check`, `pnpm test` and `pnpm build`. The required GitHub quality workflow additionally provides an isolated MySQL 8.4 database. Acceptance cases cover concurrent saves, account/origin/cache boundaries, cascades, a real sync price change, incompatible history, exact targets, catalogue-wide currency/unit ranking and minimum refill duration.
