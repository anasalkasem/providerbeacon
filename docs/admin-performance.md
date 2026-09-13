# Admin RTL and catalogue performance

The production Services screen previously downloaded and mounted the complete catalogue, with an input and a Radix select per row. Overview also fetched every service just to calculate a count. In Arabic, the document changed direction but the fixed sidebar stayed on the left, covering content.

## Request and rendering budgets

| View | Request budget | Navigation |
| --- | --- | --- |
| Admin overview | SQL aggregates and five recent audit entries | Permission-filtered aggregates |
| Admin services | 25 rows by default; maximum 100 | ID cursor, search, platform and status filters in SQL |
| Public home | Eight offers with associated provider profiles | Links to catalogue |
| Public services / provider profile | 25 offers by default; maximum 50 | Rank + ID cursor with deterministic tie-breaking |
| Public provider directory | 25 profiles by default; maximum 50 | ID cursor and search |
| Comparison | Up to four explicitly selected service IDs | No catalogue-wide download |
| Advisory provider analysis | One provider and 25 sampled services | Reports full count and sample limitation |

The admin page never requests the public catalogue. Service rows contain only fields used by the table, including a joined provider name; they no longer trigger a second download of all provider profiles. One explicit edit dialog replaces the per-row controls and saves only after submission. Client search is debounced and page cache entries expire after two minutes of inactivity.

The shared dashboard positions the sidebar according to locale, supports RTL resizing, and provides an in-place language picker. Manual language changes update the URL as well as the saved preference, preserving the route and other query parameters. Mobile navigation closes after selecting a module.

## Database and publication

Migration `0003_catalogue_pagination_indexes.sql` adds indexes for provider/ID, status/ID, platform/ID, featured ordering and price ordering. It does not delete or transform catalogue records. Existing startup migrations apply it when `RUN_DATABASE_MIGRATIONS=true`.

Public queries retain the active-service/active-provider boundary and exclude production demo profiles. The overview distinguishes stored services from services actually published by an active provider. Provider service counts are SQL aggregates across all services, not the current page length. The new overview and service list retain server-side role checks.

Bounded payloads and bounded DOM size remove the catalogue-size-dependent browser freeze. They do not guarantee constant database latency at unlimited scale: substring search, exact counts, retention ordering and concurrent imports still need measurement as the dataset grows. Full-text indexing, precomputed aggregates and separate workers should be driven by query plans and observed latency. Other admin lists (team, integrations and provider management) retain their existing APIs in this patch.

## Acceptance

Run type checking, the production build and Vitest. The existing MySQL 8.4 CI service runs the guarded local test database suite, including a 50,000-service fixture that checks response size, pagination, filtering, explicit comparisons, accurate totals and withholding services belonging to unpublished providers. No fixtures are inserted into production.

After deployment, inspect `/admin` and `/admin/services` in both languages. Check sidebar/content separation, 25-row rendering, next/previous navigation, filters, edit/cancel, and language persistence after reload. Check `/services`, `/providers` and an explicit comparison for availability without loading the full catalogue. MFA, credentials and provider publication settings are outside this change.

Rollback uses the previous application commit. The additional indexes may remain; dropping them is unnecessary for application rollback.
