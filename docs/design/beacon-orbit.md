# Beacon Orbit 3D — reference lock

Add a second owner-selectable design. Keep Beacon Classic published until the owner activates Orbit; removed legacy themes stay removed.

Primary source: the user's supplied DESIGN.md (Dala style reference). Preserve its pure black canvas, white regular-weight display typography, spacious asymmetric hero, violet pill CTA, and colorful procedural particles. The file is a visual reference, not a request to remove product features.

| Decision | Source and role | Adaptation |
| --- | --- | --- |
| Black #000, white text, violet #8052ff CTA | DESIGN.md canvas/type/action tokens | Violet is reserved for actions and small brand accents; amber and teal appear only in scene light. |
| Asymmetric hero and regular-weight type | DESIGN.md layout/type | Mirror for Arabic; use the installed Arabic font with natural tracking and readable weight. |
| Spatial beacon and orbiting light | User: 3D and product identity; existing Beacon mark | Actual perspective-projected 3D geometry with depth sorting, luminous signal core and orbital provider metaphor. Nodes are decorative, not provider statistics. |
| Real offers below the hero | Existing ProviderBeacon product | Preserve original currencies/units, disclosure, compare links and sponsor labels. |
| Preview then explicit activation | Existing owner-only appearance API | Separate local preview URL from the revision-checked, audited owner mutation. |
| Pause, reduced motion and hidden-tab suspension | Refero motion.md and craft-details.md | One isolated canvas module, bounded particle budget, capped pixel density, no dependency or external asset. |

Media: code-native geometric 3D scene, responsive 1:1 hero slot, camera projection and shaded prism geometry. Ambient colors stay behind the graphic, never behind table text. No fake product data or claims.

Avoid: restoring retired themes, replacing the blue design, all-purple surfaces, dense animated dashboards, non-semantic clickable cards, hover-only controls, loading a 3D engine for visitors using Classic.

QA: owner permissions and save conflicts; preview makes no writes; real catalogue data in both themes; pause/reduced-motion/visibility lifecycle; live preview and Classic rendered review after deployment.
