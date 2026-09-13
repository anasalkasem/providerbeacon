# Catalogue integrity: first delivery

This change builds on Manus commit `b583387f70a675597ca75ee2ca2ae024c22b7387`.
Work is isolated on `codex/catalogue-integrity`; production remains on its existing branch until the changes are merged.

## Resulting behavior

- Production never falls back to invented providers, including when the database is not configured. Empty and unavailable catalogues have separate states.
- Preview fixtures require `MARKETPLACE_DEMO_MODE=true` outside production and are visibly labelled. The seed mutation is disabled in production; known demo profiles cannot be published.
- The existing active-provider filter is preserved. Client indexes also omit orphan and ambiguous offers. The service table uses the current provider record, not fixture lookups.
- Public IDs are now `provider-<database id>` and `service-<database id>`. Old comparison URLs show an unavailable-selection message; they are not silently mapped to unrelated offers.
- Publication does not grant verification. Unknown metrics are represented as unavailable. Database-backed Beacon Scores are withheld until there is an evidence-backed scoring pipeline.
- The homepage supports real services without a featured flag. Missing provider pages and incomplete comparisons have explicit states.
- Manual API tests preserve disabled schedules, including when a connection is disabled during the request. Concurrent scheduled workers must successfully claim the connection before running it.
- Imports create drafts. Changed active offers return to draft for review; unchanged active offers remain published, and paused/archived offers keep those states. There is no separate pending-revision store in this delivery: a changed active offer is temporarily removed until editorial approval.
- Provider status changes, service edits and catalogue imports commit with their audit entry in a database transaction. Manual status/price edits record before/after values. This does not claim that every other administration operation already has transactional auditing.

## Validation

`pnpm check`, `pnpm test`, and `pnpm build` cover types, unit/rendering tests and the production build.

`server/catalogue.mysql.test.ts` exercises the actual Drizzle/MySQL queries, foreign-key-induced audit failures and rollback, draft publication, changed prices, in-flight disable, and concurrent scheduler claims. It runs when `TEST_DATABASE_URL` points to a disposable `providerbeacon_test` database on `127.0.0.1` or `localhost`. It deletes test rows; never point it at shared or production data.

The Catalogue quality GitHub workflow starts MySQL 8.4 in an ephemeral service container and supplies that test URL. It needs no production secrets or provider credentials. External provider responses and DNS are stubbed in the acceptance tests.

## Integration notes

No schema migration is required. Keep the existing production database and vault keys. Deploy the frontend and backend together because the public ID and nullable-evidence contracts changed.

After deployment, check the empty catalogue, create a real provider draft, test its connection while disabled, review imported drafts, publish selected services and the provider, then explicitly enable its schedule if desired. Confirm the provider remains unverified until a separate evidence review is completed.

## Later roadmap work

Provider-owned accounts and documents, evidence-backed verification/scoring, full audit/session/reason coverage, MFA hardening, natural-language search, translation publication, SEO routes and provider-specific pending revisions remain separate milestones. Reconciliation of deleted upstream services also needs source ownership metadata before it can safely affect existing offers.
