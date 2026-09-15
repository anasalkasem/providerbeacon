import { and, eq, inArray, sql, type SQLWrapper } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { providerBusinessAccounts as accounts } from "../drizzle/businessSchema";
import { providerRecords } from "../drizzle/schema";
import { planIsActive, providerHost } from "../shared/providerBusiness";
import { providerTelegramUrl } from "../shared/providerProfile";
import { visibleCatalogueProvider } from "./apiCatalogue";
import { getDb } from "./db";
import { lockedAuth, type MemberAuth } from "./memberDb";

export type BusinessDatabase = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type BusinessTransaction = Parameters<
  Parameters<BusinessDatabase["transaction"]>[0]
>[0];
export function businessFail(
  message: string,
  code: "BAD_REQUEST" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" = "BAD_REQUEST"
): never {
  throw new TRPCError({ code, message: `business_${message}` });
}
export async function businessDatabase() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "business_unavailable",
    });
  return db;
}
// A live SQL predicate, never a cached paid flag. An expiry immediately affects
// groups, promotions and contact links on every application instance.
export function activeProviderPlan(providerId: SQLWrapper) {
  return sql`exists (select 1 from provider_business_accounts paid_plan
    where paid_plan.provider_id = ${providerId} and paid_plan.status = 'active'
    and paid_plan.starts_at <= current_timestamp(3) and paid_plan.ends_at > current_timestamp(3))`;
}
export async function lockedBusinessProvider(
  tx: BusinessTransaction,
  providerId: number
) {
  const [provider] = await tx
    .select({
      id: providerRecords.id,
      name: providerRecords.name,
      slug: providerRecords.slug,
      websiteUrl: providerRecords.websiteUrl,
      status: providerRecords.status,
    })
    .from(providerRecords)
    .where(eq(providerRecords.id, providerId))
    .for("update");
  if (!provider) businessFail("missing", "NOT_FOUND");
  return provider;
}
export async function lockedBusinessAccount(
  tx: BusinessTransaction,
  providerId: number
) {
  // All callers lock the provider first; this also serializes first-time creation.
  await tx
    .insert(accounts)
    .values({ providerId })
    .onDuplicateKeyUpdate({ set: { providerId } });
  const [account] = await tx
    .select()
    .from(accounts)
    .where(eq(accounts.providerId, providerId))
    .for("update");
  return account;
}
export async function lockedProviderOwner(
  tx: BusinessTransaction,
  auth: MemberAuth,
  providerId: number,
  paid = true
) {
  const member = await lockedAuth(tx, auth);
  if (!member.emailVerifiedAt) businessFail("verify_email", "FORBIDDEN");
  const provider = await lockedBusinessProvider(tx, providerId);
  const account = await lockedBusinessAccount(tx, providerId);
  if (
    provider.status !== "active" ||
    account.ownerMemberId !== member.id ||
    !account.ownershipVerifiedAt ||
    account.ownerHost !== providerHost(provider.websiteUrl)
  )
    businessFail("owner_required", "FORBIDDEN");
  if (paid && !planIsActive(account))
    businessFail("subscription_required", "FORBIDDEN");
  return { member, provider, account };
}
export async function currentProviderTelegram(providerIds: number[]) {
  const db = await businessDatabase();
  if (!providerIds.length) return new Map<number, string | null>();
  const rows = await db
    .select({ id: providerRecords.id, url: providerRecords.telegramUrl })
    .from(providerRecords)
    .where(
      and(
        inArray(providerRecords.id, providerIds),
        visibleCatalogueProvider(),
        activeProviderPlan(providerRecords.id)
      )
    );
  return new Map(rows.map(row => [row.id, providerTelegramUrl(row.url)]));
}
