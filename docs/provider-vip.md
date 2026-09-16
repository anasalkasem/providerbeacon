# VIP provider album

VIP album placement is included in the existing provider plan. It does not alter
trust scores, verification fields, catalogue ordering, or subscription prices.

- The home page shows eight cards; `/vip` provides the complete paginated album.
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
  refreshes and album pages; there is no automatic carousel.
- Each card discloses **Paid placement**. **Ownership verified** is a separate
  indication and is not a service-quality endorsement. Expired offers disappear.

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
