# Standard SMM pricing

As of 24 September 2026, ProviderBeacon uses a fixed rate per 1,000 for SMM quantity services. No visitor, provider or owner interface exposes a sale-unit selector, unit caption or unit-confirmation action. Missing legacy unit metadata does not block quantity calculations, price sorting or pricing completeness. Currency still comes from the provider's authenticated account or an explicit service-level currency; there is no default USD currency.

The importer assigns the standard internally. Explicit native per-item rates are retained in source storage and normalized exactly for public display, sorting, provider summaries, comparison and price history. `sourceRate` and retained API JSON preserve the original precision and evidence. Decimal-string arithmetic computes totals and MySQL decimal expressions drive cursor pagination. A legacy null basis uses the same interpretation immediately, without requiring a resync or data migration.

Explicit packages, subscriptions, monthly prices and one-off 1–1 offers keep their fixed amounts and scope. They are not multiplied into quantity quotes or included in lowest-SMM-price rankings. The interface describes the price and package contents without exposing technical pricing units.

Synchronization no longer fetches public HTML tables to establish the SMM basis. It reads the authenticated currency with the existing timeout, bounded-response and credential protections. Staged jobs remain compatible; imports rebuild normalized records from retained source data. An unchanged source preserves operator edits and approvals. Adopting the standard for missing legacy metadata or refreshing an evidence link records an audit entry and increments the revision without resetting editorial prices or review. Real source, account-currency or semantic changes still return services to review. Withdrawals, held records and disabled provider connections retain their existing guards.

Human price and currency review, source freshness, policy review, classification and publication permissions remain independent checks. Removing the unit requirement does not approve a service, publish a provider, invent currency or verify quality. The legacy source-pricing endpoint remains permission checked, revision checked and audited for compatibility, but has no user-interface entry point and is no longer a prerequisite for displaying or ranking prices.

Price sorting requires one supported currency and uses normalized rates before keyset pagination. No exchange conversion occurs in the native catalogue sort. The comparison tool can use dated exchange data for estimates. Lowest-price highlights still require comparable service type, platform, currency, market and refill terms. The assistant uses exact native rates for quantity math and receives no user-facing unit requirement.

Historical snapshots and the original source are preserved. History values are normalized only when presented; existing history identity and currency guards prevent combining unrelated services. The existing outlier ceiling and quarantine workflow remain unchanged.

Validation covers legacy null metadata, native-rate normalization, exact decimal totals, cross-page sorting, provider summaries, package exceptions, source changes, preservation of reviewed services, permissions, revision conflicts and multilingual interfaces.
