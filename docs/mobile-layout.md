# Phone layout — September 2026

## Provider catalogue follow-up — 22 September

User feedback: individual service cards are too tall for providers with large
catalogues; Next changes the document height and strands readers near the footer.
The original page dropped the provider and every service while fetching a new
cursor, replacing the entire profile with a loading screen.

Build target remains the existing Studio product, with its black canvas, light
type and semantic theme tokens. This is a direct production edit, not a new brand.

| Decision | Reference / constraint | Role and implementation |
| --- | --- | --- |
| One compact semantic table | User request; shadcn UI style `c14c0a94-1037-449e-bf5b-4cb972656ac7` | Restrained separators, compact typography, no repeated card shells or decorative assets |
| Service and price columns on phones | Revolut stats screen `53e003d5-7314-46c6-9ded-565c06a0fb2d` | Aligned labels/values; preserve full original price and unit, including unknown-unit text |
| Search, page size and navigation | Polar table `3976b1ae-f46c-4a4c-8f55-ce3a78cedc28` | Server-side search across the provider catalogue, 25/50 rows, controls above and below |
| Details open under the selected row | User's density requirement | Two-line name preview; full name, limits, terms and source remain one tap away; one open row |
| Stable pagination | Reproduced live loading collapse | Retain data only for the same provider; return focus and scroll to catalogue heading before/after navigation, including cached Previous and short last pages |
| Smaller phone assistant control | User screenshot shows it covering service content | 48px icon control within provider pages, preserving its accessible name and unread indicator |

No pricing normalization, inferred classification, fabricated data or new public
catalogue records. Unknown platform chips are omitted. Order limits stay in a
desktop column and in the expanded phone details. Existing exact rates and source
links are preserved. Search resets the cursor; page size applies at the API, not
to a client-only slice. A failed page shows retry inside the retained profile;
normal background refreshes never move the user's reading position.

Regression tests use real React Query observers and deferred requests to cover
slow Next, cached Previous, a short final page, background refresh, Arabic row
expansion, unknown-unit precision, empty search, page size, request failure/retry,
and provider-route isolation. TypeScript, production client/server builds, and
576 local tests passed (243 MySQL tests run in the GitHub quality workflow).
Live checks and phone evidence are recorded after deployment; do not describe
desktop screenshots as phone QA.

Target: the existing ProviderBeacon Studio interface, retaining its lighthouse,
black canvas, white outlines and azure accent. Desktop remains a comparison
workspace; phones below 768px prioritize prices, provider identity and navigation.

Reference lock: Linear Changelog (compact 8/16/24px rhythm), shadcn UI (disclosure
hierarchy), Google Flights iOS (compact results and filters) and Google Maps hotel
prices (provider/price rows). These are bounded layout references, not replacement
brands or sources of catalogue data.

- Home prices become three stacked offers, with full names, refill and order limits
  behind an accessible disclosure. Price currencies, units and missing-data notices
  stay visible. No cross-unit cheapest claim is introduced.
- Catalogue search stays visible. Filters/calculator open on demand; selected
  filters are counted and remain active when collapsed. Offer conditions are
  expandable. Comparison details stack by field/provider on phones without a
  wide table; desktop keeps its table.
- Four section shortcuts expose services, providers, promotions and VIP. Bottom
  navigation remains present; compare trays sit above it.
- VIP uses compact cards and starts paused on phones. Original provider artwork,
  paid-placement labels, analytics, links and manual carousel controls remain.
- Phone typography: 14–16px body, 22–28px titles, 12px secondary information;
  12–16px card padding, 24px section gaps, minimum 44px primary touch controls.
- Repeated Home/brand taps scroll to the top. Route navigation resets scroll for
  every theme, while history navigation and hash anchors keep their behavior.

Check phone widths 320, 360, 390 and 414px, RTL and LTR, long provider names and
prices, expanded conditions, four selected offers, desktop at 1280px, and reduced
motion. Never create test catalogue data in production.

## Validation and release state

- TypeScript check passed (`tsc --noEmit`).
- Frontend production build and server bundle passed.
- Local suite: 571 passed; 243 MySQL integration tests skipped because no test
  database was configured locally. The existing GitHub quality workflow runs
  those tests with MySQL before release.
- Regression coverage includes repeated Home taps, reduced motion, modified
  links, non-animated route navigation, disclosure state retention and initial
  mobile carousel pause with explicit playback.
- The available cloud browser blocked local HTTP and local-file previews. Phone
  visual checks at the target widths and live verification remain outstanding;
  no phone screenshot or device QA is claimed.
- GitHub initially rejected writes with HTTP 403. After the account owner
  reviewed the app's repository permissions, creation of the branch tree
  succeeded. GitHub quality checks and deployment follow the local validation.
