# Provider discovery homepage

## Approved target

The user approved a compact homepage with a moving provider-logo strip, a request-based comparison entry point with optional provider selection, and up to 16 image-led provider albums linking to internal profiles. Build directly from their BookSMM gallery screenshots and the existing ProviderBeacon theme. Keep real records only; do not duplicate providers to fill the gallery.

## Reference lock

Primary: existing ProviderBeacon Studio canvas, typography, lighthouse identity and theme tokens. The user references supply the gallery structure. Refero OpenSea style `2465f692-3a79-4576-970c-ee56c1e72375` supplies compact, contained imagery and narrow metadata rows; Perplexity style `5c7acdfb-996b-4c6f-b361-264a3f580f7d` supplies one prominent request field and secondary scope controls. Its palette and sidebar are not adopted.

| Decision                                          | Evidence                                         | Role / reason                                                                            |
| ------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Four columns desktop, two on phones               | Approved user brief                              | Compact albums, readable metadata outside artwork                                        |
| Existing images, logos and honest fallback        | Published provider records                       | No copied provider advertisements or invented branding                                   |
| One search field, no initial offer list           | Approved user brief, Perplexity search hierarchy | Results follow the visitor's request                                                     |
| Continuously moving logos below the request panel | User correction, September 22                    | Repeat the logo sequence to cover wide screens; internal profile links and pause control |
| Text-only provider search choices                 | User correction, September 22                    | Avoid showing the same logos twice around the request field                              |
| Subtle dark card surfaces                         | Existing Studio, OpenSea contained cards         | Preserve identity without heavy promotional framing                                      |
| Optional exact provider scope                     | Approved search interaction                      | Server-enforced selection survives follow-ups and catalogue browsing                     |
| Paid artwork remains labelled                     | Existing VIP placement rules                     | Paid placement does not imply verified quality or change search ranking                  |

The home snapshot reads at most 16 public profiles and no service rows. Service counts are aggregate values. Catalogue eligibility rules remain in force. Existing paid artwork is used only while its placement is active, with the existing impression/click analytics. Missing artwork falls back to the provider's saved website preview or logo.

## Validation

- TypeScript and production client/server build pass locally.
- Full local suite: 584 passed; 245 MySQL acceptance cases deferred to the required GitHub MySQL job. An additional pagination regression verifies that changing/clearing provider selection starts at page one.
- Interaction coverage: 16 unique real albums, internal links, no initial offers/prices, four-provider limit, exact Arabic request encoding, scope surviving follow-ups and retry, scoped browse links, active ad labelling and broken-image fallback.
- Database acceptance covers the 16-profile home bound with no service rows, exact scope and independent cache keys, unpublished providers, and scoped cheapest-offer ranking.
- Phone CSS uses two album columns, 44px controls, native horizontal scrolling, full provider names outside the artwork and a compact assistant launcher. Physical-device visual QA is not available in this environment; browser viewport is desktop.

The final commit must pass GitHub quality checks before merging. Review the deployed homepage, provider links and scoped search after Railway reports success.
