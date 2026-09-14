import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import { providerRecords, serviceRecords } from "../drizzle/schema";
import { sameSourceHost, sourcedBatchInput } from "../shared/sourcedOffers";
import { getDb } from "./db";
import { assertPublicHttpsUrl, writeAudit } from "./marketplaceDb";
import { NORMALIZATION_VERSION } from "./serviceNormalizer";

export async function createSourcedDrafts(raw: z.input<typeof sourcedBatchInput> & { actorUserId: number; ipAddress?: string }) {
  const input = sourcedBatchInput.parse(raw);
  for (const source of Array.from(new Set(input.offers.map(offer => offer.sourceUrl)))) await assertPublicHttpsUrl(source);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const [provider] = await tx.select().from(providerRecords).where(eq(providerRecords.id, input.providerId)).for("update");
    if (!provider?.websiteUrl || input.offers.some(offer => !sameSourceHost(provider.websiteUrl!, offer.sourceUrl))) throw new TRPCError({ code: "BAD_REQUEST", message: "Evidence must be on the provider's official website" });
    const created: number[] = [];
    const skipped: number[] = [];
    for (const offer of input.offers) {
      const externalId = `web:${offer.slug}`;
      const [existing] = await tx.select({ id: serviceRecords.id }).from(serviceRecords).where(and(eq(serviceRecords.providerId, provider.id), eq(serviceRecords.externalId, externalId))).limit(1);
      if (existing) { skipped.push(existing.id); continue; }
      const sourceData = { ...offer, billingCycle: "monthly" };
      const [inserted] = await tx.insert(serviceRecords).values({
        providerId: provider.id, externalId, slug: offer.slug, name: offer.name,
        platform: offer.platform, category: offer.category, priceAmount: offer.price.toFixed(4), sourceRate: String(offer.price),
        priceCurrency: offer.currency, priceUnit: "package", packageDescription: offer.scope,
        minOrder: 1, maxOrder: 1, refillMode: "unknown", sourceKind: "public_web",
        sourceData, originalSourceData: sourceData, sourceHash: createHash("sha256").update(JSON.stringify(sourceData)).digest("hex"),
        sourceUrl: offer.sourceUrl, evidenceUrl: offer.sourceUrl, sourceUpdatedAt: new Date(),
        normalizationVersion: NORMALIZATION_VERSION, classificationNotes: [],
        status: "draft", reviewStatus: "pending", pricingConfirmed: false, policyReviewed: false, incomplete: true,
        reviewReason: input.reason,
      }).$returningId();
      created.push(inserted!.id);
    }
    await writeAudit({ actorUserId: raw.actorUserId, ipAddress: raw.ipAddress, action: "service.source.drafts", entityType: "provider", entityId: String(provider.id), summary: `Created ${created.length} public-source offer drafts`, metadata: { reason: input.reason, created, skipped, offers: input.offers } }, tx);
    return { created, skipped };
  });
}
