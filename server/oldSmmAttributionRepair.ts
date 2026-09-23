import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { providerIntegrations, providerRecords, providerSyncJobs, serviceRecords } from "../drizzle/schema";
import { sourceHost } from "../shared/providerSourceIdentity";
import { invalidateCatalogueCaches } from "./catalogueCache";
import { getDb } from "./db";
import { writeAudit } from "./marketplaceDb";

const SOURCE = "https://oldsmm.com/api/v2";
const OBSERVED_COUNT = 26;

// Incident-specific repair established by the live staff source report on
// 2026-09-23. This is deliberately not a general connection-reassignment API.
// Keep all service IDs, price history, source evidence and encrypted credentials.
export async function repairOldSmmAttribution() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.transaction(async tx => {
    const profiles = await tx.select().from(providerRecords)
      .where(inArray(providerRecords.slug, ["justanotherpanel", "oldsmm"]))
      .orderBy(asc(providerRecords.id)).for("update");
    const original = profiles.find(row => row.slug === "justanotherpanel");
    const skipped = (reason: string) => ({ status: "skipped" as const, changed: 0, reason });
    if (!original || sourceHost(original.websiteUrl) !== "justanotherpanel.com" || original.isReviewWorkspace) return skipped("source_profile_not_matched");
    const connections = await tx.select().from(providerIntegrations)
      .where(and(eq(providerIntegrations.providerId, original.id), eq(providerIntegrations.baseUrl, SOURCE)))
      .limit(2).for("update");
    if (!connections.length) return skipped("no_mislinked_connection");
    const connection = connections[0];
    if (connections.length !== 1 || connection.status !== "disabled" || connection.syncLockUntil) return skipped("connection_requires_review");
    const [running] = await tx.select({ id: providerSyncJobs.id }).from(providerSyncJobs)
      .where(inArray(providerSyncJobs.activeProviderId, profiles.map(row => row.id))).limit(1);
    if (running) return skipped("synchronization_in_progress");
    const [evidence] = await tx.select({ id: providerSyncJobs.id }).from(providerSyncJobs)
      .where(and(eq(providerSyncJobs.integrationId, connection.id), eq(providerSyncJobs.providerId, original.id),
        eq(providerSyncJobs.sourceUrl, SOURCE), inArray(providerSyncJobs.status, ["completed", "completed_with_issues"]), gt(providerSyncJobs.processedCount, 0)))
      .limit(1);
    if (!evidence) return skipped("completed_source_evidence_missing");
    const rows = await tx.select().from(serviceRecords)
      .where(and(eq(serviceRecords.providerId, original.id), eq(serviceRecords.sourceKind, "provider_api"), eq(serviceRecords.sourceUrl, SOURCE)))
      .orderBy(asc(serviceRecords.id)).limit(OBSERVED_COUNT + 1).for("update");
    if (rows.length !== OBSERVED_COUNT) return skipped("source_count_changed");
    if (rows.some(row => row.reviewStatus !== "pending" || row.reviewedAt || row.reviewedByUserId || row.reviewReason)) return skipped("human_review_requires_attention");
    let target = profiles.find(row => row.slug === "oldsmm");
    if (target) {
      if (sourceHost(target.websiteUrl) !== "oldsmm.com" || target.status !== "draft" || target.apiCataloguePublished || target.isReviewWorkspace) return skipped("destination_requires_review");
      const [existingService] = await tx.select({ id: serviceRecords.id }).from(serviceRecords).where(eq(serviceRecords.providerId, target.id)).limit(1);
      const [existingConnection] = await tx.select({ id: providerIntegrations.id }).from(providerIntegrations).where(eq(providerIntegrations.providerId, target.id)).limit(1);
      if (existingService || existingConnection) return skipped("destination_not_empty");
    } else {
      const [inserted] = await tx.insert(providerRecords).values({
        slug: "oldsmm", name: "OldSMM", initials: "OS", websiteUrl: "https://oldsmm.com/", status: "draft", verified: false,
        apiCataloguePublished: false, tier: "specialized_partner",
        description: "Provider details are listed from public sources. Service delivery and quality have not been independently verified.",
      }).$returningId();
      [target] = await tx.select().from(providerRecords).where(eq(providerRecords.id, inserted.id)).for("update");
    }
    const serviceIds = rows.map(row => row.id);
    await tx.update(serviceRecords).set({ providerId: target!.id, revision: sql`${serviceRecords.revision} + 1` }).where(inArray(serviceRecords.id, serviceIds));
    // Credential encryption is bound to the unchanged integration ID, not the
    // provider ID. No credential is decrypted, copied or exposed by this repair.
    await tx.update(providerIntegrations).set({ providerId: target!.id }).where(eq(providerIntegrations.id, connection.id));
    await writeAudit({
      action: "integration.source_attribution.repair", entityType: "provider_integration", entityId: String(connection.id),
      summary: "Separated 26 retained OldSMM services and their disabled connection from JustAnotherPanel",
      metadata: { fromProviderId: original.id, toProviderId: target!.id, sourceHost: "oldsmm.com", evidenceJobId: evidence.id,
        serviceIds, connectionEnabled: false, sourcePricesUnchanged: true, priceHistoryPreserved: true },
    }, tx);
    return { status: "repaired" as const, changed: serviceIds.length, targetProviderId: target!.id };
  });
  if (result.changed) invalidateCatalogueCaches();
  return result;
}
