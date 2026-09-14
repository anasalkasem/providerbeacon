import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { and, eq, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { assistantUsageBuckets } from "../drizzle/schema";
import { getDb } from "./db";
import type { TrpcContext } from "./_core/context";

export function assistantClientKey(req: TrpcContext["req"]) {
  const secret = process.env.AUTH_PEPPER;
  if (!secret)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "AI_UNAVAILABLE",
    });
  // Railway's public edge supplies X-Real-IP. Other deployments use the socket
  // address until their own trusted proxy is explicitly configured.
  const forwarded = process.env.RAILWAY_PROJECT_ID
    ? req.headers["x-real-ip"]
    : undefined;
  const address = typeof forwarded === "string" ? forwarded.trim() : undefined;
  const ip =
    address && isIP(address)
      ? address
      : (req.socket?.remoteAddress ?? "unknown");
  return createHmac("sha256", secret)
    .update(`beacon-assistant:${ip}`)
    .digest("hex");
}

export function assertAssistantOrigin(req: TrpcContext["req"]) {
  if (req.headers["sec-fetch-site"] === "cross-site")
    throw new TRPCError({ code: "FORBIDDEN", message: "AI_ORIGIN" });
  const origin = req.headers.origin;
  if (!origin) return;
  try {
    if (new URL(origin).host === req.headers.host) return;
  } catch {
    /* reject malformed origins */
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "AI_ORIGIN" });
}

export function assistantBuckets(clientKey: string, now: number) {
  const minute = Math.floor(now / 60000);
  const day = Math.floor(now / 86400000);
  const configured = Number(process.env.BEACON_AI_DAILY_LIMIT ?? 500);
  const dailyLimit =
    Number.isSafeInteger(configured) && configured > 0
      ? Math.min(configured, 10000)
      : 500;
  return [
    {
      key: `global:${day}`,
      limit: dailyLimit,
      expiresAt: new Date((day + 2) * 86400000),
    },
    {
      key: `day:${day}:${clientKey}`,
      limit: 60,
      expiresAt: new Date((day + 2) * 86400000),
    },
    {
      key: `minute:${minute}:${clientKey}`,
      limit: 8,
      expiresAt: new Date((minute + 3) * 60000),
    },
  ];
}

let nextCleanup = 0;
export async function reserveAssistantTurn(
  clientKey: string,
  now = Date.now()
) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "AI_UNAVAILABLE",
    });
  await db.transaction(async tx => {
    // Fixed lock order and conditional increments enforce the global cap across
    // concurrent requests, replicas and restarts. Failed reservations roll back.
    for (const bucket of assistantBuckets(clientKey, now)) {
      await tx
        .insert(assistantUsageBuckets)
        .values({ key: bucket.key, used: 0, expiresAt: bucket.expiresAt })
        .onDuplicateKeyUpdate({ set: { key: bucket.key } });
      const [result] = await tx
        .update(assistantUsageBuckets)
        .set({ used: sql`${assistantUsageBuckets.used} + 1` })
        .where(
          and(
            eq(assistantUsageBuckets.key, bucket.key),
            lt(assistantUsageBuckets.used, bucket.limit)
          )
        );
      if (result.affectedRows !== 1)
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "AI_LIMIT" });
    }
  });
  if (now > nextCleanup) {
    nextCleanup = now + 3600000;
    void db
      .execute(
        sql`delete from ${assistantUsageBuckets} where ${assistantUsageBuckets.expiresAt} < ${new Date(now)} limit 2000`
      )
      .catch(() => {});
  }
}

let active = 0;
export function enterAssistant() {
  if (active >= 4)
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "AI_BUSY" });
  active++;
  let released = false;
  return () => {
    if (!released) {
      active--;
      released = true;
    }
  };
}
