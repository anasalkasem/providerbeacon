# Beacon Studio — third site theme

## Integration

The existing project already uses React 19, TypeScript, Tailwind 4, shadcn's New York structure and lucide-react. No CLI initialization, additional packages or new providers are needed. `components.json` maps `@/components/ui` to `client/src/components/ui`; this is the project's correct components/ui folder. Creating another folder at the repository root would bypass the `@` alias and split the shared component system.

The requested component is `client/src/components/ui/saa-s-template.tsx`, with `demo.tsx` beside it. Global styles enter through `client/src/index.css`; Studio's tokens and presentation live in `client/src/studio.css`. The component receives the existing locale and marketplace providers through the app and keeps only its search text in local state. The existing PublicLayout owns navigation, the mobile menu, sign-in, language controls and the single main landmark.

The supplied template's centered hero, announcement pill, white gradient button and luminous product frame are retained. Copy and actions are adapted to ProviderBeacon. Its product preview is the live comparison component, including loading, empty and unavailable states, rather than invented analytics. Buttons lead to real routes. Lucide and the existing shadcn Button replace duplicated SVG/button implementations. Existing Inter and locale fonts replace the template's global Poppins override, which would otherwise affect Arabic and every other theme.

## Reference lock

Build target: the user-supplied SaaS React template. Preserve black canvas, two-line centered headline, muted gray supporting copy, white gradient CTA, fine borders and a broad illuminated product surface. Keep Classic and Orbit as separate owner choices; adding Studio does not change the saved selection.

| Decision                                                         | Source                                                              | Role and reason                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Centered headline, pill, white gradient CTA, large product frame | User's SaaS template                                                | Preserve the supplied composition with real ProviderBeacon content |
| Black #000, white #fff, gray #a3a3a3, 8px controls               | Krea, Refero style 3a63b3fa-dc79-4dc3-935e-3f8f4ab447a7             | Monochrome canvas and controls; blue is limited to the requested decorative light |
| Thin graphite dividers and medium-weight typography              | Linear Changelog, Refero style 11d3e58a-87d7-4a9a-bbf5-720f4fd3ffc6 | Secondary surface separation and readable compact UI               |
| Atmospheric photograph beneath the functional product surface    | User's Unsplash requirement; Krea's media treatment                 | Decorative only, never evidence of prices or service quality       |
| Cyan #3fd3ff light fading into electric blue #0077ff across the photograph and behind the comparison frame | Owner's September 19 correction and close-up of the lighthouse lantern | A diffused cyan source within a broad blue halo, with fully feathered photographic edges; keep the text and buttons white |
| Arabic-aware typography, focus states, reduced motion            | Existing product and Refero craft                                   | Reuse locale fonts, semantic search and accessible controls        |
| Clear white table dividers and offer borders | Owner's approved-glow screenshot and request for clearer white lines | White at 40% for separators and 60% for the comparison frame/table; brighter shared border/input and text tokens also cover offer cards and service tables |

Atmospheric image: https://images.unsplash.com/photo-1446776811953-b23d57bd21aa (Earth photographed from space). Served as a cropped WebP with responsive widths, a fixed aspect ratio and lazy loading. It is decorative; the comparison remains usable if the image fails. The new theme uses a short entrance transition and a static glow, with no animation loop, canvas or new motion dependency. The blue light also washes over the existing photograph, rather than only outlining the frame. The owner-gallery thumbnail reflects this accent. No image asset, logo, network request or JavaScript dependency is added.

The first blue treatment exposed the photograph's straight sides and made the frame's top edge look like a light strip. The refined treatment uses a radial mask on all four photograph edges, lower image contrast, a small static blur and two independent cyan/blue light gradients that fade completely inside their bounds. The bright top-edge stroke is removed. The light source stays just above the frame on both mobile and desktop.

After approving the diffused glow, the owner requested clearer white lines for tables and offers. Shared Studio border tokens now define visible white separators and input outlines; the home comparison uses stronger outer borders and white text. These are plain one-pixel rules, with no luminous top stroke or change to the approved blue glow. The other themes retain their existing tokens, and semantic price/status colors retain their roles.

Studio is available in the owner's Themes gallery and at `/?previewTheme=studio`. Preview is local to the tab. Activation uses the existing owner-only, revision-checked, audited setting. No database migration is needed.
