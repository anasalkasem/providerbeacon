import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { providerRecords } from "../drizzle/schema";
import {
  providerAnalyticsDaily as daily,
  providerAnalyticsDedupe as dedupe,
  providerAnalyticsLimits as limits,
  providerAnalyticsState,
} from "../drizzle/analyticsSchema";
import {
  ANALYTICS_DAY_MS,
  ANALYTICS_REPEAT_MS,
  analyticsDate,
  analyticsPeriod,
  providerAnalyticsInput,
  type ProviderEvent,
} from "../shared/providerAnalytics";
import {
  publicProfileUrl,
  providerTelegramUrl,
} from "../shared/providerProfile";
import { visibleCatalogueProvider } from "./apiCatalogue";
import { getDb } from "./db";
import {
  activeProviderPlan,
  type BusinessTransaction,
} from "./providerEntitlements";

export async function reserveAnalyticsBudget(
  tx: BusinessTransaction,
  keys: { clientKey: string },
  now: number
) {
  const day = Math.floor(now / ANALYTICS_DAY_MS);
  // Database limits and row locks also apply across replicas and restarts.
  for (const bucket of [
    {
      key: `day:${keys.clientKey}`,
      max: 1000,
      expiry: (day + 2) * ANALYTICS_DAY_MS,
    },
    {
      key: `minute:${Math.floor(now / 60_000)}:${keys.clientKey}`,
      max: 60,
      expiry: now + 120_000,
    },
  ]) {
    await tx
      .insert(limits)
      .values({ key: bucket.key, expiresAt: new Date(bucket.expiry) })
      .onDuplicateKeyUpdate({ set: { key: bucket.key } });
    const [result] = await tx
      .update(limits)
      .set({ used: sql`${limits.used} + 1` })
      .where(and(eq(limits.key, bucket.key), lt(limits.used, bucket.max)));
    if (result.affectedRows !== 1) return false;
  }
  return true;
}

export async function recordProviderEvent(
  input: ProviderEvent,
  keys: { visitorKey: string; clientKey: string },
  now = Date.now()
) {
  const db = await getDb();
  if (!db) return "ignored";
  const day = Math.floor(now / ANALYTICS_DAY_MS);
  return db.transaction(async tx => {
    if (!(await reserveAnalyticsBudget(tx, keys, now))) return "limited";
    const [provider] = await tx
      .select({
        websiteUrl: providerRecords.websiteUrl,
        telegramUrl: providerRecords.telegramUrl,
      })
      .from(providerRecords)
      .where(
        and(
          eq(providerRecords.id, input.providerId),
          visibleCatalogueProvider(),
          input.kind === "telegram"
            ? activeProviderPlan(providerRecords.id)
            : undefined
        )
      )
      .limit(1);
    if (
      !provider ||
      (input.kind === "website" && !publicProfileUrl(provider.websiteUrl)) ||
      (input.kind === "telegram" && !providerTelegramUrl(provider.telegramUrl))
    )
      return "ignored";

    // Millisecond timestamp columns preserve the rolling boundary and prevent
    // MySQL from rounding a first event forward into the duplicate window.
    const identity = {
      providerId: input.providerId,
      visitorKey: keys.visitorKey,
      kind: input.kind,
    };
    const condition = and(
      eq(dedupe.providerId, input.providerId),
      eq(dedupe.visitorKey, keys.visitorKey),
      eq(dedupe.kind, input.kind)
    );
    await tx
      .insert(dedupe)
      .values({
        ...identity,
        lastCountedAt: new Date(now - ANALYTICS_REPEAT_MS),
        expiresAt: new Date((day + 2) * ANALYTICS_DAY_MS),
      })
      .onDuplicateKeyUpdate({ set: { kind: input.kind } });
    const [previous] = await tx
      .select({ lastCountedAt: dedupe.lastCountedAt })
      .from(dedupe)
      .where(condition)
      .for("update");
    if (previous.lastCountedAt.getTime() > now - ANALYTICS_REPEAT_MS)
      return "duplicate";
    await tx
      .update(dedupe)
      .set({ lastCountedAt: new Date(now) })
      .where(condition);

    const counts = {
      views: input.kind === "view" ? 1 : 0,
      website: input.kind === "website" ? 1 : 0,
      telegram: input.kind === "telegram" ? 1 : 0,
    };
    await tx
      .insert(daily)
      .values({
        providerId: input.providerId,
        day: analyticsDate(now),
        ...counts,
      })
      .onDuplicateKeyUpdate({
        set: {
          views: sql`${daily.views} + ${counts.views}`,
          website: sql`${daily.website} + ${counts.website}`,
          telegram: sql`${daily.telegram} + ${counts.telegram}`,
        },
      });
    return "counted";
  });
}

const sums = () => ({
  views: sql<number>`coalesce(sum(${daily.views}), 0)`.mapWith(Number),
  website: sql<number>`coalesce(sum(${daily.website}), 0)`.mapWith(Number),
  telegram: sql<number>`coalesce(sum(${daily.telegram}), 0)`.mapWith(Number),
});

export async function getProviderAnalytics(
  input: z.infer<typeof providerAnalyticsInput>,
  now = Date.now(),
  transaction?: BusinessTransaction
) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "ANALYTICS_UNAVAILABLE",
    });
  const period = analyticsPeriod(input.days, now);
  const filter = input.providerId
    ? eq(providerRecords.id, input.providerId)
    : undefined;
  const dates = and(gte(daily.day, period.start), lte(daily.day, period.end));
  // One repeatable-read snapshot keeps the cards, chart, pagination and rows consistent.
  const read = async (tx: BusinessTransaction) => {
    const [state] = await tx
      .select()
      .from(providerAnalyticsState)
      .where(eq(providerAnalyticsState.id, 1));
    const [totals] = await tx
      .select(sums())
      .from(daily)
      .where(
        and(
          dates,
          input.providerId ? eq(daily.providerId, input.providerId) : undefined
        )
      );
    const series = await tx
      .select({ day: daily.day, ...sums() })
      .from(daily)
      .where(
        and(
          dates,
          input.providerId ? eq(daily.providerId, input.providerId) : undefined
        )
      )
      .groupBy(daily.day)
      .orderBy(daily.day);
    const [count] = await tx
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(providerRecords)
      .where(filter);
    const pageSize = 25;
    const pageCount = Math.max(1, Math.ceil(count.total / pageSize));
    const page = Math.min(input.page, pageCount);
    const rows = await tx
      .select({
        id: providerRecords.id,
        name: providerRecords.name,
        slug: providerRecords.slug,
        ...sums(),
      })
      .from(providerRecords)
      .leftJoin(daily, and(eq(daily.providerId, providerRecords.id), dates))
      .where(filter)
      .groupBy(providerRecords.id, providerRecords.name, providerRecords.slug)
      .orderBy(
        desc(sql`coalesce(sum(${daily.website} + ${daily.telegram}), 0)`),
        desc(sql`coalesce(sum(${daily.views}), 0)`),
        providerRecords.id
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const byDate = new Map(series.map(row => [row.day, row]));
    return {
      startedAt: state?.startedAt ?? null,
      collectionEnabled: Boolean(process.env.AUTH_PEPPER),
      generatedAt: new Date(now),
      from: period.start,
      to: period.end,
      totals,
      daily: period.dates.map(day => ({
        measured: Boolean(
          state && day >= analyticsDate(state.startedAt.getTime())
        ),
        ...(byDate.get(day) ?? { day, views: 0, website: 0, telegram: 0 }),
      })),
      providers: rows,
      totalProviders: count.total,
      page,
      pageCount,
    };
  };
  return transaction
    ? read(transaction)
    : db.transaction(read, { isolationLevel: "repeatable read" });
}

export async function cleanupProviderAnalytics(now = Date.now()) {
  const db = await getDb();
  if (!db) return;
  // Bound each deletion. Short-lived digests expire within two UTC days;
  // aggregate counts remain for 13 months, independently of visitor identifiers.
  await db
    .delete(dedupe)
    .where(lte(dedupe.expiresAt, new Date(now)))
    .limit(10_000);
  await db
    .delete(limits)
    .where(lte(limits.expiresAt, new Date(now)))
    .limit(10_000);
  await db
    .delete(daily)
    .where(lt(daily.day, analyticsDate(now - 400 * ANALYTICS_DAY_MS)))
    .limit(10_000);
  const { cleanupVipAnalytics } = await import("./providerVipDb");
  await cleanupVipAnalytics(now);
}

export function startProviderAnalyticsCleanup() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await cleanupProviderAnalytics();
    } catch {
      console.warn("[Provider analytics] Cleanup will be retried");
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), 60 * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
