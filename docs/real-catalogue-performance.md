# Real catalogue and bounded reads

The owner requested immediate removal of fictional providers and dependable catalogue performance before visitor AI search.

## Data cleanup

Migration 0009 removes the eight original fixture identities only when they have no official website, provider integration or API/public-web sourced offer. Each removal records its slug, name and removed service count in the audit log. Foreign keys cascade the associated offers and price snapshots; polymorphic translations are explicitly removed. Repeat execution is harmless. Actual agency offers, the three sourced SMM providers and the JustAnotherPanel API catalogue are preserved. An incomplete real API import is not a demo and is not automatically approved.

Runtime fixture arrays, fallback lookup helpers, the old seeded-provider component, seed script and seed mutation have been removed. `MARKETPLACE_DEMO_MODE` no longer activates anything. A small isolated regression fixture remains only under server tests. Unknown success metrics display an em dash, and Beacon Scores remain unavailable until supported by a scoring pipeline.

## Request budgets

- Public service pages: 25 rows by default, at most 50; home eight; comparison four explicit IDs.
- Admin services: 25 by default, at most 100. Provider administration now also pages by ID, with at most 50 rows.
- Provider pickers search on the server, return at most 50 choices and retain the selected ID. They no longer download the complete provider table.
- Listing SQL selects display fields only. Retained provider API payloads and original source JSON are not selected for public listing pages. Public-source metadata is projected by field, type and size.
- Public snapshots and expensive review/overview aggregates share identical concurrent reads and use a 10-second process cache. Cache entries are bounded in count and at 128 KB each; database failures and oversized results are not retained. Permission-filtered overview keys cannot cross roles.
- Successful authorized mutations invalidate caches after completion. Background import/reconciliation steps invalidate after writes. Across application replicas, expiry bounds remaining staleness to ten seconds. No distributed invalidation is claimed.
- The application database pool has 12 connections, at most 96 waiting operations, a ten-second connection timeout, and bounded idle connections. Migration connections close after use.
- Preview runtime, JSX location tagging and debug collection run only in the Vite development server. Production HTML has a 16 KB CI size budget.
- Migration 0010 adds indexes for public eligibility, category/price queries and provider status/ID.

## Validation

The required MySQL 8.4 CI suite uses a disposable localhost `providerbeacon_test` database. The scale gate exercises 100,000 services, 1,000 additional providers and 100 simultaneous identical catalogue readers. It checks correct totals, cursor navigation, scoped search, preserved unknown metadata, bounded response sizes and immediate invalidation on provider withdrawal. Timing output appears as `CATALOGUE_SCALE_RESULT` in CI logs. Budgets: 2.5 seconds for a cold catalogue/admin read and a coalesced cold burst; 0.5 seconds for 100 warm reads. These are regression ceilings in the test environment, not a production traffic SLA or a claim that 100 distinct searches are cached.

Cleanup tests preserve official-source and connected records even if their slugs match a legacy identity. Existing tests retain permissions, audit rollback, staged API imports and publication gates.

## Deployment and rollback

Deploy application, frontend and migrations together. After deployment, confirm the provider count, the cleanup audit entries, sourced public prices, both Arabic and English navigation, search and comparison. No sample load data is inserted into production. Rolling back application code does not recreate deleted demos; no cleanup rollback is needed. The additive indexes can remain. Visitor AI search and provider credentials not already configured remain separate work.
