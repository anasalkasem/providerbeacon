# Connected API catalogue

The owner requested that the public site use their existing JustAnotherPanel API connection, not the manually researched provider listings. Migration 0011 removes the six named, unconnected manual listings and their offers, retaining deletion audit entries. A listing is protected if it has any integration or API-sourced service. It enables the existing JustAnotherPanel source catalogue only after a successful, active authenticated integration; suspended providers stay suspended. No keys or account settings are changed.

`apiCataloguePublished` is an explicit provider-level opt-in. An enabled connection, a successful sync and an active provider are required for public visibility. Disabling the connection or suspending the provider hides its catalogue. Normal reviewed publication still follows the existing review gates.

Source-catalogue rows are clearly labeled `api_source`. They preserve the original API rate and provider-local service ID, without claiming review completion, quality verification, currency, or sale units. Pending imported rows can be browsed; rejected, unavailable, paused, archived and structurally invalid records remain hidden. Existing manual review decisions are preserved. Unknown pricing bases cannot enter price ranking or quantity-cost calculations. The official API documentation at https://justanotherpanel.com/api documents the service rate and account currency separately; its example USD balance does not establish the currency or sale unit of every imported service.

The listing reads stored sync results, never calls providers during visitor requests, and retains bounded pages, result caching and server-side filters. No source payload or encrypted credential enters a public response. Future syncs update the displayed source catalogue using the existing background jobs.

Validation covers API opt-in, disabled connections, unchanged review states, original rate precision, blocked rows, migration guards and duplicate-run audit behavior, in addition to the existing 100,000-service acceptance benchmark.
