# First public-source offer batch

Eleven monthly service offers prepared from official pricing pages. The JSON files are input to the admin public-source import form. They are never seeded or published at application startup.

| Provider | Offers | Official evidence |
| --- | ---: | --- |
| $99 Social | 4 post packages | https://www.99dollarsocial.com/pricing |
| $99 Social | 3 video packages | https://www.99dollarsocial.com/short-form-video |
| LYFE Marketing | 3 management plans | https://www.lyfemarketing.com/social-media-management-pricing/ |
| WebFX | 1 custom management starting fee | https://www.webfx.com/social-media/services/ |

Import each provider's file into a provider draft with its official website. Import preserves pending status and leaves pricing and eligibility unconfirmed. Review the amount, currency, monthly scope, added costs and source for each offer using the existing review form. Approval and publication remain separate audited actions; provider activation does not verify identity.

The records describe one monthly package each; quantity 1 is the comparison basis, not a claim about the provider's order capacity. No delivery start time, performance rating, refill promise or target country has been inferred. WebFX's amount is explicitly a starting fee. Packages remain excluded from automatic lowest-price recommendations because their scopes differ.

JAP's existing imported records are not changed by this batch. Its service-specific pricing basis and eligibility still require evidence. Public-source offers are excluded from provider API missing-service reconciliation.

Public DTOs expose only the source URL, checked date, bilingual name/scope/terms, monthly basis and price qualifier. Raw source payloads and API credentials stay private. Search includes the reviewed Arabic offer name; the existing server pagination continues to bound each response.
