# Phone layout — September 2026

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
