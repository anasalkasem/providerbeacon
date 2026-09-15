# Team invitations and access

The owner manages employees at `/admin/team`. Administrators can view the team but cannot change team access. Other roles do not gain team permissions. Ownership and self-management are protected on the server as well as in the interface.

## Invitation delivery

Creating an invitation commits the membership and an encrypted `staff_invite` email to the existing durable email outbox in one transaction. It uses the existing Resend configuration and sender **ProviderBeacon <soporte@providerbeacon.com>**. No new Railway variables are required. Disabled/unconfigured mail or a suppressed recipient produces an error and rolls back the invitation; the interface never claims the email was delivered merely because a database record was created.

The invitation has the existing branded email layout and Arabic, English, Spanish, Hindi and Chinese copy. The owner selects its language. The seven-day link is one-use and email-bound; new links hold the secret in a URL fragment, while previously issued query-string links remain compatible. Staff registration does not create a customer account or marketing subscription.

The team list refreshes delivery status every ten seconds and distinguishes queued, processing, provider acceptance, recipient-server delivery, delay, failure, bounce, complaint, suppression and cancellation. Recipient-server delivery does not guarantee inbox placement or that the employee opened it. Invitation emails also appear in `/admin/email` history. No plaintext token or token hash appears in team listings, audit entries or delivery history.

The shared worker retains its encrypted frozen payload, database lease, suppression checks, exponential backoff and stable provider idempotency key. Retries stop before the provider's 24-hour idempotency retention window ends. Invitation status, address, expiry and token version are rechecked at claim and immediately before dispatch; already dispatched messages cannot be recalled, but their old links stop working after a resend or deletion.

## Existing invitations and resending

Old invitations were only recorded with a manually shareable link; they were never sent through the email worker. They show **Email has not been sent**. The owner can use **Resend invitation** to send them. Migration does not email historical addresses automatically.

Resending rotates the token, starts a new seven-day expiry and cancels any earlier queued/claimed invitation email. A one-minute per-invitation cooldown and a shared per-owner mutation limit prevent repeated clicks from flooding recipients. Duplicate creation never overwrites an existing active/suspended membership; use the relevant edit or resend action instead.

## Permission changes and deletion

The owner can edit any non-owner employee or pending invitation using the existing six assignable roles. Role descriptions explain their scope. Changing a registered employee's role revokes all staff sessions. Every authorization check reads active membership by user ID, without falling back to a legacy admin flag or matching another account's email. Suspended/deleted users therefore cannot regain privileges through legacy OAuth.

Deleting a pending invitation invalidates its link. Deleting a registered employee removes team membership, staff credentials (including MFA data), staff sessions and linked invitation outbox entries. The historical user identity remains for audit attribution with its legacy admin flag cleared. Customer accounts are separate and unaffected. Rejoining requires a fresh invitation and fresh staff credentials.

Role, status, resend and deletion changes require the displayed revision and execute under locks, so stale pages cannot overwrite a newer change. Invitation acceptance is atomic and audited; concurrent acceptance, resend or deletion cannot reactivate a consumed/obsolete link. Staff mutation endpoints permit only the canonical application origin and the explicit production `www` alias used by existing staff sessions; public registration has a shared rate limit.

## Validation

Unit and rendered component tests cover localization, visible actions, protected accounts, input restrictions and old/new link parsing. Isolated MySQL acceptance tests cover encrypted queueing, actual worker dispatch with a mocked provider, webhook delivery status, transient/permanent failures, blocked sending, resend rotation, concurrent acceptance, role changes, revocation, deletion, legacy flags, OAuth binding and origin/permission enforcement. No real-recipient test message or production employee mutation is part of the test suite.

Provider references: [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys), [email webhook events](https://resend.com/docs/webhooks/event-types).
