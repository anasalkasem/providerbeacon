# Beacon Orbit 3D — reference lock

## Refero refinement — September 17

Build target: existing Orbit, now informed by live Refero Pro research. Keep Dala's
black canvas, white regular typography, asymmetric hero and violet primary actions.
Langbase contributes neutral structural hairlines and restrained surface contrast only;
its white CTA and mono typography do not replace Orbit's tokens. Cycle's appearance
screen (18f38180-4a36-4cda-ba1d-21d2b0c4ccd6) informs visible selected states and
useful previews. Meta AI (c9514fbd-5d64-40c0-b5fd-cce0c5dbe1c8; flow 12751) informs
the focused composer, scan-friendly suggestions and organized response cards.

| Decision                          | Source / role                                       | Implementation target                                                                                                                       |
| --------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| More compact asymmetric hero      | Dala + existing product goal                        | Show search immediately and bring real offers closer to the first viewport.                                                                 |
| Prompt surface and quick requests | Meta AI composer/suggestions                        | Readable 16px input, separate submit row, useful existing examples.                                                                         |
| Neutral functional borders        | Langbase structural dividers                        | #232324 dividers; no violet washes across content.                                                                                          |
| Optical lighthouse hero           | User's 3D identity and criticism of primitive model | One original detailed silver/glass render, transparent square, centred tall sculpture; existing bounded 3D orbital motion, no video/engine. |
| Theme gallery                     | Cycle appearance picker                             | Miniature actual page composition, palette samples, active border/check, preview before existing owner-only activation.                     |
| Assistant hierarchy               | Meta AI                                             | Larger readable greeting, icon-led prompts, cleaner composer and offer boundaries; preserve human handoff, pricing evidence and privacy.    |

Asset lock: isolated contemporary lighthouse sculpture, brushed silver and graphite,
clear Fresnel glass with restrained blue optical light, tall elegant architectural
proportions, premium studio lighting, transparent background, square frame with room
for orbital paths. No text, sea, cliffs, UI, cartoon geometry or opaque background.
Optimize the single final asset; static artwork does not require continuous redraw.
Respect reduced motion, pause, offscreen suspension and the existing route transition.

Add a second owner-selectable design. Keep Beacon Classic published until the owner activates Orbit; removed legacy themes stay removed.

Primary source: the user's supplied DESIGN.md (Dala style reference). Preserve its pure black canvas, white regular-weight display typography, spacious asymmetric hero, violet pill CTA, and colorful procedural particles. The file is a visual reference, not a request to remove product features.

| Decision                                        | Source and role                                     | Adaptation                                                                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Black #000, white text, violet #8052ff CTA      | DESIGN.md canvas/type/action tokens                 | Violet is reserved for actions and small brand accents; amber and teal appear only in scene light.                                                              |
| Asymmetric hero and regular-weight type         | DESIGN.md layout/type                               | Mirror for Arabic; use the installed Arabic font with natural tracking and readable weight.                                                                     |
| Spatial beacon and orbiting light               | User: 3D and product identity; existing Beacon mark | Actual perspective-projected 3D geometry with depth sorting, luminous signal core and orbital provider metaphor. Nodes are decorative, not provider statistics. |
| Real offers below the hero                      | Existing ProviderBeacon product                     | Preserve original currencies/units, disclosure, compare links and sponsor labels.                                                                               |
| Preview then explicit activation                | Existing owner-only appearance API                  | Separate local preview URL from the revision-checked, audited owner mutation.                                                                                   |
| Pause, reduced motion and hidden-tab suspension | Refero motion.md and craft-details.md               | One isolated canvas module, bounded particle budget, capped pixel density, no dependency or external asset.                                                     |

Media: code-native geometric 3D scene, responsive 1:1 hero slot, camera projection and shaded prism geometry. Ambient colors stay behind the graphic, never behind table text. No fake product data or claims.

Avoid: restoring retired themes, replacing the blue design, all-purple surfaces, dense animated dashboards, non-semantic clickable cards, hover-only controls, loading a 3D engine for visitors using Classic.

QA: owner permissions and save conflicts; preview makes no writes; real catalogue data in both themes; pause/reduced-motion/visibility lifecycle; live preview and Classic rendered review after deployment.

## Glass Beacon refinement

User feedback: retain Orbit's direction, replace the primitive purple lighthouse, improve the assistant and navigation without a heavy runtime. Refero research was attempted again; the connector returned NO_SUBSCRIPTION. The supplied Dala reference remains the primary source, with no invented secondary references.

| Decision                        | Reference lock                                                | Implementation                                                                                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sculpted silver beacon          | Black canvas, white typography and violet actions stay locked | Rounded lathed geometry, pearl/chrome highlights, transparent blue lens and a soft white-blue signal. Blue is decorative light, not a new action token.                                                                        |
| Assistant as a quiet instrument | Functional surfaces may have separation                       | Graphite shell, crisp hairline, small lens emblem, flat suggested requests, inset composer and clear human handoff. Existing privacy and provider disclosures remain visible.                                                  |
| Motion with a purpose           | Refero motion/craft guidance already read                     | 220 ms panel opening, 160 ms closing, 200 ms content arrival; only opacity and transforms. The header stays visually still and assistant state persists through client navigation. No transition delay before accepting input. |
| Performance                     | User explicitly requires a light theme                        | No new packages, video, external images or animation framework. Geometry stays lazy loaded; bounded scene, 30 fps cap, offscreen/hidden/pause/reduced-motion suspension.                                                       |

Reject: opaque violet toy geometry, animated glass blur across the screen, endlessly spinning assistant chrome, blocking route overlays and remounting chats during navigation. Verify panel dismissal/focus, draft retention, reduced motion and real offer rendering alongside deployment gates.

Validation before release: TypeScript and production build pass. Targeted tests cover pause/offscreen/reduced motion, non-interactive panel exit, rapid reopen, Escape/focus return, retained drafts across routes, and no remount for page entrance. The lazy scene is 7.93 kB raw / 3.65 kB gzip. A native canvas microbenchmark at 720 CSS px / DPR 1.75 measured median ~2.0 ms per moving frame after caching (100 frames); this is a local rendering check, not a browser/mobile performance guarantee. No runtime dependency was added.

Live review found that an uncached page still replaced the whole public view with the original Suspense spinner. Orbit now defers the displayed route while its lazy module loads, retains the current view, shows a thin progress line, then runs the content entrance. The displayed-path context prevents animating the old content during loading. New forward navigation starts at the top; browser history and hash destinations are not forcibly reset. A suspended-route test verifies that the old page stays visible until the new module resolves.
