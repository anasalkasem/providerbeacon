# Daylight night mode

## Reference lock

The existing Daylight theme is the build target: preserve its blue actions,
responsive tables, compact mobile layout, fonts, provider artwork and spacing.
The visitor changes the color mode of Daylight, independently of the owner's
published theme. White remains the default when no preference has been saved.

Refero references inspected:

- Frame.io (`6a82f165-eb8e-4a87-a0dd-31593f08128b`): borrow the distinct bright
  primary / muted supporting text roles on dark surfaces. Its violet CTA,
  atmospheric gradients, typography and composition are outside this change.
- Linear Changelog (`11d3e58a-87d7-4a9a-bbf5-720f4fd3ffc6`): borrow tonal surface
  separation and restrained one-pixel borders instead of heavy shadows. Keep
  ProviderBeacon's existing blue actions and responsive density.
- Clay Appearance (`bc4ce44c-af5c-44fc-bfd1-7ca045be1a0a`): visitor-controlled
  appearance with immediate visual feedback. Adapt to a single sun/moon button
  in the existing header, accessible without opening a settings screen.

## Decision ledger

| Decision              | Source and role                               | Commitment                                                                      |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Structure and artwork | User's current Daylight theme                 | Same layout, tables, logos and blue actions                                     |
| Night surfaces        | Linear's layered dark surfaces                | Navy canvas `#0b1220`, card `#121d2e`, muted `#18263b`                          |
| Text hierarchy        | Frame.io primary / supporting text roles      | Light `#edf3ff`, supporting `#aebed4`; no dim prices                            |
| Actions and links     | Daylight brand / readable interactive states  | Blue `#0061fe` filled actions, light-blue `#9cc6ff` text links                  |
| Boundaries and focus  | Existing controls + Linear surface separation | Border `#30435d`, input `#687f9f`, focus `#85baff`                              |
| Best-price rows       | Existing comparison semantics                 | Green `#96e4b3` on `#132d23`, independent of blue selection                     |
| Mode control          | Clay appearance choice + mobile brief         | 44px sun/moon button beside the menu, localized action label                    |
| Preference            | Visitor choice, not owner configuration       | Store only explicit choice; survive reload/navigation; tolerate blocked storage |

No extra theme ID, admin activation, layout redesign or new image assets.
Preview mode changes stay in the tab and do not overwrite the saved visitor
preference. Other saved themes keep their own prescribed color mode.

## Validation

Check light/dark toggle, persistence across reload, appearance-query refresh,
owner-theme changes, preview exit, blocked storage and localized labels.
Review home, catalogue, expanded offer details and assistant on the live site;
check CSS contrast pairs and 44px minimum touch targets.

Local checks: 35 focused UI tests passed (13 new mode tests plus appearance,
glow and authentication controls). All 20 checked day/night text/surface pairs
exceed 4.5:1 contrast; the lowest is 5.07:1 for white labels on blue actions.
At phone widths, the install shortcut is available in the menu and footer,
leaving room for the full brand, the 44px mode control and the menu button.
