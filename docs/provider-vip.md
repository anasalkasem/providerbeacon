# VIP provider album

VIP album placement is included in the existing provider plan. It does not alter
trust scores, verification fields, catalogue ordering, or subscription prices.

- The home page shows up to eight image-first provider cards in a moving ribbon;
  `/vip` provides the complete paginated album. Service prices remain in the service
  explorer, reached from the homepage search and a dedicated link.
- One card belongs to one provider. Its owner needs a verified email, current
  approved ownership, and an active provider subscription to submit or edit it.
- Owners manage the card at `/account/provider?tab=vip`. The form accepts a cover,
  a 140-character introduction, up to three specialties, and an optional dated
  offer. It previews the exact card without counting impressions or clicks.
- Raster files are fitted into 1280 × 800 JPEG covers on the client. The server
  validates the image type, declared dimensions, and 512 KiB maximum. Images use
  existing content-addressed database storage and survive Railway deployments.
- Staff with `business.manage` review cards from `/admin/subscriptions`, under
  **VIP card reviews**. Approval requires a content confirmation and review note.
  Every edit returns a card to review and temporarily removes public placement.
- Public reads recheck the subscription, provider visibility, current owner,
  verified email, and provider website domain. Expiry and suspension remove
  eligibility without deleting the owner's content. Withdrawal works after a
  subscription expires. New owners cannot inherit a previous owner's approval.
- New visits rotate eligible cards by a server minute bucket. Each card gets
  each position once per complete cycle. A visit retains its rotation across
  refreshes and album pages. The homepage advances one position every five seconds
  while the ribbon is visible. Hover, keyboard focus, dragging, a pause control,
  background tabs, and reduced-motion settings stop automatic movement. Arrows,
  position buttons, and touch dragging provide manual navigation. One provider is
  centered without motion. No duplicate advertisement nodes are created; a small
  collection returns smoothly to the start if there is not enough content to loop.
- Subscription cards disclose **Paid placement**; owner-granted cards disclose
  **Platform-sponsored placement**. **Ownership verified** is a separate
  indication and is not a service-quality endorsement. Expired offers disappear.

## Owner-granted complimentary VIP

The platform owner can open **Complimentary VIP** at `/admin/subscriptions`,
choose a real, public, active provider, review its card, and grant 7, 30 or 90 days
of placement without checkout. Existing provider logos work without an upload;
the owner may supply a cover and short introduction, with an immediate preview.
Saving an existing grant renews its chosen duration from the time of saving.
The owner can stop a grant immediately. Both actions record an internal note,
actor, revision and expiry in the audit trail. Revision checks prevent stale or
concurrent actions from silently replacing each other.

These are platform-managed promotional cards, including providers without a
claimed account. They do not grant the provider dashboard's subscription benefits,
alter billing or introductory pricing, or imply verified ownership. No payment,
business account, trust score, or claim is created. A currently subscribed card
cannot be replaced by this feature. A verified subscriber may later submit their
own card through the normal review flow, replacing a platform promotion.

Only the current platform `owner` role can read or change grants through the API;
administrators and provider members cannot activate them. Same-origin validation
also applies. Public reads and measurement recheck expiry, approved status,
provider visibility and the bound website domain. Expired, revoked, hidden or
domain-mismatched cards immediately lose eligibility. The grants never seed fake
providers. Migration `0031_complimentary_vip.sql` leaves existing cards classified
as subscription placements.

## Measurement

`POST /api/vip-analytics` accepts bounded, same-origin impression and click events
for the current approved revision only. An impression requires 50% visibility
for one second or a trusted click. Browser privacy signals, prerendering, known
automation and staff sessions are excluded by the shared measurement controls.
Repeated activity is deduplicated per browser/provider/event for 30 minutes,
across replicas. The endpoint shares existing database request limits.

VIP statistics are separate from profile visits. Only the verified, subscribed
owner can read their provider's totals for 7, 30 or 90 UTC days. They are approximate
counts, not unique people or sales. Daily keyed visitor digests expire within two
UTC days; aggregate totals are retained for 400 days by the existing cleanup job.

Migration `0030_provider_vip.sql` adds the card, aggregate, and deduplication
tables. No sample providers, fabricated advertisements, or automatic content
approvals are seeded. Existing subscribers can submit their first cover using
the new dashboard tab.
