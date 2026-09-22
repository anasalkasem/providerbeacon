# Beacon Daylight

## Brief and reference lock

Add a daytime copy of the current ProviderBeacon layout: white surfaces,
blue action buttons and readable dark text. Keep the service comparison form,
continuous provider logo strip, provider albums and compact mobile catalogues.
This is a fourth saved theme and a local preview; adding it does not change
the owner's published theme.

The current ProviderBeacon UI is the primary composition reference. The user's
white/blue brief fixes the visual direction; no new composition is required.
Two Refero style records were inspected in full:

- Clearbit (`710f2705-0509-4ce6-9db9-160dbaccafed`): cool white surface separation,
  dark ink typography and restrained borders. Its decorative blue is not a CTA.
- Dropbox (`3585a6ac-12d4-4ace-88b8-a8089c109250`): royal blue `#0061fe` for primary
  actions on white. Do not adopt its cream surfaces, fonts or page composition.

## Decision ledger

| Role             | Decision                                                        |
| ---------------- | --------------------------------------------------------------- |
| Canvas and cards | White `#ffffff`; cool `#f4f7fc` for secondary surfaces          |
| Text             | Ink `#142238`; secondary `#53627a`                              |
| Actions          | Blue `#0061fe`, white labels, darker blue hover                 |
| Boundaries       | Light `#d5dfec` for groups; stronger `#7c8ea5` for inputs       |
| Feedback         | Separate readable green, amber and red foreground/surface pairs |
| Decoration       | Subtle blue edge light, following the existing owner setting    |
| Layout and type  | Existing responsive structure, fonts and touch targets          |
| Artwork          | Preserve provider-supplied logos and album images unchanged     |

The theme sets native browser controls to light mode, removes the dark class,
and updates the browser theme color. Legacy text-on-dark utility combinations
are adapted only on known themed surfaces; image overlays and provider brand
colors are preserved.

Preview: `/?previewTheme=daylight`. The owner can publish it from Themes using
the existing revision-checked, audited appearance setting. No migration or
permission change is needed. Preview exit restores the saved theme.

Validation covers theme selection, preview/exit, browser color mode and MySQL
persistence, followed by a rendered review of the home page, service catalogue,
provider catalogue and assistant.
