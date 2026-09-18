# ProviderBeacon lighthouse identity

September 18, 2026. The owner's requested 3D lighthouse replaces the flat P mark
across the shared site/dashboard brand, browser tabs and phone installation icons.
The ProviderBeacon wordmark, theme choices and existing Orbit hero stay intact.

## Artwork

One original image generated with the built-in image generator: a white coastal
lighthouse with two electric azure-blue bands, architectural windows, a side
entrance, a glass lantern and a visible blue light beam on opaque graphite. The
low dark roof and irregular rocky footing make the building recognizable. No text,
device mockup or baked-in rounded corners.

The owner rejected the initial silver version because its circular tiered base and
polished proportions resembled a chess pawn. The final artwork removes the metallic
tower, round pedestal, roof ball and spire; painted masonry, blue bands, windows
and the asymmetric entrance establish a maritime lighthouse silhouette instead.

Production exports use ImageMagick only for resizing and encoding this same image.
The 128 px WebP brand mark supports the 32–44 CSS px header/footer/dashboard slots;
the installation and offline pages reuse the 192 px PNG. The app has 192 and 512 px
PNG icons, Apple has an opaque 180 px PNG, and the browser has a 32 px PNG plus
16/32/48 px ICO. Icons retain `purpose: any`; the silhouette is not declared
maskable. The operating system supplies its own icon shape.

## Integration and performance

The shared Brand image has explicit dimensions, an empty decorative alt (its link
already has the ProviderBeacon accessible name), and no color/tint filter. The
dimensional effect is baked into the artwork, with no new animation, canvas,
JavaScript dependency or rendering loop. The old SVG favicon is removed so it
cannot override the new artwork in browsers that prefer SVG.

All favicon, Apple and manifest URLs use `v=lighthouse-1`. The offline cache uses
the same revised icon URL; the existing build fingerprint includes both that image
and the manifest. Previously installed home-screen icons may remain under the
operating system's cache until its metadata refresh or the shortcut is re-added.
