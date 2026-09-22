# Private app review workspace

The platform owner can provision **ProviderBeacon Review** from **Admin → Subscriptions → App review workspace** for an existing active member with verified email. Enter the member email, record the reason and confirm private test access. This creates or renews a 365-day complimentary grant. Keep it active while stores need review access. No password belongs in this form, source code or audit log.

The workspace uses normal member authentication and the same owner, subscription, validation and moderation checks as ordinary provider tools. It creates no staff role, real payment, ownership claim on another business or fabricated analytics. Its website is the platform's canonical origin. The special assignment is explicitly recorded as complimentary review access in the staff audit log, rather than claiming proof of a third party's ownership.

`isReviewWorkspace` is immutable through ordinary provider forms and is excluded by the shared public provider predicate. Directory, direct provider/service lookup, comparison, assistant results, groups, offers and VIP listings cannot expose its content, even when that content has an approved moderation status. Live payment checkout and external provider API connections are disabled for this explicitly labelled test tenant. Reviewers can use the normal analytics and content editing/submission tools. Analytics start with measured zeroes; do not invent traffic, purchases or customer reviews. Any sample content must be clearly labelled as test content.

Provisioning is owner-only, requires the canonical Origin, checks the current verified member and records the actor and reason transactionally. The fixed slug cannot convert an existing ordinary provider, and a linked workspace cannot be reassigned to another member. Revoke its ownership through the existing subscription controls to remove access; the privacy flag remains in place. The ordinary public ownership-claim endpoint cannot claim this tenant.

Migration `0039_private_review_workspace` adds a false-by-default privacy flag only. It does not create any provider, alter an existing account, grant access, enable gateways or store credentials. Provisioning is a separate explicit owner action after deployment.

MySQL acceptance tests cover staff/member and Origin boundaries, verified account requirements, duplicate provisioning, conflicting ownership, public isolation despite approved content, normal private tools, forbidden live billing/API connections and revocation.

For Play Console, describe this as a preconfigured private test workspace. Supply reusable credentials in the secure console and clear English steps to sign in, open **Provider workspace**, and select **ProviderBeacon Review**. The privacy boundary does not change the app's ordinary public catalogue or conceal application behavior from reviewers.
