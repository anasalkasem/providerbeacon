import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "node:path";

export async function runMigrations() {
  if (process.env.RUN_DATABASE_MIGRATIONS !== "true") {
    console.log("[Database] Automatic migrations are disabled");
    return { applied: false as const, reason: "disabled" as const };
  }
  if (!process.env.DATABASE_URL) {
    console.warn("[Database] DATABASE_URL is not configured; public catalogue will be unavailable");
    return { applied: false as const, reason: "database_unavailable" as const };
  }
  const db = drizzle(process.env.DATABASE_URL);
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  const { ensureCanonicalProviderDrafts, seedMarketplaceIfEmpty } = await import("./marketplaceDb");
  const seed = await seedMarketplaceIfEmpty();
  const canonicalProviders = await ensureCanonicalProviderDrafts();
  console.log("[Database] Migrations are up to date; seed status:", seed.reason ?? "seeded", "canonical provider drafts:", canonicalProviders.created);
  return { applied: true as const, seed, canonicalProviders };
}
