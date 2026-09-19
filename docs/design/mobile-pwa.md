# ProviderBeacon mobile web app

Build target: the existing Orbit/Classic design system. Keep Orbit's black canvas,
white type, neutral dividers and violet action color from Dala/Langbase. No new theme.
Use the existing brand icons and silver lighthouse; no additional bitmap assets.

| Decision                         | Source / role                                                                                                             | Adaptation                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Five fixed, labeled destinations | Pinterest saved screen 218ec860-9cb6-4f46-a93b-5c08ae8b1a17 and Revolut home b099d9db-ea7f-4a45-bc87-91ff69456c4c, Refero | Home, Search, Compare, Saved, Account; current-page state and safe-area spacing. Borrow navigation structure only, not their colors. |
| Open directly on search          | User-approved mobile utility proposal                                                                                     | Manifest start URL /find?source=pwa, existing account/data/API.                                                                      |
| Install only on request          | MDN Making PWAs installable                                                                                               | Native prompt when exposed; platform-specific manual steps otherwise; no false installed state.                                      |
| Offline recovery                 | Existing live pricing accuracy requirements; MDN Using Service Workers                                                    | Cache only a small multilingual recovery page and its assets. Never cache API results, authenticated HTML or stale prices.           |
| Explicit updates                 | Preserve drafts and conversations                                                                                         | Notify when a worker is waiting; reload only the tab whose user chose update. Other tabs stay intact.                                |
| Mobile overlays                  | User's lightweight motion requirement                                                                                     | Reposition comparison dock and assistant above tabs, adapt chat to visual viewport/keyboard, keep controls touch-sized.              |

References:

- https://refero.design/screens/218ec860-9cb6-4f46-a93b-5c08ae8b1a17
- https://refero.design/screens/b099d9db-ea7f-4a45-bc87-91ff69456c4c
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

Install sequence: open install page → native prompt or browser instructions → OS
confirms installation → launch from home screen. Refero's installation-flow search
returned unrelated extension setups, so the platform sequence follows browser docs.

Scope: installable web app, mobile navigation, same live AI/search/saved comparisons,
existing price email alerts, offline recovery and update lifecycle. Opt-in push delivery
after closing the app is implemented; see [Phone notifications](../phone-notifications.md)
for delivery behavior and device verification. Native App Store/Google Play packages
remain separate future work.
