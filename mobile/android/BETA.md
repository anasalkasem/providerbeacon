# ProviderBeacon Beta — Android

Install `app-beta-debug.apk` on an Android device for internal testing. This is an
Android package, not an iPhone installer. The production AAB included alongside
it is unsigned and cannot be installed directly.

The app opens the live ProviderBeacon service and can affect your real account.
No test message is sent automatically. The beta uses the approved lighthouse
icon and separate package `com.providerbeacon.app.beta`.

The browser toolbar remains visible because production does not trust an
ephemeral CI debug key. Full-screen domain verification belongs to the signed
store build. Do not disable browser verification to hide the toolbar.

Check search, selected quantity/currency, comparison, saved services, login and
logout. Then check notifications using the explicit controls, including arrival
while the app is closed and the destination after tapping. Test loss of connection
and recovery. Report Android/browser version and the build checksum with any issue.

An Android test build is not evidence of App Store or Google Play approval.
