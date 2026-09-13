import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "node:path";

export async function runMigrations() {
  if (process.env.RUN_DATABASE_MIGRATIONS !== "true") {
    console.log("[Database] Automatic migrations are disabled");
    return { applied: false as const, reason: "disabled" as const };
  }
  if (!process.env.DATABASE_URL) {
    console.warn("[Database] DATABASE_URL is not configured; starting with marketplace fallback data");
    return { applied: false as const, reason: "database_unavailable" as const };
  }
  const db = drizzle(process.env.DATABASE_URL);
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  console.log("[Database] Migrations are up to date");
  return { applied: true as const };
}
