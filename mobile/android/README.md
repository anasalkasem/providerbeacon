# ProviderBeacon Android

This is the Android Trusted Web Activity (TWA) source project. It uses the existing
HTTPS application, account cookies, comparison URLs and Web Push implementation.
It does not add a second database, copy session tokens into JavaScript, or run
Google sign-in inside an embedded WebView.

The starting project was generated with GoogleChromeLabs Bubblewrap core 1.25.0
and is maintained directly here. Keep the generated Apache 2.0 copyright notices.
The approved lighthouse artwork is reused for the launcher and launch screen.
Native launcher shortcuts are localized into Arabic, English, Spanish, Hindi and Chinese.

## Build

Use JDK 17, Android SDK platform 36 and build tools 36.0.0. The Gradle wrapper is
pinned to 8.13 with the publisher's SHA-256; Android Gradle Plugin is 8.13.2.

```sh
cd mobile/android
./gradlew testBetaDebugUnitTest lintBetaDebug assembleBetaDebug bundleProductionRelease
```

The **Android beta** GitHub Actions workflow performs this build and retains the
APK, unsigned AAB, APK signing identity, checksum file and beta instructions for 30 days.

| Output | Purpose |
| --- | --- |
| `app/build/outputs/apk/beta/debug/app-beta-debug.apk` | Installable internal beta, package `com.providerbeacon.app.beta` |
| `app/build/outputs/bundle/productionRelease/app-production-release.aab` | Unsigned store bundle, package `com.providerbeacon.app` |

The beta has its own package, label, content-provider authority and launcher
shortcuts so it can coexist with a future store installation. The generated debug
key is ephemeral; different CI builds may require reinstalling the beta. No debug
certificate is trusted by the production domain.

## Sign a production build

Supply all four environment variables through a secret manager, then run
`./gradlew bundleProductionRelease`. Never commit the keystore or passwords.

- `PB_ANDROID_KEYSTORE`: absolute path to the existing upload keystore.
- `PB_ANDROID_STORE_PASSWORD`: keystore password.
- `PB_ANDROID_KEY_ALIAS`: upload-key alias.
- `PB_ANDROID_KEY_PASSWORD`: key password.

With no signing variables, the production output is deliberately unsigned. A
partial configuration fails the build. The CI workflow neither signs production
releases nor submits them to Google Play. Before later releases, increment
`versionCode` and set `versionName` in `app/build.gradle`.

## Domain verification

The website now serves `/.well-known/assetlinks.json` directly as JSON, including
when no Android certificate is configured. Set Railway's
`ANDROID_APP_SHA256_FINGERPRINTS` to the **Play app-signing certificate** SHA-256
from Play Console. Do not use the upload certificate or a debug certificate.
Use colon-separated bytes; a comma-separated list supports an intentional key
rotation. The endpoint rejects malformed sets rather than partially trusting them.

Until configured, the endpoint returns `[]` and Chrome keeps the browser toolbar
visible. This fallback is expected and is not a verified full-screen TWA. Other
origins, including Google and provider websites, always retain browser identity.
There is no wildcard trusted origin or WebView fallback.

Notification delegation and Android 13+ notification permission support are
included via Android Browser Helper 2.6.2. Physical Android testing is still
required for permission, background arrival, sound, tap destination, logout and
revocation; the iPhone PWA test does not verify this Android binary.

## References

- [Chrome TWA setup and asset links](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)
- [Android signing and Play app-signing certificates](https://developer.android.com/studio/publish/app-signing)
- [Bubblewrap source](https://github.com/GoogleChromeLabs/bubblewrap)
- [Release status and iOS requirements](../../docs/mobile-store-release.md)
