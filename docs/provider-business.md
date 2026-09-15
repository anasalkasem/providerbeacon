# Provider business package

Provider workspace: `/account/provider`. Staff management: `/admin/subscriptions`. Public offers: `/offers`, also shown on the associated provider profile.

This release provides one manually activated provider package: provider group listings and Telegram profile links, private provider analytics, and up to five new promotions per UTC calendar month. The approved price is **USD 19 per month for the first three months, then USD 29 per month from month four**. Prices apply per provider. The existing support address handles activation and renewal enquiries; automatic payment collection is not enabled. No new service, environment variable or credential is required.

## Price and introductory period

`shared/providerBusinessPricing.ts` is the single source for the `provider-monthly-v1` plan and its integer USD cents. The introduction lasts three consecutive calendar months from the provider's recorded first activation, not from registration or ownership review. Calendar anniversaries use UTC, preserve the original day/time, and clamp to the last day of shorter months. For example, an activation on January 31 at 12:45 changes to USD 29 on April 30 at 12:45 UTC. Each introductory month costs USD 19 (USD 57 across the first three months); USD 19 is not the total for a three-month package.

The first activation date is stored server-side when an administrator first saves an active/scheduled period. Renewing, suspending, clearing a period, revoking ownership or reactivating never resets that date. Subsequent active periods cannot begin before it. Staff cannot post a different currency, price or introductory date through the subscription API. Saving an inactive record alone does not start the offer. The workspace and staff API return current pricing and the standard-price start date; visible prices also update when an open page crosses that boundary. The price schedule does not extend an expired entitlement.

The public page discloses both prices before sign-in. The provider workspace and administration page show the recorded first activation and price-change date. On a new activation, the staff form previews that schedule from the selected start date. For an active period, its displayed monthly rate uses the selected period start, so a future month-four renewal quotes USD 29 even while today is still in the introductory window. All displayed prices are **monthly rates**, not invoices or confirmation of funds received. Staff must check custom period lengths and any price change before recording the actual payment reference. This release does not introduce proration, annual billing, a free trial, checkout or automatic debits.

## Ownership

A provider uses a normal member account with verified email; staff authentication remains separate. The member requests a challenge for a listed provider, publishes the exact code on the provider homepage or `/providerbeacon-verification.txt` (the equivalent `/.well-known/` path is also accepted), and submits that first-party URL. Public comments and arbitrary user profile pages are not accepted as proof. The challenge expires in seven days.

An owner or administrator opens the proof page, confirms the exact code and current provider domain, and records a review note. A redirect to another domain is not proof. The server checks the saved host, proof path, expiry, verified member status and record revision before accepting that review. There is no automated claim of ownership from an email address, Telegram name, API credential or arbitrary website link. Each provider can have one approved owner; concurrent approvals serialize on the provider record. Each member can manage at most ten ownership requests/providers.

Changes to the provider website domain invalidate owner access until reviewed again. Revoking ownership from the staff page also suspends the package. Account deletion removes the ownership link and claims. These operations never assign staff permissions or modify public verification, Beacon Score, provider quality metrics, API imports or comparison prices.

## Activation and access

The subscription has a status, UTC start and end timestamps, and an optimistic revision. Staff record the activation/payment reference or reason. Only owners and administrators receive `business.read` and `business.manage`; other staff cannot see or alter these records. Writes require the canonical Origin and create transactional audit entries. Member writes use existing shared MySQL rate limits.

A plan is effective only when its status is `active` and `startsAt <= now < endsAt`. Queries check the current period; no scheduler is required for expiry. Provider tools additionally require the current signed-in member to own the provider, have verified email, hold a current session, and match the verified provider domain. Private report requests include an account ID for client cache partitioning, but the session determines ownership. Supplying another provider/account ID grants no access.

Public group and promotion queries use a live database entitlement predicate. Public catalogue responses apply current Telegram visibility after the catalogue cache, on every request, so expiry and suspension work across server instances. These responses use `Cache-Control: no-store`. Clients refresh live offers and plan state, and hide locally expired records. Users can retain links they have already seen; this feature controls listing exposure on ProviderBeacon, not membership in third-party groups.

Independent community groups remain free. Every provider group must have the provider association reviewed by staff. Once associated, a member cannot unlink it to bypass the paid rule. A persistent `requires_subscription` flag prevents deleting a provider from turning its old commercial group into a free listing. Suspended/deleted providers' commercial groups are hidden. Group approval remains separate from payment; approved listings return after renewal while stored pending or hidden entries do not auto-publish. Existing rows are preserved.

## Analytics and promotions

The provider can view only its own 7/30/90-day profile visits, website clicks and Telegram clicks, daily data, and totals for the immediately previous period. Missing prior measurement is labelled. Counts describe measured actions, not unique people, confirmed arrivals, sales or billable leads. Existing collection remains independent of whether the provider can view the paid report; Telegram actions only count while its public link is eligible.

Offers require an active package to create/edit and include title, plain-text terms, optional coupon, first-party destination and UTC dates. The offer destination must be a permanent HTTPS URL on the provider's exact domain (with `www` equivalence), without query parameters or fragments. The maximum duration is 90 days. Provider row locks serialize the five-per-calendar-month creation quota across concurrent requests. Editing preserves the original creation date and resets the item to pending review.

Staff must review the destination and terms before approving the current revision. Only approved offers within their own date range, attached to an eligible provider with an active subscription, appear publicly. A domain change invalidates old offer destinations. Owners can still see and withdraw saved content after subscription expiry. Public responses exclude member identities, review notes, ownership codes and subscription references. Offer links are marked sponsored, and offers never affect the comparison catalogue's rates or ranking.

## Deployment and checks

Migration `0027_provider_business` adds three tables, a commercial-group flag and a provider/group index. Existing providers default to no active package. Consequently, existing provider Telegram profile links and provider-associated groups become hidden until an administrator activates the provider package. No existing listing, ownership or payment is fabricated.

Migration `0028_provider_plan_pricing` adds the first-activation timestamp and backfills an existing valid saved period from its known start date. It does not activate a provider, extend a period or create a payment. Pre-pricing records have no separately recorded first-activation history; their saved start is the migration baseline.

Run `pnpm check`, `pnpm test`, `pnpm build`. The existing MySQL 8.4 CI gate includes the new acceptance cases and refuses a non-local/non-test database. Cases cover proof ownership and expiry, concurrent competing claims, revocation, staff/member/session/Origin isolation, paid group and cached contact visibility, renewal without data loss, scoped analytics, offer scheduling and moderation, record revisions, concurrent quota enforcement and independence of quality scores.

After deployment, check the public workspace entry, offers page and existing provider catalogue in Arabic and English. Ownership approval and subscription activation require genuine evidence and an operator's recorded reason; do not create test owners, fictitious payments or synthetic analytics in production.
