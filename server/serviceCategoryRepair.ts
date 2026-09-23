import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  like,
} from "drizzle-orm";
import { providerRecords, serviceRecords } from "../drizzle/schema";
import { getDb } from "./db";
import { classifyService } from "./serviceNormalizer";
import { writeAudit } from "./marketplaceDb";
import { invalidateCatalogueCaches } from "./catalogueCache";

// Repair the demonstrated "comments from followers accounts" collision only.
// Human-reviewed/edited rows, provider ownership, source prices and timestamps
// remain untouched. Provider locks match the synchronization lock order.
export async function repairCommentCategories(afterId = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const eligible = and(
    gt(serviceRecords.id, afterId),
    eq(serviceRecords.sourceKind, "provider_api"),
    eq(serviceRecords.reviewStatus, "pending"),
    isNull(serviceRecords.reviewReason),
    isNull(serviceRecords.reviewedAt),
    isNotNull(serviceRecords.sourceData),
    eq(serviceRecords.category, "Followers"),
    like(serviceRecords.name, "%comment%"),
    like(serviceRecords.name, "%follow%")
  );
  const result = await db.transaction(async tx => {
    const candidates = await tx
      .select({ id: serviceRecords.id, providerId: serviceRecords.providerId })
      .from(serviceRecords)
      .where(eligible)
      .orderBy(asc(serviceRecords.id))
      .limit(100);
    if (!candidates.length) return { changed: 0, nextId: null };
    const providerIds = Array.from(
      new Set(candidates.map(row => row.providerId))
    ).sort((a, b) => a - b);
    await tx
      .select({ id: providerRecords.id })
      .from(providerRecords)
      .where(inArray(providerRecords.id, providerIds))
      .orderBy(asc(providerRecords.id))
      .for("update");
    const rows = await tx
      .select()
      .from(serviceRecords)
      .where(
        and(
          eligible,
          inArray(
            serviceRecords.id,
            candidates.map(row => row.id)
          )
        )
      )
      .orderBy(asc(serviceRecords.id))
      .for("update");
    const ids: number[] = [];
    for (const row of rows) {
      if (
        !row.sourceData ||
        row.sourceData.name !== row.name ||
        classifyService(row.sourceData).category !== "Comments"
      )
        continue;
      await tx
        .update(serviceRecords)
        .set({ category: "Comments", revision: row.revision + 1 })
        .where(eq(serviceRecords.id, row.id));
      ids.push(row.id);
    }
    if (ids.length)
      await writeAudit(
        {
          action: "service.category.repair",
          entityType: "catalogue",
          entityId: "comments",
          summary: `Corrected ${ids.length} unreviewed comment service categories from retained source titles`,
          metadata: { ids, before: "Followers", after: "Comments" },
        },
        tx
      );
    return { changed: ids.length, nextId: candidates.at(-1)!.id };
  });
  if (result.changed) invalidateCatalogueCaches();
  return result;
}

export async function runCommentCategoryRepair() {
  let afterId = 0;
  let changed = 0;
  for (;;) {
    const batch = await repairCommentCategories(afterId);
    changed += batch.changed;
    if (batch.nextId === null) break;
    afterId = batch.nextId;
  }
  console.log(
    `[Catalogue] Corrected ${changed} unreviewed comment service categories`
  );
  return changed;
}
