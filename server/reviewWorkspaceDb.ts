import { and, count, eq } from "drizzle-orm";
import type { z } from "zod";
import { providerRecords } from "../drizzle/schema";
import { memberAccounts } from "../drizzle/memberSchema";
import { providerBusinessAccounts as accounts } from "../drizzle/businessSchema";
import {
  REVIEW_ACCESS_DAYS,
  REVIEW_WORKSPACE_NAME,
  REVIEW_WORKSPACE_SLUG,
  type reviewWorkspaceInput,
} from "../shared/reviewWorkspace";
import {
  BUSINESS_DAY_MS,
  planState,
  providerHost,
} from "../shared/providerBusiness";
import {
  businessDatabase,
  businessFail,
  lockedBusinessAccount,
  lockedBusinessProvider,
} from "./providerEntitlements";
import { memberAuthOrigin } from "./memberSecurity";
import { writeAudit } from "./marketplaceDb";
import { invalidateCatalogueCaches } from "./catalogueCache";

// Only the platform-owner route can provision this explicit, private tenant.
// It uses normal member sessions and paid-tool authorization; no password or
// reviewer email is hard-coded, and no staff privileges or payment are created.
export async function reviewWorkspaceState() {
  const db = await businessDatabase();
  const [row] = await db
    .select({
      providerId: providerRecords.id,
      name: providerRecords.name,
      account: accounts,
      email: memberAccounts.email,
    })
    .from(providerRecords)
    .leftJoin(accounts, eq(accounts.providerId, providerRecords.id))
    .leftJoin(memberAccounts, eq(memberAccounts.id, accounts.ownerMemberId))
    .where(
      and(
        eq(providerRecords.slug, REVIEW_WORKSPACE_SLUG),
        eq(providerRecords.isReviewWorkspace, true)
      )
    );
  return row
    ? {
        providerId: row.providerId,
        name: row.name,
        email: row.email,
        state: planState(row.account),
        endsAt: row.account?.endsAt ?? null,
      }
    : null;
}

export async function provisionReviewWorkspace(
  actorId: number,
  input: z.infer<typeof reviewWorkspaceInput>
) {
  const db = await businessDatabase();
  const websiteUrl = memberAuthOrigin();
  const ownerHost = providerHost(websiteUrl);
  if (!ownerHost) businessFail("review_configuration");
  const result = await db.transaction(async tx => {
    const [member] = await tx
      .select({
        id: memberAccounts.id,
        status: memberAccounts.status,
        verifiedAt: memberAccounts.emailVerifiedAt,
      })
      .from(memberAccounts)
      .where(eq(memberAccounts.email, input.email))
      .for("update");
    if (!member || member.status !== "active" || !member.verifiedAt)
      businessFail("review_verified_member_required");
    // The unique slug and row lock serialize concurrent provisions. A collision
    // with an ordinary provider is rejected without converting or taking it over.
    await tx
      .insert(providerRecords)
      .values({
        slug: REVIEW_WORKSPACE_SLUG,
        name: REVIEW_WORKSPACE_NAME,
        initials: "PBR",
        status: "active",
        isReviewWorkspace: true,
        websiteUrl,
        description:
          "Private app review workspace. Test content only; excluded from public listings and comparisons.",
        verified: false,
        apiCataloguePublished: false,
      })
      .onDuplicateKeyUpdate({ set: { slug: REVIEW_WORKSPACE_SLUG } });
    const [identity] = await tx
      .select({ id: providerRecords.id })
      .from(providerRecords)
      .where(eq(providerRecords.slug, REVIEW_WORKSPACE_SLUG));
    const provider = await lockedBusinessProvider(tx, identity.id);
    if (!provider.isReviewWorkspace)
      businessFail("review_slug_conflict", "CONFLICT");
    const account = await lockedBusinessAccount(tx, provider.id);
    if (account.ownerMemberId && account.ownerMemberId !== member.id)
      businessFail("review_owner_conflict", "CONFLICT");
    if (!account.ownerMemberId) {
      const [owned] = await tx
        .select({ total: count() })
        .from(accounts)
        .where(eq(accounts.ownerMemberId, member.id));
      if (owned.total >= 10) businessFail("claim_limit");
    }
    const now = new Date();
    const endsAt = new Date(
      now.getTime() + REVIEW_ACCESS_DAYS * BUSINESS_DAY_MS
    );
    await tx
      .update(providerRecords)
      .set({
        name: REVIEW_WORKSPACE_NAME,
        status: "active",
        websiteUrl,
        verified: false,
        apiCataloguePublished: false,
      })
      .where(eq(providerRecords.id, provider.id));
    await tx
      .update(accounts)
      .set({
        ownerMemberId: member.id,
        ownerHost,
        ownershipVerifiedAt: now,
        status: "active",
        startsAt: now,
        endsAt,
        firstActivatedAt: account.firstActivatedAt ?? now,
        revision: account.revision + 1,
      })
      .where(eq(accounts.providerId, provider.id));
    await writeAudit(
      {
        actorUserId: actorId,
        action: "business.review_workspace.provisioned",
        entityType: "provider",
        entityId: String(provider.id),
        summary: input.note,
        metadata: {
          memberId: member.id,
          access: "complimentary_review",
          privateOnly: true,
          paymentCreated: false,
          endsAt: endsAt.toISOString(),
        },
      },
      tx
    );
    return { providerId: provider.id, endsAt };
  });
  invalidateCatalogueCaches();
  return result;
}
