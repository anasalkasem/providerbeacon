# Community groups and channels

Public directory: `/groups`. Member submissions: `/account/groups`. Staff review: `/admin/groups`.

Groups, channels and Discord servers share these routes, the ten-listing account limit and the same review/ownership/subscription rules. WhatsApp links identify the listing as a group or channel. Telegram usernames do not: a channel badge requires observed subscriber metadata, and an unknown type uses a neutral **Open community** action. Discord entries are labelled **Server**. Labels are localized across public cards, import previews and member/provider/staff lists.

Provider-associated groups now additionally require an active provider package. See [provider-business.md](provider-business.md) for ownership, activation and expiry. Independent community groups remain free. The paid flag survives provider deletion so a commercial listing cannot become free by losing its association.

The directory starts empty. No competitor records, personal contacts, invented activity counts, paid placement or unverified provider associations are seeded. Telegram usernames alone cannot establish that a destination is a group. Staff must open each destination and check its actual type and purpose before publishing.

## Lifecycle

- A member needs an active session and a verified email to submit, edit or report. Members can hide their own listings even without a currently verified address. Each account can manage ten submissions, including hidden and rejected entries.
- Every submission is pending. Staff can publish, request changes or hide it with a note visible to its submitter. Staff-created entries also start pending and need the same review.
- Editing any name, description, link or classification hides the published version and returns it to pending review. Revision checks reject stale reviews, edits and withdrawals. User IDs supplied as query cache partitions never determine ownership.
- Provider association is required for a provider's own commercial group. Independent community entries may be unassociated. It requires a source page on the provider's own website, an eligible public provider, and an explicit reviewer confirmation of the exact group link. A hidden or deleted provider's commercial group disappears from public responses. Subscription expiry hides it without removing its saved approval.
- Publication means the link and listing were reviewed at the displayed date. It does not verify members, current activity, offer quality or provider performance. Public metadata imports do not replace staff review or automatically recheck a published link.
- Removing a member account cascades its submitted groups and reports. Staff-created groups survive. Provider deletion removes the association without deleting the community entry.

## Reports and permissions

Reports can be submitted only for published groups. A member has at most one open report per group; retries are idempotent. After staff resolution a new incident can reopen the record with a new revision. A stale resolution cannot close that new incident. Reports do not automatically remove a group. Staff can filter by open reports, hide an affected group and record resolution notes in the audit log.

`groups.read` is available to owners, administrators, operations managers, provider reviewers and auditors. `groups.review` is available to those roles except auditors. Catalogue editors and translation managers gain no moderation privileges. Visitor and staff identities remain separate. All mutations require a valid same-origin request. Private queries and directory endpoints use `Cache-Control: no-store`.

Submission, editing, withdrawal and reporting use shared database rate limits, respectively 5, 20, 20 and 10 requests per member per hour. Member-row locks enforce capacity under concurrency; a unique SHA-256 key deduplicates canonical URLs across accounts without case-folding invite codes. List endpoints have bounded cursor pagination.

## Supported links

- Telegram: HTTPS `t.me` or `telegram.me` group/channel username links, `+` invites and legacy `joinchat` invites. Personal phone links, bot suffixes, action links, message links, queries and fragments are excluded by the initial format policy. A human check still determines the target's actual type. See [Telegram link formats](https://core.telegram.org/api/links).
- WhatsApp groups: HTTPS `chat.whatsapp.com` invitations, including the optional share parameter such as `?mode=ac_t`, which is stripped from the canonical URL. See [WhatsApp group invitations](https://faq.whatsapp.com/3242937609289432/).
- WhatsApp channels: HTTPS `whatsapp.com/channel/CODE` and `www.whatsapp.com/channel/CODE`, canonicalized to `www` without a trailing slash. Codes retain case. A single UI-language query such as `?lang=en` or `?lang=bs_BA` is removed from the saved identity. Channel-post links, arbitrary query actions and personal `wa.me` links remain excluded. See [WhatsApp Channels](https://blog.whatsapp.com/whatsapp-channels-are-going-global).
- Discord: HTTPS `discord.gg` and `discord.com/invite` invitations. See [Discord server invitations](https://support.discord.com/hc/en-us/articles/204155938-How-do-I-invite-friends-to-my-server).

The UI supports Arabic, English, Spanish, Hindi and Chinese. Group language is independent of the interface language. Beacon AI knows the navigation and submission workflow but cannot retrieve, invent, join or moderate groups.

Group forms can retrieve public details for all three platforms through the [automatic details importer](automatic-public-details.md). An unavailable or private invitation remains eligible for manual entry and staff review; automatic metadata does not establish ownership or publication eligibility.

Channel support uses the existing `whatsapp` platform and JSON audience snapshot; no additional migration, credentials or separate paid package is required.

## Deployment and verification

Migration `0021_community_groups.sql` is additive and contains no seed data. Railway's existing migration startup runs it; no new credentials or environment variables are required. Existing provider integrations, member login and email settings remain in use.

`community.test.ts` covers URL and schema boundaries and role permissions. `community-ui.test.ts` checks escaping, association evidence and localized forms. `communityMysqlAcceptance.ts` is registered in the existing isolated MySQL acceptance suite, covering review/edit revisions, duplicate concurrency, verified accounts, ownership, origin checks, staff permissions, reporting, pagination, deletion and rate/capacity enforcement. It must never be run against the production database.
