# Compact offer results

## Reference lock

The user's target is the existing ProviderCatalogue table, on ordinary phone
screens. Keep ProviderBeacon Daylight's white canvas, navy text, blue actions,
12px table enclosure and subtle row dividers; the same semantic tokens must also
work with the other themes. Reuse the provider table's compact type, two-line
service name and inline detail disclosure. No provider logos or separate mobile
cards in these results.

Refero research: Raise/OpenCollective style
`f72e18d0-98f4-4e88-9754-5426589564ea` supports restrained borders and white/navy
surfaces, complementing the previously locked Daylight palette. Its marketing
spacing does not replace the user's denser catalogue target. Fibery's Target
Customers screen `ca1ffc0a-4677-4009-a561-8cb9b9df27ce` informs expandable rows
and clear column hierarchy only, not its purple brand palette or sidebar.

| Decision                                                           | Source and role                         | Purpose                                                                      |
| ------------------------------------------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------- |
| One fixed-layout table, three essential columns on phones          | User + ProviderCatalogue                | Scan many services without wide cards or horizontal scrolling                |
| Expand the service name to reveal price evidence, limits and terms | ProviderCatalogue + Fibery              | Keep full information close without expanding every row                      |
| Pale green row, arrow and explicit lowest-price label              | User + existing semantic success tokens | Identify calculated savings without implying quality or endorsement          |
| Move equivalent group minima first within the current page         | Existing exact-decimal comparison rules | Preserve currencies, units, market, refill, quality and quantity eligibility |
| Keep explicit global price sorting unchanged                       | Existing sort control                   | Avoid silently overriding the user's selected order                          |
| Pagination above and below results, return focus to heading        | Existing provider pagination fix        | Keep the reader at the table after Next/Previous                             |

Best means lowest comparable price among equivalent offers on the current page.
Unknown pricing, unknown comparison terms, starting prices, packages and offers
outside the selected quantity are not assigned a lowest-price badge. Featured
placement alone is not a savings or quality signal. Source decimal amounts and
comparison selection persist; the server's bounded cursor pagination is retained.

Validation: targeted interaction/ranking tests, existing catalogue/pricing tests,
TypeScript, production build, MySQL CI and live browser review.
