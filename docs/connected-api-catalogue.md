# Connected API catalogue

The owner requested that the public site use their existing JustAnotherPanel API connection, not the manually researched provider listings. Migration 0011 removes the six named, unconnected manual listings and their offers, retaining deletion audit entries. A listing is protected if it has any integration or API-sourced service. It enables the existing JustAnotherPanel source catalogue only after a successful, active authenticated integration; suspended providers stay suspended. No keys or account settings are changed.

`apiCataloguePublished` is an explicit provider-level opt-in. An enabled connection, a successful sync and an active provider are required for public visibility. Disabling the connection or suspending the provider hides its catalogue. Normal reviewed publication still follows the existing review gates.

Source-catalogue rows are clearly labeled `api_source`. They preserve the original API rate and provider-local service ID, without claiming review completion, quality verification, currency, or sale units. Pending imported rows can be browsed; rejected, unavailable, paused, archived and structurally invalid records remain hidden. Existing manual review decisions are preserved. Unknown pricing bases cannot enter price ranking or quantity-cost calculations. The official API documentation at https://justanotherpanel.com/api documents the service rate and account currency separately; its example USD balance does not establish the currency or sale unit of every imported service.

The listing reads stored sync results, never calls providers during visitor requests, and retains bounded pages, result caching and server-side filters. No source payload or encrypted credential enters a public response. Future syncs update the displayed source catalogue using the existing background jobs.

Validation covers API opt-in, disabled connections, unchanged review states, original rate precision, blocked rows, migration guards and duplicate-run audit behavior, in addition to the existing 100,000-service acceptance benchmark.

## Publish a newly connected provider

Creating a provider and syncing its API does not enable public source-catalogue visibility. In **Admin → Providers → Website visibility**, use **Publish provider and API catalogue** after a successful sync. The same control can withdraw the source catalogue. It requires both provider-review and service-publication permissions and records the actor, IP and before/after values. It publishes the provider profile together with its eligible API source rows. It leaves pricing evidence, quality approval, quarantines, withdrawals and verification unchanged. Suspended providers cannot be reactivated by this control. A missing/disabled/unsynced connection or a catalogue containing no eligible source rows blocks publication.

Migration 0014 performs the owner's requested initial publication only for the existing `paksmmportal` connection at `https://paksmmportal.com/api/v2`, once a successful active connection and an eligible source record exist. It does not set a currency or sale unit for that new provider. Future providers use the visible admin control without a provider-specific code change.

The admin table reads connection and eligible-service readiness from the same predicates as publication, with bounded 25-row pages. It explains a missing sync, an empty/blocked catalogue or a suspended profile. It refreshes every 30 seconds; connection changes and observed sync completion also invalidate provider lists. Successful publication invalidates server catalogue caches through the permission middleware and refreshes the browser's public queries.

MySQL acceptance cases reproduce a synced draft missing from the SMM directory, publish it through the authenticated API, and verify its profile, offers, homepage and cached directory together. They also cover withdrawal, idempotence, missing/disabled/unsynced connections, blocked records, suspension, audit rollback and the narrowly scoped initial repair. Service evidence, pricing and review states are compared before and after publication.
