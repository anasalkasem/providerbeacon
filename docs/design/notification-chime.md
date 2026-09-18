# ProviderBeacon notification sound

September 18, 2026. The owner requested a distinctive, pleasant notification sound.

The original 1.2-second glass/marimba chime is stored at
`client/public/sounds/beacon-chime-v1.mp3`. It was generated specifically for
ProviderBeacon using Runway's sound-effect tool (task
`0ab4db3f-64c0-408d-a5a4-d9ba05dc7819`). Direction: a warm rising three-note motif,
rounded attacks, a delicate crystal shimmer and a short fading tail; no voice,
music bed, bass impact or repetition.

The production export is mono, 44.1 kHz, 96 kbps MP3 with short entrance/exit fades
and a 6 dB gain adjustment. Playback has an additional 0.65 gain; the file retains
ample headroom. It is served from ProviderBeacon, with no third-party runtime
request or dependency. The public URL also provides an easy standalone preview.

The existing message sound controls apply to staff, members and visitor support.
Audio still activates only after the user's browser gesture and respects the
saved mute preference. The clip loads and decodes once per active sound engine,
only on activation. A 1.5-second network timeout leaves a quiet three-note
oscillator fallback available when the asset is unreachable. Rapid previews cannot
overlap; the existing incoming-message cooldown and cross-tab deduplication remain.
Muting stops the current sound and cancels a pending enable/preview action.

This is the in-app notification sound. It does not add push delivery when the
website is closed or change the operating system's notification sound.
