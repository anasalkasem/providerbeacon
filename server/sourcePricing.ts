import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { asc, eq, inArray } from "drizzle-orm";
import { providerRecords, serviceRecords } from "../drizzle/schema";
import { priceCurrencies, type PriceCurrency } from "../shared/pricing";
import { sourcePricingInput } from "../shared/sourcePricing";
import type { z } from "zod";
import { getDb } from "./db";
import { writeAudit } from "./marketplaceDb";

// Price/quantity updates do not change the meaning of an already checked unit.
// A renamed/retyped service, currency, account endpoint or source unit claim does.
export function sourcePricingIdentity(
  source: Record<string, unknown> | null,
  currency: string | null,
  endpoint: string | null,
  unit?: string | null
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        endpoint,
        currency,
        ...[
          "service",
          "id",
          "name",
          "category",
          "type",
          "unit",
          "currency",
        ].map(key => source?.[key] ?? null),
        ...(unit === "package"
          ? [source?.min ?? null, source?.max ?? null]
          : []),
      ])
    )
    .digest("hex");
}

export async function confirmSourcePricing(
  raw: z.input<typeof sourcePricingInput> & {
    actorUserId: number;
    ipAddress?: string;
  }
) {
  const input = sourcePricingInput.parse(raw);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const ids = input.items.map(item => item.id).sort((a, b) => a - b);
    const owners = await tx
      .select({ id: serviceRecords.providerId })
      .from(serviceRecords)
      .where(inArray(serviceRecords.id, ids));
    if (!owners.length)
      throw new TRPCError({ code: "CONFLICT", message: "review_conflict" });
    await tx
      .select({ id: providerRecords.id })
      .from(providerRecords)
      .where(
        inArray(providerRecords.id, Array.from(new Set(owners.map(p => p.id))))
      )
      .orderBy(asc(providerRecords.id))
      .for("update");
    const rows = await tx
      .select()
      .from(serviceRecords)
      .where(inArray(serviceRecords.id, ids))
      .orderBy(asc(serviceRecords.id))
      .for("update");
    if (
      rows.length !== ids.length ||
      rows.some(
        row =>
          input.items.find(item => item.id === row.id)?.revision !==
          row.revision
      )
    )
      throw new TRPCError({ code: "CONFLICT", message: "review_conflict" });
    if (
      rows.some(
        row =>
          row.sourceKind !== "provider_api" ||
          (input.unit &&
            (!row.sourceData ||
              !row.sourceUrl ||
              !row.available ||
              !row.sourceUpdatedAt ||
              !priceCurrencies.includes(row.sourceCurrency as PriceCurrency)))
      )
    )
      throw new TRPCError({ code: "BAD_REQUEST", message: "review_not_ready" });
    for (const before of rows) {
      const after = {
        sourcePricingMode: input.unit ? "manual" as const : "blocked" as const,
        sourcePriceUnit: input.unit,
        sourcePackageDescription:
          input.unit === "package" ? input.packageDescription : null,
        sourcePricingEvidenceUrl: input.unit ? input.evidenceUrl : null,
        sourcePricingConfirmedAt: input.unit ? new Date() : null,
        sourcePricingIdentity: input.unit
          ? sourcePricingIdentity(
              before.sourceData,
              before.sourceCurrency,
              before.sourceUrl,
              input.unit
            )
          : null,
        revision: before.revision + 1,
      };
      await tx
        .update(serviceRecords)
        .set(after)
        .where(eq(serviceRecords.id, before.id));
      await writeAudit(
        {
          actorUserId: raw.actorUserId,
          ipAddress: raw.ipAddress,
          action: input.unit
            ? "service.source_pricing.confirm"
            : "service.source_pricing.revoke",
          entityType: "service",
          entityId: String(before.id),
          summary: input.unit
            ? "Confirmed original API pricing unit"
            : "Revoked original API pricing unit",
          metadata: {
            reason: input.reason,
            sourceRate: before.sourceRate,
            sourceCurrency: before.sourceCurrency,
            before: Object.fromEntries(
              Object.keys(after).map(key => [
                key,
                before[key as keyof typeof before],
              ])
            ),
            after,
          },
        },
        tx
      );
    }
    return { success: true, count: rows.length };
  });
}
