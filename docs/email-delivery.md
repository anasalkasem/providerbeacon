# ProviderBeacon email delivery

Sender and replies: **ProviderBeacon <soporte@providerbeacon.com>**.

Welcome, verification, password reset and password-change messages are rendered in Arabic, English, Spanish, Hindi and Chinese. Registration stores a welcome message in the same database transaction as the account. Password signups receive a welcome with an email confirmation link; Google signups receive a welcome once. Existing users are not emailed retroactively.

## Production activation

Resend domain: `providerbeacon.com` (`108f240c-0f2f-40a7-8444-2c7cb4f24592`). Region: `us-east-1`. Sending enabled, receiving disabled; open/click tracking disabled.

Add the following records in **Namecheap → Domain List → providerbeacon.com → Manage → Advanced DNS**. Leave the existing website records, Private Email MX records and root SPF record in place. TTL: Automatic.

| Type | Host | Value | Priority |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | See DKIM value below | — |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
| CNAME | `rsend` | `send.forge.rmta.net` | — |

DKIM TXT value (public DNS material, not an API secret):

```text
p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDIhXFOyCb8Fx+g7Es6jICz6O8WP29wjAjELLZk2/W33k+qHEPsSdczzKJp4cWxf2LSt0s2tWcC+rbz2HEK2KZnNklImKuAzJK4ouhtQMH4yQ9qQEH6IF619oz6lG+cMxgfDrcnCaNshI3X0/4YzkBWUl0fgEjPAYnQcb1Rlvq/VQIDAQAB
```

Verify the domain in Resend after DNS propagates. Only after Resend reports **verified**, enable `MAIL_ENABLED=true` in Railway and deploy. `MAIL_ENABLED=false` is the initial production state, so customer requests do not falsely report functioning email while DNS is incomplete.

The production Railway service has these server-only variables: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `MAIL_FROM`, `MAIL_REPLY_TO`, `MAIL_ENABLED`. The sending key is restricted to this domain. Never put secrets in Vite/public variables. Keep `PUBLIC_APP_URL=https://providerbeacon.com`, `AUTH_PEPPER` and `VAULT_MASTER_KEY` stable; existing identity and encryption settings are reused.

Resend webhook endpoint: `https://providerbeacon.com/api/webhooks/resend`. Events: sent, delivered, delivery_delayed, failed, bounced, complained, suppressed. Signatures use Resend's SDK on the original raw request body, with timestamp validation. HTTP failures allow provider retries. Acceptance and delivery are different statuses: delivery means the recipient mail server accepted the message, not that a user opened it or that it landed in the inbox.

After activation, test a new registration with an authorized test recipient, confirmation, password reset and log delivery. Do not use an address copied from a screenshot as authorization to send. No customer campaign or real-recipient test was sent during setup.

## Staff invitations

Staff invitations now use the same branded delivery queue and sender, with their own team recipient reference. See [team access](team-access.md) for resending existing unsent invitations, role editing, deletion and delivery status. No new environment variables or automatic historical sends are required.

## Customer communication

`/admin/email` provides localized template previews, a customer search, a plain-text composer, explicit preview confirmation, and a paginated delivery log. Each submission targets one verified customer who explicitly opted in to updates; it is not a bulk campaign tool. Only the owner and administrator have email permissions by default. The preview binds the exact recipient, content, sender and acting staff member for ten minutes. Repeated confirmation of the same preview queues one message.

News and offers are opt-in, with the consent version and timestamp stored on the account. Google sign-in does not opt users in. Signed-in customers can change language and subscription preferences in `/account/settings`; account messages do not require marketing consent. Updates include a normal unsubscribe confirmation link and RFC 8058 one-click POST headers. Visiting a link never unsubscribes or consumes a security token automatically. Custom message links stay on ProviderBeacon.

Price-target email is a separate per-service opt-in in `/account`, available to verified members. The existing Resend configuration is reused; no extra key is required. A dated branded template in all five languages is previewable in `/admin/email` and appears in the delivery log as `price_target`. One message is generated per target setting, with consent and current price checked before dispatch. Price unsubscribe disables all price alerts only; marketing unsubscribe affects only news/offers. See [buyer workspace](buyer-workspace.md) for freshness, expiry, cancellation and retry behavior.

## Delivery and recovery behavior

- Durable outbox, database row leases, bounded worker throughput shared across Railway replicas, frozen encrypted payloads and a provider idempotency key on retries.
- Transient network/429/5xx errors retry with backoff. Permanent errors stop. An ambiguous attempt is never retried beyond 23 hours, within Resend's documented 24-hour idempotency retention; it is marked for review instead.
- Consent, member status, address and suppressions are checked before dispatch. A message already handed to the provider cannot be recalled by unsubscribing.
- Verification links expire in 24 hours; reset links expire in 30 minutes. Tokens are random, stored hashed, held in URL fragments, and consumed under an account row lock. Any credential change invalidates pending reset proofs. Resetting revokes prior sessions and recovery codes; the user signs in again and can generate a new recovery code.
- Out-of-order/replayed webhook events do not downgrade delivered or bounced states. Bounces, complaints and provider suppression block later mail to the hashed address.
- Terminal messages clear encrypted content. Hourly bounded maintenance clears unused expired tokens and queued content, and removes email logs/events older than 90 days. Account deletion cascades to outbox and email tokens. Hashed suppression records are retained to prevent repeat delivery to blocked addresses.

Sources: [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys), [webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests), [domain verification](https://resend.com/docs/dashboard/domains/introduction).
