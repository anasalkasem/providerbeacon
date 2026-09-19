# Phone notifications

Phone push alerts cover staff direct messages, assigned support conversations and visitor support replies. Users enable each browser/device explicitly in the messenger's Phone notifications controls. AI-generated answers and imported conversation history do not trigger push.

On iPhone/iPad, install the site on the Home Screen and open it there before enabling notifications. An existing installation may need the normal user-approved application update first. The control checks that the active service worker supports push before requesting permission. A Test notification button reports gateway acceptance; actual receipt must be checked on the device.

## Delivery and privacy

- Message insertion and device queue updates share a database transaction. Retried message submissions do not enqueue again; rapid arrivals coalesce into the latest pending message per device.
- Workers claim devices with a database lease and recheck current conversation access, read status and session validity before sending. Staff alerts require a live, MFA-verified independent staff session and active team membership. A visitor subscription is tied to the existing support-session cookie and its expiry.
- Endpoint and browser encryption keys are encrypted with the existing vault key. The VAPID private key stays in server environment configuration. Only supported Apple, Google, Mozilla and Windows push service endpoints are accepted, including validation again before delivery.
- Subscription writes carry a server-derived identity token, preventing a delayed opt-in operation from silently attaching to another login. Each actor has an eight-device limit. A new explicit opt-in may rebind that browser's subscription; it never happens automatically.
- Notifications contain generic localized text and the site icon, without message contents, customer names or previews. Opening a notification goes to the relevant messenger; existing server authorization still applies.
- Unsubscribe revokes the server record and browser subscription independently, so browser revocation can succeed while offline. Staff logout/revocation prevents further message delivery; expired visitor sessions do likewise. Expired device rows are cleaned up.
- HTTP 404/410 retires an endpoint. Transient transport failures retry with bounded backoff. Push-service acceptance is not a guarantee of delivery, and network failure after acceptance may result in a retry; a stable notification tag/topic coalesces duplicates.
- The system alert is silent while a site window is visible, preserving the existing in-site chime. With the app closed, sound follows the phone/browser settings; the website's custom MP3 cannot be assigned as an iOS system push sound.

## Deployment

Migration `0038_message_push` adds only the device/queue table. Set `WEB_PUSH_PUBLIC_KEY` and `WEB_PUSH_PRIVATE_KEY` once, as a matching P-256 VAPID pair, alongside the existing `VAULT_MASTER_KEY`. Do not rotate VAPID keys casually: existing browser subscriptions use the corresponding public key. The subject is `https://providerbeacon.com`.

The existing production migration runner applies the table before starting the push worker. No external notification SaaS is required. The browser's push service handles delivery after the app closes.

## Verification

Unit tests cover endpoint restrictions, curve-key validation, payload privacy, service-worker display/navigation, explicit permission, denial, failed registration and offline browser revocation. MySQL acceptance cases exercise atomic queuing, duplicate submissions, concurrent workers, read/logout/suspension suppression, retries/expired endpoints, identity changes, unsubscribe, and visitor expiry.

On 2026-09-19, the owner confirmed receipt of the test notification, the lighthouse icon and sound on a physical iPhone. The supplied screenshot shows the native notification banner while the app is open, with phone notifications enabled. This confirms the owner's device test, but does not separately establish locked-screen/background delivery or whether the reported sound was the in-site chime or the OS notification sound. Those cases and physical Android receipt remain unverified.
