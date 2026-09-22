# Provider discovery homepage

## Approved target

The user approved a compact homepage with a moving provider-logo strip, a service comparison bar with platform, service type and an optional keyword, and up to 16 image-led provider albums linking to internal profiles. Build directly from their BookSMM gallery screenshots and the existing ProviderBeacon theme. Keep real records only; do not duplicate providers to fill the gallery.

## Reference lock

Primary: existing ProviderBeacon Studio canvas, typography, lighthouse identity and theme tokens. The user references supply the gallery structure. Refero OpenSea style `2465f692-3a79-4576-970c-ee56c1e72375` supplies compact, contained imagery and narrow metadata rows; Perplexity style `5c7acdfb-996b-4c6f-b361-264a3f580f7d` supplies one prominent request field and secondary scope controls. Its palette and sidebar are not adopted.

| Decision                                          | Evidence                                            | Role / reason                                                                                                             |
| ------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Four columns desktop, two on phones               | Approved user brief                                 | Compact albums, readable metadata outside artwork                                                                         |
| Existing images, logos and honest fallback        | Published provider records                          | No copied provider advertisements or invented branding                                                                    |
| One search field, no initial offer list           | Approved user brief, Perplexity search hierarchy    | Results follow the visitor's request                                                                                      |
| Continuously moving logos below the request panel | User correction, September 22                       | Repeat the logo sequence to cover wide screens; internal profile links and pause control                                  |
| Platform and service-type selectors               | Latest user correction and BookSMM filter reference | Scale independently of provider count; no provider names or logos inside search                                           |
| Subtle dark card surfaces                         | Existing Studio, OpenSea contained cards            | Preserve identity without heavy promotional framing                                                                       |
| Service filters open the offer table              | Latest approved search interaction                  | Exact catalogue filters across all providers; detailed natural-language requests remain available through a separate link |
| Paid artwork remains labelled                     | Existing VIP placement rules                        | Paid placement does not imply verified quality or change search ranking                                                   |

The home snapshot reads at most 16 public profiles and no service rows. Service counts are aggregate values. Catalogue eligibility rules remain in force. Existing paid artwork is used only while its placement is active, with the existing impression/click analytics. Missing artwork falls back to the provider's saved website preview or logo.

## Validation

- TypeScript and production client build are checked locally; the complete client/server build and MySQL suite run in the required GitHub quality job before merging.
- Focused coverage includes the homepage interaction suite, continuous logo strip and catalogue rendering. Existing pagination coverage verifies that changing/clearing provider selection starts at page one.
- Interaction coverage: 16 unique real albums, internal links, no initial offers/prices, 50-provider search layout without provider choices, exact Arabic keyword encoding, filter-only submission, resetting filters, service choices surviving catalogue retry, existing scoped Find follow-ups, active ad labelling and broken-image fallback.
- Database acceptance covers the 16-profile home bound with no service rows, exact scope and independent cache keys, unpublished providers, and scoped cheapest-offer ranking.
- Phone CSS uses two album columns, 44px controls, native horizontal scrolling, full provider names outside the artwork and a compact assistant launcher. Physical-device visual QA is not available in this environment; browser viewport is desktop.

The final commit must pass GitHub quality checks before merging. Review the deployed homepage, provider links and service-filtered search after Railway reports success.

## Service comparison update — September 22

The homepage comparison form now submits platform/category filters and an optional keyword directly to `/services`, using the existing catalogue taxonomy and 100-character keyword limit. No provider IDs are submitted, so results are not restricted to the homepage's 16 albums or four providers. Native select controls stack into two columns on phones, with a full-width query and submit button. The moving logo strip remains below the form. The separate `/find` link retains detailed request search; existing scoped links elsewhere continue to work.
