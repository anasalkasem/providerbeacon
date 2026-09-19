# Mobile store release — 2026-09-19

## Verified starting point

The owner confirmed the installed iPhone web app receives the test notification,
shows the lighthouse icon and plays sound, and subsequently confirmed that the
phone workflow test was complete and working. The public search-to-comparison
path also retained quantity, currency and the sign-in return destination during
browser verification. These results concern the installed web app, not native
App Store/Google Play packages.

## Android implementation

`mobile/android` is a buildable Android Browser Helper / Trusted Web Activity
project. It deliberately preserves the current HTTPS origin and browser sessions.
It includes the lighthouse launcher/splash assets, five-language shortcuts,
notification delegation, permission support, strict launch-URL validation,
separate beta/production identities and an automated APK/AAB build.

The server serves Digital Asset Links only for an explicitly configured release
certificate. No certificate, developer identity, store account, review outcome or
production signature is invented. See [the Android project](../mobile/android/README.md).

## Remaining distribution inputs

| Platform | Required owner-controlled input | Next result |
| --- | --- | --- |
| Google Play | Existing Play Console account and app record; upload signing key; actual Play app-signing SHA-256 | Signed AAB, verified domain, internal test track |
| Apple | Apple Developer/App Store Connect account and team ID, registered app ID, signing/provisioning access, APNs signing credentials | Signed iOS build and TestFlight distribution |

Do not send private signing keys or passwords in chat. Configure them through the
appropriate account/build secret store. Android's package proposal is
`com.providerbeacon.app`; confirm it against the owner's store record before the
first upload. It is not yet a registered store identity.

## iOS implementation decision

No iOS binary or TestFlight build exists yet. A raw remote WebView wrapper would
regress the working PWA: Google authorization must run through an approved browser
flow, browser cookies are not automatically a native session, and Web Push is not
the native notification transport.

The iOS work requires a bundled React/Capacitor client with a bounded API origin,
an authenticated browser-to-app handoff using a short-lived, single-use code tied
to an app-generated challenge, and an APNs device adapter integrated with the
existing authorized message queue. Native device opt-in, token rotation, logout
revocation and notification deep links need their own tests. Never copy bearer
tokens into deep-link URLs or weaken the website's CSRF checks for native access.
Do not use Capacitor `server.url` as a production shortcut: its documentation
marks it as a live-reload option.

Before TestFlight: verify native login/return, account deletion, private notification
payloads, offline recovery and safe-area/keyboard behavior on physical iPhone/iPad.
The current PWA remains the working iPhone version until that native path is built.

## Store review work

- The member settings page already includes reauthenticated account deletion at
  `/account/settings`; verify the complete deletion flow in each store build.
- Public privacy URL: `https://providerbeacon.com/privacy`. Complete each store's
  actual data disclosures from the account, chat/translation, analytics and push
  implementation, not from a template.
- The web app includes paid provider subscriptions/VIP flows using external
  payment providers. Review and implement the applicable in-app billing behavior
  before any public store submission. The beta build is not approval to publish
  the existing checkout unchanged in every store/region.
- Reassess Google login against Apple's current equivalent-login requirements and
  the applicable business-account exceptions. Do not claim an exemption without
  reviewing the actual app scope.
- Store screenshots must come from the signed native build. Do not relabel PWA
  screenshots as a TestFlight/Google Play app.

## Official references checked

- [Chrome: TWA generation, signing and domain verification](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)
- [Android: signing a release and Play App Signing](https://developer.android.com/studio/publish/app-signing)
- [Capacitor: production configuration and live-reload-only server URL](https://capacitorjs.com/docs/config)
- [Capacitor: macOS/Xcode environment for iOS](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Apple: review guidelines, including minimum functionality](https://developer.apple.com/app-store/review/guidelines/)
