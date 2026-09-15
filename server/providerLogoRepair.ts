import { and, eq, inArray, sql } from "drizzle-orm";
import { importedMedia } from "../drizzle/linkMetadataSchema";
import { providerRecords } from "../drizzle/schema";
import { websiteHome } from "../shared/linkMetadata";
import { getDb } from "./db";
import { invalidateCatalogueCaches } from "./catalogueCache";
import { fetchWebsiteLogo } from "./linkMetadata";
import { sanitizeSvg } from "./linkMetadataParse";
import { writeAudit } from "./marketplaceDb";
import { reserveMemberRequests } from "./memberDb";
import { memberAuthOrigin } from "./memberSecurity";

export function needsLogoRepair(mime: string, content: string) {
  return (
    mime === "image/x-icon" ||
    (mime === "image/svg+xml" &&
      !sanitizeSvg(Buffer.from(content, "base64").toString("utf8")))
  );
}

// Repair only our previously imported broken SVGs and favicon fallbacks.
// Manual URLs, provider text, screenshots and catalogue settings are preserved.
export async function repairImportedProviderLogos() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({
      id: providerRecords.id,
      revision: providerRecords.profileRevision,
      websiteUrl: providerRecords.websiteUrl,
      logoUrl: providerRecords.logoUrl,
      mime: importedMedia.mime,
      content: importedMedia.content,
    })
    .from(providerRecords)
    .innerJoin(
      importedMedia,
      eq(
        sql`CAST(${providerRecords.logoUrl} AS BINARY)`,
        sql`CAST(CONCAT(${memberAuthOrigin() + "/api/imported-media/"}, ${importedMedia.id}) AS BINARY)`
      )
    )
    .where(inArray(importedMedia.mime, ["image/svg+xml", "image/x-icon"]))
    .orderBy(providerRecords.id)
    .limit(20);
  let repaired = 0;
  for (const row of rows) {
    if (!row.websiteUrl || !needsLogoRepair(row.mime, row.content)) continue;
    const source = websiteHome(row.websiteUrl);
    if (!source) continue;
    try {
      await reserveMemberRequests([
        { key: "metadata:logo-repair:v2", limit: 20, windowMs: 86400000 },
        { key: "metadata:fetch", limit: 300, windowMs: 86400000 },
      ]);
    } catch {
      break;
    }
    try {
      const replacement = await fetchWebsiteLogo(source);
      if (!replacement || replacement === row.logoUrl) continue;
      const changed = await db.transaction(async tx => {
        const [current] = await tx
          .select({
            revision: providerRecords.profileRevision,
            logoUrl: providerRecords.logoUrl,
            websiteUrl: providerRecords.websiteUrl,
          })
          .from(providerRecords)
          .where(eq(providerRecords.id, row.id))
          .for("update");
        if (
          !current ||
          current.revision !== row.revision ||
          current.logoUrl !== row.logoUrl ||
          current.websiteUrl !== row.websiteUrl
        )
          return false;
        await tx
          .update(providerRecords)
          .set({
            logoUrl: replacement,
            profileRevision: row.revision + 1,
          })
          .where(
            and(
              eq(providerRecords.id, row.id),
              eq(providerRecords.profileRevision, row.revision)
            )
          );
        await writeAudit(
          {
            action: "provider.logo.repair",
            entityType: "provider",
            entityId: String(row.id),
            summary:
              "Recovered an automatically imported provider logo from its public website",
            metadata: { before: row.logoUrl, after: replacement },
          },
          tx
        );
        return true;
      });
      if (changed) {
        repaired++;
        invalidateCatalogueCaches();
        console.info(
          `[metadata] Repaired imported logo for provider ${row.id}`
        );
      }
    } catch {
      console.warn(`[metadata] Logo repair deferred for provider ${row.id}`);
    }
  }
  return repaired;
}
