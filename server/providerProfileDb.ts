import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { providerRecords } from "../drizzle/schema";
import {
  providerProfileInput,
  type ProviderProfileInput,
} from "../shared/providerProfile";
import { invalidateCatalogueCaches } from "./catalogueCache";
import { getDb } from "./db";
import { visibleCatalogueProvider } from "./apiCatalogue";
import { assertPublicHttpsUrl, writeAudit } from "./marketplaceDb";

const profileColumns = {
  id: providerRecords.id,
  slug: providerRecords.slug,
  revision: providerRecords.profileRevision,
  isPublic: sql<boolean>`${visibleCatalogueProvider()}`.mapWith(Boolean),
  name: providerRecords.name,
  description: providerRecords.description,
  websiteUrl: providerRecords.websiteUrl,
  logoUrl: providerRecords.logoUrl,
  websitePreviewUrl: providerRecords.websitePreviewUrl,
  telegramUrl: providerRecords.telegramUrl,
};

export async function getProviderProfile(id: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const [profile] = await db
    .select(profileColumns)
    .from(providerRecords)
    .where(eq(providerRecords.id, id));
  if (!profile)
    throw new TRPCError({ code: "NOT_FOUND", message: "PROFILE_NOT_FOUND" });
  return profile;
}

export async function saveProviderProfile({
  input: raw,
  actorUserId,
  ipAddress,
}: {
  input: ProviderProfileInput;
  actorUserId: number;
  ipAddress?: string;
}) {
  const { id, revision, ...values } = providerProfileInput.parse(raw);
  // Validate public destinations without fetching images or sending credentials.
  try {
    await Promise.all(
      Array.from(
        new Set([
          values.websiteUrl,
          values.logoUrl,
          values.websitePreviewUrl,
          values.telegramUrl,
        ])
      )
        .filter((url): url is string => Boolean(url))
        .map(assertPublicHttpsUrl)
    );
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "PROFILE_URL_UNREACHABLE",
    });
  }
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const saved = await db.transaction(async tx => {
    const [before] = await tx
      .select(profileColumns)
      .from(providerRecords)
      .where(eq(providerRecords.id, id))
      .for("update");
    if (!before)
      throw new TRPCError({ code: "NOT_FOUND", message: "PROFILE_NOT_FOUND" });
    if (before.revision !== revision)
      throw new TRPCError({ code: "CONFLICT", message: "PROFILE_CONFLICT" });
    const initials = Array.from(
      values.name
        .split(/\s+/)
        .slice(0, 2)
        .map(word => Array.from(word)[0])
        .join("")
        .toUpperCase()
    )
      .slice(0, 6)
      .join("");
    await tx
      .update(providerRecords)
      .set({ ...values, initials, profileRevision: revision + 1 })
      .where(eq(providerRecords.id, id));
    const after = {
      id,
      slug: before.slug,
      isPublic: before.isPublic,
      revision: revision + 1,
      ...values,
    };
    await writeAudit(
      {
        actorUserId,
        ipAddress,
        action: "provider.profile.update",
        entityType: "provider",
        entityId: String(id),
        summary: "Updated public provider profile",
        metadata: { before, after },
      },
      tx
    );
    return after;
  });
  invalidateCatalogueCaches();
  return saved;
}
