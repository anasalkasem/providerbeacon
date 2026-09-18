import { ECDH, randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import webpush from "web-push";
import { pushDevices as devices } from "../drizzle/pushSchema";
import {
  conversations,
  conversationMembers,
  conversationMessages,
} from "../drizzle/messagingSchema";
import { staffSessions, teamMembers } from "../drizzle/schema";
import { decryptValue, encryptValue, hashToken } from "./security";
import { getDb } from "./db";
import {
  pushCopy,
  pushSubscription,
  type pushSubscribeInput,
} from "../shared/push";
import type { z } from "zod";
import type { ChatActor, MessagingTransaction } from "./messagingDb";
import type { MessageLocale } from "../shared/messaging";

type Device = typeof devices.$inferSelect;
export type PushIdentity = {
  actor: string;
  sessionHash: string | null;
  expiresAt: Date;
};
const unavailable = () =>
  new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "push_unavailable" });
async function database() {
  const db = await getDb();
  if (!db) throw unavailable();
  return db;
}
export function pushAvailable() {
  return !!(
    process.env.WEB_PUSH_PUBLIC_KEY &&
    process.env.WEB_PUSH_PRIVATE_KEY &&
    process.env.VAULT_MASTER_KEY
  );
}
export async function pushIdentity(
  actor: ChatActor,
  sessionToken?: string
): Promise<PushIdentity> {
  const db = await database();
  if (actor.kind === "staff") {
    if (!sessionToken)
      throw new TRPCError({ code: "UNAUTHORIZED", message: "push_sign_in" });
    const sessionHash = hashToken(sessionToken);
    const [session] = await db
      .select()
      .from(staffSessions)
      .where(
        and(
          eq(staffSessions.userId, actor.userId),
          eq(staffSessions.tokenHash, sessionHash),
          eq(staffSessions.mfaVerified, true),
          gt(staffSessions.expiresAt, new Date())
        )
      )
      .limit(1);
    if (!session)
      throw new TRPCError({ code: "UNAUTHORIZED", message: "push_sign_in" });
    return {
      actor: `s:${actor.userId}`,
      sessionHash,
      expiresAt: session.expiresAt,
    };
  }
  const [chat] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.visitorKey, actor.key),
        gt(conversations.visitorExpiresAt, new Date())
      )
    )
    .limit(1);
  if (!chat?.visitorExpiresAt)
    throw new TRPCError({ code: "UNAUTHORIZED", message: "messaging_session" });
  return {
    actor: `v:${actor.key}`,
    sessionHash: null,
    expiresAt: chat.visitorExpiresAt,
  };
}
const own = (identity: PushIdentity) =>
  and(
    eq(devices.actor, identity.actor),
    identity.sessionHash
      ? eq(devices.sessionHash, identity.sessionHash)
      : isNull(devices.sessionHash)
  );
export const pushIdentityKey = (identity: PushIdentity) =>
  hashToken(`${identity.actor}:${identity.sessionHash ?? "visitor"}`);
function assertIdentity(identity: PushIdentity, expected: string) {
  if (pushIdentityKey(identity) !== expected)
    throw new TRPCError({ code: "CONFLICT", message: "push_identity_changed" });
}
export async function pushStatus(identity: PushIdentity) {
  const db = await database();
  const rows = await db
    .select({ id: devices.id })
    .from(devices)
    .where(and(own(identity), gt(devices.expiresAt, new Date())))
    .limit(8);
  return {
    identity: pushIdentityKey(identity),
    available: pushAvailable(),
    publicKey: pushAvailable() ? process.env.WEB_PUSH_PUBLIC_KEY! : null,
    devices: rows.map(r => r.id),
  };
}
export function validatePushKeys(
  subscription: z.infer<typeof pushSubscription>
) {
  const key = Buffer.from(subscription.keys.p256dh, "base64url");
  if (
    key.length !== 65 ||
    key[0] !== 4 ||
    Buffer.from(subscription.keys.auth, "base64url").length !== 16
  )
    throw new TRPCError({ code: "BAD_REQUEST", message: "push_key" });
  try {
    ECDH.convertKey(key, "prime256v1");
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "push_key" });
  }
}
export async function subscribePush(
  identity: PushIdentity,
  input: z.infer<typeof pushSubscribeInput>
) {
  if (!pushAvailable()) throw unavailable();
  assertIdentity(identity, input.identity);
  validatePushKeys(input.subscription);
  const db = await database(),
    id = hashToken(input.subscription.endpoint);
  const encrypted = JSON.stringify(
    encryptValue(JSON.stringify(input.subscription), `push:${id}`)
  );
  await db.transaction(async tx => {
    // Serialize the per-account device limit with the authoritative session/chat.
    if (identity.sessionHash)
      await tx
        .select({ id: staffSessions.id })
        .from(staffSessions)
        .where(eq(staffSessions.tokenHash, identity.sessionHash))
        .for("update");
    else
      await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.visitorKey, identity.actor.slice(2)))
        .for("update");
    const rows = await tx
      .select({ id: devices.id })
      .from(devices)
      .where(
        and(
          eq(devices.actor, identity.actor),
          gt(devices.expiresAt, new Date())
        )
      );
    if (rows.length >= 8 && !rows.some(r => r.id === id))
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "push_devices_limit",
      });
    const value = {
      ...identity,
      expiresAt: new Date(
        Math.min(identity.expiresAt.getTime(), Date.now() + 30 * 86400000)
      ),
      encrypted,
      locale: input.locale,
      queuedId: 0,
      sentId: 0,
      nextAt: null,
      lease: null,
      leaseUntil: null,
      attempts: 0,
    };
    await tx
      .insert(devices)
      .values({ id, ...value })
      .onDuplicateKeyUpdate({ set: value });
  });
  return { ok: true };
}
export async function unsubscribePush(
  identity: PushIdentity,
  endpoint: string,
  expected: string
) {
  assertIdentity(identity, expected);
  const db = await database();
  await db
    .delete(devices)
    .where(and(eq(devices.id, hashToken(endpoint)), own(identity)));
  return { ok: true };
}
// Called inside the message transaction: rolled-back/imported/retried messages
// never schedule a push. A device coalesces bursts into its latest unread message.
export async function queueMessagePush(
  tx: MessagingTransaction,
  chat: typeof conversations.$inferSelect,
  message: typeof conversationMessages.$inferSelect
) {
  if (message.imported || message.sender === "assistant") return;
  let actors: string[] = [];
  if (chat.kind === "support") {
    if (message.sender === "staff" && chat.visitorKey)
      actors = [`v:${chat.visitorKey}`];
    else if (message.sender === "visitor" && chat.assignedUserId)
      actors = [`s:${chat.assignedUserId}`];
  } else {
    const peers = await tx
      .select({ id: conversationMembers.userId })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, chat.id));
    actors = peers
      .filter(p => p.id !== message.senderUserId)
      .map(p => `s:${p.id}`);
  }
  if (actors.length) await queuePushActors(tx, actors, message.id);
}
export async function queuePushActors(
  tx: MessagingTransaction,
  actors: string[],
  messageId: number
) {
  if (!messageId || !actors.length) return;
  await tx
    .update(devices)
    .set({
      queuedId: sql`greatest(${devices.queuedId}, ${messageId})`,
      nextAt: new Date(Date.now() + 2500),
      attempts: 0,
    })
    .where(
      and(
        inArray(devices.actor, actors),
        gt(devices.expiresAt, new Date()),
        gt(sql`${messageId}`, devices.sentId)
      )
    );
}
async function deliveryTarget(device: Device) {
  const db = await database();
  const [row] = await db
    .select({ message: conversationMessages, chat: conversations })
    .from(conversationMessages)
    .innerJoin(
      conversations,
      eq(conversations.id, conversationMessages.conversationId)
    )
    .where(eq(conversationMessages.id, device.queuedId))
    .limit(1);
  if (!row || row.message.imported || row.message.sender === "assistant")
    return null;
  if (device.actor.startsWith("v:")) {
    if (
      row.chat.visitorKey !== device.actor.slice(2) ||
      !row.chat.visitorExpiresAt ||
      row.chat.visitorExpiresAt <= new Date() ||
      row.message.sender !== "staff" ||
      row.chat.visitorReadId >= row.message.id
    )
      return null;
    return { url: `/?supportThread=${row.chat.id}` };
  }
  const userId = Number(device.actor.slice(2));
  const [session] = await db
    .select({ id: staffSessions.id })
    .from(staffSessions)
    .innerJoin(teamMembers, eq(teamMembers.userId, staffSessions.userId))
    .where(
      and(
        eq(staffSessions.userId, userId),
        eq(staffSessions.tokenHash, device.sessionHash ?? ""),
        eq(staffSessions.mfaVerified, true),
        gt(staffSessions.expiresAt, new Date()),
        eq(teamMembers.status, "active")
      )
    )
    .limit(1);
  if (!session) return null;
  const [member] = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, row.chat.id),
        eq(conversationMembers.userId, userId)
      )
    )
    .limit(1);
  if (
    !member ||
    member.readId >= row.message.id ||
    row.message.senderUserId === userId ||
    (row.chat.kind === "support" && row.chat.assignedUserId !== userId)
  )
    return null;
  return {
    url: `/admin?messageThread=${row.chat.id}&messageKind=${row.chat.kind}`,
  };
}
export function pushPayload(locale: MessageLocale, url: string, test = false) {
  const copy = pushCopy[locale] ?? pushCopy.en;
  return JSON.stringify({
    title: "ProviderBeacon",
    body: test ? copy.testBody : copy.body,
    url,
    tag: test ? "providerbeacon-test" : "providerbeacon-messages",
  });
}
export async function sendDevicePush(
  device: Device,
  url: string,
  test = false
) {
  if (!pushAvailable()) throw unavailable();
  const subscription = pushSubscription.parse(
    JSON.parse(decryptValue(JSON.parse(device.encrypted), `push:${device.id}`))
  );
  // Revalidate the allowlist at delivery too; do not send to arbitrary URLs.
  validatePushKeys(subscription);
  await webpush.sendNotification(
    subscription,
    pushPayload(device.locale as MessageLocale, url, test),
    {
      vapidDetails: {
        subject: "https://providerbeacon.com",
        publicKey: process.env.WEB_PUSH_PUBLIC_KEY!,
        privateKey: process.env.WEB_PUSH_PRIVATE_KEY!,
      },
      TTL: 300,
      timeout: 5000,
      urgency: "normal",
      topic: device.id.slice(0, 32),
    }
  );
}
export async function testDevicePush(
  identity: PushIdentity,
  endpoint: string,
  expected: string
) {
  assertIdentity(identity, expected);
  const db = await database();
  const [device] = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.id, hashToken(endpoint)),
        own(identity),
        gt(devices.expiresAt, new Date())
      )
    )
    .limit(1);
  if (!device)
    throw new TRPCError({ code: "NOT_FOUND", message: "push_missing" });
  try {
    await sendDevicePush(
      device,
      identity.actor.startsWith("s:") ? "/admin" : "/",
      true
    );
  } catch {
    throw unavailable();
  }
  return { accepted: true };
}
export async function runPushStep() {
  if (!pushAvailable()) return false;
  const db = await database(),
    now = new Date(),
    lease = randomUUID();
  const device = await db.transaction(async tx => {
    const [row] = await tx
      .select()
      .from(devices)
      .where(
        and(
          lte(devices.nextAt, now),
          gt(devices.expiresAt, now),
          or(isNull(devices.leaseUntil), lte(devices.leaseUntil, now))
        )
      )
      .orderBy(devices.nextAt)
      .limit(1)
      .for("update", { skipLocked: true });
    if (!row) return null;
    await tx
      .update(devices)
      .set({ lease, leaseUntil: new Date(Date.now() + 60000) })
      .where(eq(devices.id, row.id));
    return { ...row, lease };
  });
  if (!device) return false;
  const owned = and(eq(devices.id, device.id), eq(devices.lease, lease));
  try {
    const target =
      device.queuedId > device.sentId ? await deliveryTarget(device) : null;
    // A revoke/rebind during authorization cancels this claim.
    const [stillOwned] = await db
      .select({ id: devices.id })
      .from(devices)
      .where(owned)
      .limit(1);
    if (!stillOwned) return true;
    if (target) await sendDevicePush(device, target.url);
    await db
      .update(devices)
      .set({
        sentId: device.queuedId,
        attempts: 0,
        lease: null,
        leaseUntil: null,
        nextAt: sql`case when ${devices.queuedId} > ${device.queuedId} then CURRENT_TIMESTAMP(3) else null end`,
      })
      .where(owned);
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) await db.delete(devices).where(owned);
    else
      await db
        .update(devices)
        .set({
          lease: null,
          leaseUntil: null,
          attempts: device.attempts + 1,
          nextAt:
            device.attempts >= 5
              ? null
              : new Date(
                  Date.now() + Math.min(300000, 5000 * 2 ** device.attempts)
                ),
        })
        .where(owned);
    // Never log push endpoints, encryption keys or provider response bodies.
  }
  return true;
}
export function startPushWorker() {
  if (process.env.NODE_ENV !== "production" || !pushAvailable())
    return () => {};
  let running = false,
    stopped = false,
    cleanupAt = 0;
  const timer = setInterval(() => {
    if (running || stopped) return;
    running = true;
    void (async () => {
      for (let n = 0; n < 12 && !stopped; n++)
        if (!(await runPushStep())) break;
      if (Date.now() > cleanupAt) {
        cleanupAt = Date.now() + 3600000;
        const db = await database();
        await db.execute(
          sql`delete from ${devices} where ${devices.expiresAt} < CURRENT_TIMESTAMP(3) limit 1000`
        );
      }
    })()
      .catch(() => console.warn("[Push] Delivery check deferred"))
      .finally(() => {
        running = false;
      });
  }, 2000);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
