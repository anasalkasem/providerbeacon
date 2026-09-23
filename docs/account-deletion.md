# Account deletion and public privacy information

`/delete-account` is a public, localized resource for the ProviderBeacon Android
app and website. It links to `/account/settings` (which prompts for sign-in),
explains the irreversible action and supports requests through
`soporte@providerbeacon.com` without installing the app. The privacy page, footer
and account settings link to it. No email is sent simply by viewing the page.

The member deletion transaction requires existing password/recent Google proof
and rechecks the locked account/session. It removes member-authored promotions
and member-owned VIP cards before deleting the account, and clears business
ownership, host and verification time. Incrementing the business revision makes
outstanding payment/ownership operations stale. Existing foreign keys remove
sessions, email outbox/tokens, comparisons, watches, ratings, community
submissions/reports and ownership claims. Another member's content and sessions
are unaffected. Public provider records and payment/subscription records remain;
payment rows lose the member reference. No bulk deletion or migration runs.

Imported images are content-addressed and can be shared by records. The existing
bounded cleanup removes unreferenced assets eligible after 30 days from import;
account deletion does not delete assets still referenced by another record.

The published policy discloses current retention rather than promising an
unimplemented purge: daily analytics digests expire within two UTC days,
aggregates after 400 days, and delivery logs after 90 days. Suppression hashes
have no automatic expiry. Payment/subscription records have no automatic purge.
Support conversations use a separate browser identity, expire for authorization
after 30 days, and have no automatic message purge. Push subscriptions expire
with their session, are encrypted at rest, and are cleaned hourly.

Support/deletion email requests require ownership verification, scope review and
a reply with the expected completion time. Staff must include relevant processors
when handling a deletion request and explain any data that must be retained.
Do not ask for passwords, recovery codes or payment credentials by email.
Deleting a member does not delete an external Google account or a staff identity.

MySQL acceptance coverage exercises wrong-proof rejection, member-content
deletion across provider ownership, other-member isolation, retained provider
records, ownership-proof removal/revision change and unlinked payment retention.
