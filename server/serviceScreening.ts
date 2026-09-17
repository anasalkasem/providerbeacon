import { screeningQueued } from "./catalogueRules";
import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import {
  providerRecords as providers,
  serviceRecords as services,
} from "../drizzle/schema";
import { screeningControl as control } from "../drizzle/trustSchema";
import { screeningDecisionInput } from "../shared/serviceScreening";
import { getDb } from "./db";
import {
  assistantAvailable,
  assistantJson,
  assistantModelName,
  AssistantModelError,
} from "./assistantModel";
import { invalidateCatalogueCaches } from "./catalogueCache";
import { writeAudit } from "./marketplaceDb";
import {
  deterministicScreening,
  screeningContent,
  screeningInstructions,
  screeningResponse,
  validatedScreeningDecisions,
  type ScreeningDecision,
} from "./serviceScreeningPolicy";

async function database() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}
const queued = screeningQueued;
const eligible = () =>
  and(ne(services.status, "archived"), eq(providers.status, "active"));
export function screeningDailyLimit() {
  const n = Number(process.env.BEACON_SCREENING_DAILY_REQUESTS ?? 2400);
  return Number.isInteger(n) && n >= 1 && n <= 4000 ? n : 2400;
}
async function initialize() {
  const db = await database();
  await db
    .insert(control)
    .values({ id: 1 })
    .onDuplicateKeyUpdate({ set: { id: 1 } });
  return db;
}
export async function serviceScreeningSummary() {
  const db = await initialize();
  const [settings] = await db.select().from(control).where(eq(control.id, 1));
  const [counts] = await db
    .select({
      total: count(),
      queued: sql<number>`coalesce(sum(${queued()}), 0)`.mapWith(Number),
      held: sql<number>`coalesce(sum(${services.screeningStatus} = 'held'), 0)`.mapWith(
        Number
      ),
      review:
        sql<number>`coalesce(sum(${services.screeningStatus} = 'review'), 0)`.mapWith(
          Number
        ),
      checked:
        sql<number>`coalesce(sum(${services.screeningCheckedAt} is not null), 0)`.mapWith(
          Number
        ),
      errors:
        sql<number>`coalesce(sum(${services.screeningError} is not null), 0)`.mapWith(
          Number
        ),
    })
    .from(services)
    .innerJoin(providers, eq(providers.id, services.providerId))
    .where(eligible());
  return {
    ...counts,
    enabled: settings.enabled,
    configured: assistantAvailable(),
    workerEnabled: process.env.BEACON_SERVICE_SCREENING_ENABLED !== "false",
    lastRunAt: settings.lastRunAt,
    lastError: settings.lastError,
    requestsToday:
      settings.budgetDay === new Date().toISOString().slice(0, 10)
        ? settings.requestsUsed
        : 0,
    dailyLimit: screeningDailyLimit(),
  };
}
export async function setServiceScreeningEnabled(
  enabled: boolean,
  actorUserId: number
) {
  const db = await initialize();
  await db.transaction(async tx => {
    await tx.update(control).set({ enabled }).where(eq(control.id, 1));
    await writeAudit(
      {
        actorUserId,
        action: "services.screening.toggle",
        entityType: "screening",
        entityId: "1",
        summary: enabled
          ? "Enabled automatic service screening"
          : "Paused automatic service screening; existing holds retained",
      },
      tx
    );
  });
  return { enabled };
}
export async function decideServiceScreening(
  input: z.infer<typeof screeningDecisionInput>,
  actorUserId: number
) {
  input = screeningDecisionInput.parse(input);
  const db = await database();
  await db.transaction(async tx => {
    const [ref] = await tx
      .select({ providerId: services.providerId })
      .from(services)
      .where(eq(services.id, input.id));
    if (!ref) throw new TRPCError({ code: "NOT_FOUND" });
    await tx
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.id, ref.providerId))
      .for("update");
    const [row] = await tx
      .select()
      .from(services)
      .where(eq(services.id, input.id))
      .for("update");
    if (!row || row.revision !== input.revision)
      throw new TRPCError({ code: "CONFLICT", message: "review_conflict" });
    // Releasing an AI hold never makes missing/invalid source values publishable.
    if (input.action === "release" && deterministicScreening(row))
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "screening_fix_source_first",
      });
    const revision = row.revision + 1;
    await tx
      .update(services)
      .set({
        revision,
        screeningStatus:
          input.action === "retry"
            ? row.screeningStatus
            : input.action === "release"
              ? "manual_clear"
              : "held",
        screeningRevision: input.action === "retry" ? 0 : revision,
        screeningCheckedAt:
          input.action === "retry" ? row.screeningCheckedAt : new Date(),
        screeningNextAt: null,
        screeningAttempts: 0,
        screeningError: null,
        ...(input.action === "retry" && row.screeningModel === "manual"
          ? { screeningModel: null }
          : {}),
        ...(input.action !== "retry"
          ? { screeningEvidence: input.reason, screeningModel: "manual" }
          : {}),
      })
      .where(eq(services.id, row.id));
    await writeAudit(
      {
        actorUserId,
        action: `service.screening.${input.action}`,
        entityType: "service",
        entityId: String(row.id),
        summary: input.reason,
        metadata: { revision, before: row.screeningStatus },
      },
      tx
    );
  });
  invalidateCatalogueCaches();
  return { ok: true };
}

// Calls happen outside transactions. Revision checks discard any result whose
// source or human review changed while the model was running.
export async function runServiceScreeningStep() {
  const db = await initialize();
  const token = randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  const claimed = await db.transaction(async tx => {
    const [settings] = await tx
      .select()
      .from(control)
      .where(eq(control.id, 1))
      .for("update");
    if (
      !settings.enabled ||
      (settings.leaseUntil && settings.leaseUntil > new Date())
    )
      return false;
    const used = settings.budgetDay === day ? settings.requestsUsed : 0;
    const error = !assistantAvailable()
      ? "unconfigured"
      : used >= screeningDailyLimit()
        ? "daily_limit"
        : null;
    await tx
      .update(control)
      .set({
        budgetDay: day,
        requestsUsed: used,
        lastError: error,
        leaseToken: error ? null : token,
        leaseUntil: new Date(Date.now() + (error ? 60000 : 180000)),
      })
      .where(eq(control.id, 1));
    return !error;
  });
  if (!claimed) return false;
  let failed = false;
  let rows: (typeof services.$inferSelect)[] = [];
  try {
    rows = (
      await db
        .select({ service: services })
        .from(services)
        .innerJoin(providers, eq(providers.id, services.providerId))
        .where(
          and(
            eligible(),
            queued(),
            or(
              isNull(services.screeningNextAt),
              lte(services.screeningNextAt, new Date())
            )
          )
        )
        .orderBy(asc(services.screeningCheckedAt), asc(services.id))
        .limit(8)
    ).map(r => r.service);
    if (!rows.length) return false;
    const decisions: ScreeningDecision[] = [];
    const aiRows = rows.filter(row => {
      const result = deterministicScreening(row);
      if (result) decisions.push(result);
      return !result;
    });
    if (aiRows.length) {
      const reserved = await db
        .update(control)
        .set({ requestsUsed: sql`${control.requestsUsed} + 1` })
        .where(
          and(
            eq(control.id, 1),
            eq(control.leaseToken, token),
            eq(control.enabled, true)
          )
        );
      if (!reserved[0].affectedRows) return false;
      const response = await assistantJson(
        "service_content_screening",
        screeningResponse,
        screeningInstructions,
        JSON.stringify(aiRows.map(screeningContent))
      );
      decisions.push(...validatedScreeningDecisions(aiRows, response));
    }
    await db.transaction(async tx => {
      const [lease] = await tx
        .select()
        .from(control)
        .where(eq(control.id, 1))
        .for("update");
      if (
        !lease.enabled ||
        lease.leaseToken !== token ||
        !lease.leaseUntil ||
        lease.leaseUntil <= new Date()
      )
        return;
      const ids = Array.from(new Set(rows.map(r => r.providerId))).sort(
        (a, b) => a - b
      );
      await tx
        .select({ id: providers.id })
        .from(providers)
        .where(inArray(providers.id, ids))
        .orderBy(asc(providers.id))
        .for("update");
      for (const row of [...rows].sort((a, b) => a.id - b.id)) {
        const [current] = await tx
          .select({
            revision: services.revision,
            status: services.screeningStatus,
          })
          .from(services)
          .where(eq(services.id, row.id))
          .for("update");
        if (!current || current.revision !== row.revision) continue;
        const result = decisions.find(item => item.id === row.id)!;
        // A low-confidence recheck cannot silently lift an existing hold.
        const status =
          current.status === "held" && result.status === "review"
            ? "held"
            : result.status;
        await tx
          .update(services)
          .set({
            screeningStatus: status,
            screeningReason: result.reason,
            screeningEvidence: result.evidence,
            screeningCheckedAt: new Date(),
            screeningModel: deterministicScreening(row)
              ? "rules-v1"
              : assistantModelName().slice(0, 100),
            screeningRevision: row.revision + 1,
            revision: row.revision + 1,
            screeningError: null,
            screeningNextAt: null,
            screeningAttempts: 0,
          })
          .where(eq(services.id, row.id));
        if (status !== "clear" || current.status === "held")
          await writeAudit(
            {
              action: "service.screening.result",
              entityType: "service",
              entityId: String(row.id),
              summary: `Content screening: ${status} (${result.reason})`,
              metadata: {
                revision: row.revision + 1,
                evidence: result.evidence,
                before: current.status,
              },
            },
            tx
          );
      }
    });
    invalidateCatalogueCaches();
    return true;
  } catch (error) {
    failed = true;
    const code =
      error instanceof AssistantModelError
        ? error.kind
        : "screening_unavailable";
    for (const row of rows)
      await db
        .update(services)
        .set({
          screeningError: code,
          screeningAttempts: row.screeningAttempts + 1,
          screeningNextAt: new Date(
            Date.now() +
              Math.min(
                21600000,
                300000 * 2 ** Math.min(row.screeningAttempts, 6)
              )
          ),
        })
        .where(
          and(eq(services.id, row.id), eq(services.revision, row.revision))
        );
    await db
      .update(control)
      .set({ lastError: code })
      .where(and(eq(control.id, 1), eq(control.leaseToken, token)));
    console.warn("[Service screening] Batch deferred:", code);
    return false;
  } finally {
    await db
      .update(control)
      .set({
        leaseToken: null,
        leaseUntil: failed ? new Date(Date.now() + 120000) : null,
        lastRunAt: new Date(),
      })
      .where(and(eq(control.id, 1), eq(control.leaseToken, token)));
  }
}
export function startServiceScreeningWorker() {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.BEACON_SERVICE_SCREENING_ENABLED === "false"
  )
    return () => {};
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const tick = async () => {
    try {
      await runServiceScreeningStep();
    } catch {
      console.warn("[Service screening] Worker will retry");
    }
    if (!stopped) {
      timer = setTimeout(tick, 5000);
      timer.unref();
    }
  };
  timer = setTimeout(tick, 10000);
  timer.unref();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
