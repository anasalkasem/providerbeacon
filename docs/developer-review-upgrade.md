# Developer audio review — 23 September 2026

## Reference lock

ProviderBeacon's existing sky blue, navy, lighthouse, Arabic typography and light/dark themes remain the primary design system. This is a focused catalogue and provider-connection improvement, not a redesign of unrelated products.

Secondary references researched in Refero:

- Dock (`a30dfeb9-9330-4e29-9477-76476481ef09`, https://dock.us): quiet borders, restrained blue actions and readable work surfaces. Do not import its font or marketing decoration.
- shadcn/ui (`c14c0a94-1037-449e-bf5b-4cb972656ac7`, https://ui.shadcn.com): compact table controls, consistent spacing and semantic status colors.
- DJI comparison (`713b66c0-3567-4982-aa54-6cb09d42d356`, https://www.dji.com/products/comparison-consumer-drones): keep identity, price and comparable attributes together in a comparison table.
- Lovable Git Integrations Management (Refero flow 12354, https://refero.design/flows/12354): separate existing identity selection from new identity creation, then visibly confirm the selected connection. Borrow the workflow, not its purple palette.

## Decisions before implementation

1. Existing provider identities must never be overwritten by creating a draft with a colliding name. Existing API connections cannot be reassigned to another provider, and credentials cannot silently move to another API host.
2. New-provider creation is a visible first step. The resulting provider is selected automatically and its website is shown before saving the API connection.
3. Compare up to four selected services inside the explorer, preserving selection across catalogue pages and filters. Keep shared comparison URLs and advanced quote tools working.
4. Wholesale browsing defaults to USD, per 1,000, ascending price. The explorer uses a fixed per-1,000 basis for SMM and a package basis for agency packages, with no sale-unit selector. Currency selection remains available; mixed currencies are not price-ranked. Preserve server ordering across pagination; do not promote page-local green minima above cheaper catalogue rows. Provider profiles retain their source-specific sale units.
5. Remove the quantity calculator, its matching-only checkbox, and the sale-unit dropdown from the explorer, following the user's explicit corrections on 23–24 September. Do not shrink or relocate these controls within that page. Inline comparison uses published rates without an assumed quantity. A dedicated follow-price/comparison page retains explicit quote tools. Advertising does not affect cheapest-price order.
6. Provider cards use actual provider artwork/website previews when available, in their original colors without a blue overlay. Keep the brand readable below the image, show the service count beneath it, and retain a neutral logo/initials fallback when artwork is absent or fails. No invented reviews, logos, rankings or provider claims.
7. Put methodology near search. `/ads` is the single advertising/offers destination; `/vip` and `/offers` redirect there. Owner controls live at `/admin/ads`. Empty ad placements mean no approved current content, not a completed advertising campaign.

## Full follow-up audit — 24 September 2026

The request is checked against the original timestamped developer report and the user's subsequent screenshots. The removal of the comparison quantity input alone was incomplete: the sale-unit dropdown remained. Removing the blue tint had also removed provider artwork. Both omissions are corrected together in this follow-up.

The audit confirmed inline comparison and persistent selections, ascending server-side price sorting, methodology beside discovery in navigation, one advertising destination, owner artwork/title/date/placement controls, the independent new-provider form, and separated OldSMM attribution. The source protections and new-provider import/publication journey are covered by the MySQL acceptance suites. No real provider, credential, publication state or campaign is created merely to exercise those flows.

Remaining operational prerequisites are real approved advertisement content, a review decision on the unpublished OldSMM draft, and visual verification on a physical Android device. None is represented as completed by a desktop screenshot or an automated test.

The audio alone does not establish which historical production rows have incorrect ownership. Do not relabel or migrate service data based on ambiguous spoken provider names.

## Source attribution follow-up

Before implementing the audit interface, retain the existing palette, typography and status tokens. Additional Refero references: Sana integration management (`20c9ef56-f757-4c49-ac77-c08bfad61de6`) keeps connection identity beside its state; Make incomplete executions (`54f3e9d6-cf38-482b-89b2-45520f8432d6`) places a persistent warning above supporting records. Borrow those relationships, with stacked rows on phones, wrapping host names, and isolated left-to-right domain text in Arabic.

Show the provider website, configured API hosts, retained service-source hosts and sample internal service IDs in a staff-only report. A domain match is an attribution clue, never proof of ownership. Unknown or different domains require review; no historical service is reassigned automatically. Require explicit acknowledgement for a new API host outside the provider website, and block a different API host from overwriting a retained catalogue even when external service IDs overlap. Apply this check at connection save, enqueue, worker preparation and both valid and quarantined batch updates.

## Additional live finding

Live Instagram/follower results included services explicitly titled "Instagram Random Comments" because their descriptions mentioned the follower counts of the accounts supplying those comments (provider source IDs 2090 and 2091). The normalizer previously chose service types in a fixed priority order, letting a later "followers" term override "comments" in the title.

Classification now chooses the first service type in the title and uses the provider category as a fallback. A bounded, audited startup repair corrects only this demonstrated comment/follower collision in unreviewed API records with a matching retained source title. It skips human review/edit markers and changes only category and revision, preserving provider ownership, source rates, units, timestamps, and publication state. No schema migration is needed.

## Confirmed historical attribution incident

After PR #105 deployed, the authenticated staff report showed 5,845 JustAnotherPanel-source records and exactly 26 `https://oldsmm.com/api/v2` records under the JustAnotherPanel profile. The OldSMM connection was disabled, with a completed 39-row import. Only records still carrying the exact OldSMM source are eligible for repair; all other service records remain unchanged.

An incident-specific startup transaction separates only those 26 retained, unreviewed OldSMM rows and their disabled connection into an unpublished OldSMM draft. It requires the exact source/provider identities, a completed source job, the observed count, no active sync, no human review markers and an empty draft destination. Any changed condition skips the repair for review. It preserves service IDs, source payloads, prices, timestamps, price snapshots and encrypted credentials, increments service revisions and writes an audit record. Repeated execution does nothing. The general prohibition on reassigning connections remains in place; there is no new reassignment endpoint. No provider verification or publication is granted.
