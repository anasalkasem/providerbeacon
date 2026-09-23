# Advertising consolidation — 23 September 2026

The public navigation previously linked to a provider directory, a VIP provider
album renamed “Featured ads”, and a separate offers page. The user's screenshots
show the same providers repeated without a distinct advertisement hierarchy.

## Reference lock and decisions

| Decision                                                | Evidence                                                                        | Adaptation                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| One provider directory and one advertising destination  | User's ProviderBeacon screenshots                                               | `/ads` is the canonical ads/offers route; legacy links remain functional.                        |
| Image and advertisement title lead each listing         | User's BookSMM reference; Eventbrite style 4aa419e7-b05e-48f7-9dd8-4f65d5fc153f | Independent promotion content, with provider identity as secondary metadata.                     |
| Compact grid, restrained borders, no decorative effects | Jp style 0bad6a8b-e35e-40e1-91b6-af8e41ba7967                                   | Three columns on desktop, one on narrow screens; preserve existing theme tokens and Arabic font. |
| Explicit image upload and title in the editor           | Patreon screen 7cc8d7ac-2aff-44c3-be66-e2081d5ea6b0                             | Image preview, title, category, dates and destination in one form.                               |
| Visible owner entry                                     | User could not find advertising controls                                        | `/admin/ads` groups independent ads, VIP placement review and platform grants.                   |

Keep existing background/card/foreground/border/primary tokens. Blue marks actions,
not provider quality. Use uploaded raster artwork without cropping its text. Do not
invent banners, prices or promotional claims. VIP placements remain separate from
organic catalogue rankings and are not another provider-directory destination.

Scope: navigation consolidation, independent promotion artwork and categorization,
owner editing/review, public search/filtering and explicit catalogue placement.
No new payment or advertising-price model is introduced.
