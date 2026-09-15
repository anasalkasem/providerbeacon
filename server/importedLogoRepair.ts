import { and, eq } from "drizzle-orm";
import { auditEntries, providerRecords } from "../drizzle/schema";
import { websiteHome, type LinkMetadata } from "../shared/linkMetadata";
import { getDb } from "./db";
import { invalidateCatalogueCaches } from "./catalogueCache";

/** Repair only the exact imported image still saved against the same source. */
export async function repairImportedLogo(
  previous: LinkMetadata,
  next: LinkMetadata
) {
  if (
    previous.kind !== "website" ||
    previous.sourceUrl !== next.sourceUrl ||
    !previous.logoUrl ||
    !next.logoUrl ||
    previous.logoUrl === next.logoUrl ||
    !/^https:\/\/[^/]+\/api\/imported-media\/[a-f0-9]{64}$/.test(
      previous.logoUrl
    )
  )
    return 0;
  const db = await getDb();
  if (!db) return 0;
  const changed = await db.transaction(async tx => {
    const candidates = await tx
      .select({
        id: providerRecords.id,
        websiteUrl: providerRecords.websiteUrl,
        revision: providerRecords.profileRevision,
      })
      .from(providerRecords)
      .where(eq(providerRecords.logoUrl, previous.logoUrl!))
      .limit(50)
      .for("update");
    let repaired = 0;
    for (const provider of candidates) {
      if (
        !provider.websiteUrl ||
        websiteHome(provider.websiteUrl) !== next.sourceUrl
      )
        continue;
      await tx
        .update(providerRecords)
        .set({ logoUrl: next.logoUrl, profileRevision: provider.revision + 1 })
        .where(
          and(
            eq(providerRecords.id, provider.id),
            eq(providerRecords.profileRevision, provider.revision)
          )
        );
      await tx
        .insert(auditEntries)
        .values({
          action: "provider.logo.repair",
          entityType: "provider",
          entityId: String(provider.id),
          summary: "Repaired an automatically imported provider logo",
          metadata: {
            before: { logoUrl: previous.logoUrl, revision: provider.revision },
            after: { logoUrl: next.logoUrl, revision: provider.revision + 1 },
            sourceUrl: next.sourceUrl,
          },
        });
      repaired++;
    }
    return repaired;
  });
  if (changed) invalidateCatalogueCaches();
  return changed;
}
