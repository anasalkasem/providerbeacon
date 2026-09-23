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
4. Default wholesale browsing to USD, per 1,000, ascending price. Keep all currencies/units reachable. Preserve server ordering across pagination; do not promote page-local green minima above cheaper catalogue rows.
5. Use compact quantity controls and a separate link to clearly identified sponsored placements. Advertising does not affect cheapest-price order.
6. Provider cards use actual provider artwork/website previews when available, with a readable brand, centered service count and profile link. No invented reviews, logos, rankings or provider claims.
7. Put methodology near search, replace the duplicate navigation entry with featured advertising, and explain provider offers as announcements/coupons rather than the price comparison catalogue.

The audio alone does not establish which historical production rows have incorrect ownership. Do not relabel or migrate service data based on ambiguous spoken provider names.

## Additional live finding

Live Instagram/follower results included services explicitly titled "Instagram Random Comments" because their descriptions mentioned the follower counts of the accounts supplying those comments (provider source IDs 2090 and 2091). The normalizer previously chose service types in a fixed priority order, letting a later "followers" term override "comments" in the title.

Classification now chooses the first service type in the title and uses the provider category as a fallback. A bounded, audited startup repair corrects only this demonstrated comment/follower collision in unreviewed API records with a matching retained source title. It skips human review/edit markers and changes only category and revision, preserving provider ownership, source rates, units, timestamps, and publication state. No schema migration is needed.
