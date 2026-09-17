import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { auditEntries, siteAppearance } from "../drizzle/schema";
import { getDb } from "./db";

async function database() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "appearance_unavailable",
    });
  return db;
}

export async function readSiteAppearance() {
  const db = await database();
  const [row] = await db
    .select()
    .from(siteAppearance)
    .where(eq(siteAppearance.id, 1))
    .limit(1);
  if (!row)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "appearance_unavailable",
    });
  return { edgeGlowEnabled: row.edgeGlowEnabled, revision: row.revision };
}

export async function updateSiteAppearance(
  actorId: number,
  input: { edgeGlowEnabled: boolean; revision: number }
) {
  const db = await database();
  return db.transaction(async tx => {
    const [row] = await tx
      .select()
      .from(siteAppearance)
      .where(eq(siteAppearance.id, 1))
      .limit(1)
      .for("update");
    if (!row)
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "appearance_unavailable",
      });
    if (row.revision !== input.revision)
      throw new TRPCError({ code: "CONFLICT", message: "appearance_changed" });
    if (row.edgeGlowEnabled === input.edgeGlowEnabled)
      return { edgeGlowEnabled: row.edgeGlowEnabled, revision: row.revision };
    const result = {
      edgeGlowEnabled: input.edgeGlowEnabled,
      revision: row.revision + 1,
    };
    await tx.update(siteAppearance).set(result).where(eq(siteAppearance.id, 1));
    await tx.insert(auditEntries).values({
      actorUserId: actorId,
      action: "appearance.edge_glow_changed",
      entityType: "site",
      entityId: "1",
      summary: input.edgeGlowEnabled
        ? "Enabled the site edge glow"
        : "Disabled the site edge glow",
      metadata: { before: row.edgeGlowEnabled, after: input.edgeGlowEnabled },
    });
    return result;
  });
}
