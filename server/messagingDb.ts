import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  assistantUsageBuckets,
  teamMembers,
  users,
  type TeamRole,
} from "../drizzle/schema";
import {
  conversations as chats,
  conversationMembers as members,
  conversationMessages as messages,
  messageTranslations as translations,
  messagingPreferences as prefs,
  messagingControl as control,
} from "../drizzle/messagingSchema";
import {
  messageLocales,
  type ChatMessage,
  type MessageLocale,
  type ConversationCursor,
  type MessageNotificationSnapshot,
} from "../shared/messaging";
import { getDb } from "./db";
import { writeAudit } from "./marketplaceDb";
import { assistantAvailable } from "./assistantModel";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type MessagingTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
export type ChatActor =
  | { kind: "staff"; userId: number; role: TeamRole }
  | { kind: "visitor"; key: string };
export async function messagingDatabase() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "messaging_unavailable",
    });
  return db;
}
export const chatFail = (
  message: string,
  code:
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "TOO_MANY_REQUESTS" = "FORBIDDEN"
): never => {
  throw new TRPCError({ code, message });
};
export const chatLocale = (value: string | null | undefined): MessageLocale =>
  messageLocales.includes(value as MessageLocale)
    ? (value as MessageLocale)
    : "en";
const manager = (actor: ChatActor) =>
  actor.kind === "staff" && ["owner", "administrator"].includes(actor.role);
const recent = () => new Date(Date.now() - 90000);

// Reservations are shared by all replicas and survive restarts. These keys use
// the existing expiring bucket table without consuming catalogue-assistant quota.
export async function messagingBudget(
  key: string,
  limit: number,
  windowMs = 60000
) {
  const db = await messagingDatabase();
  const now = Date.now(),
    period = Math.floor(now / windowMs);
  const bucket = `chat:${period}:${key}`;
  await db.transaction(async tx => {
    await tx
      .insert(assistantUsageBuckets)
      .values({ key: bucket, expiresAt: new Date((period + 2) * windowMs) })
      .onDuplicateKeyUpdate({ set: { key: bucket } });
    const [result] = await tx
      .update(assistantUsageBuckets)
      .set({ used: sql`${assistantUsageBuckets.used} + 1` })
      .where(
        and(
          eq(assistantUsageBuckets.key, bucket),
          lt(assistantUsageBuckets.used, limit)
        )
      );
    if (result.affectedRows !== 1)
      chatFail("messaging_limit", "TOO_MANY_REQUESTS");
  });
}

async function authorize(
  tx: Database | MessagingTransaction,
  id: string,
  actor: ChatActor,
  lock = false
) {
  const query = tx.select().from(chats).where(eq(chats.id, id)).limit(1);
  const [chat] = await (lock ? query.for("update") : query);
  if (!chat) return chatFail("messaging_missing", "NOT_FOUND");
  if (actor.kind === "visitor") {
    if (
      chat.kind !== "support" ||
      chat.visitorKey !== actor.key ||
      !chat.visitorExpiresAt ||
      chat.visitorExpiresAt.getTime() < Date.now()
    )
      return chatFail("messaging_missing", "NOT_FOUND");
  } else if (chat.kind === "direct") {
    const [member] = await tx
      .select()
      .from(members)
      .where(
        and(eq(members.conversationId, id), eq(members.userId, actor.userId))
      )
      .limit(1);
    if (!member) return chatFail("messaging_missing", "NOT_FOUND");
  } else if (chat.assignedUserId !== actor.userId && !manager(actor)) {
    return chatFail("messaging_missing", "NOT_FOUND");
  }
  return chat;
}

export async function messagingProfile(userId: number) {
  const db = await messagingDatabase();
  const [row] = await db.select().from(prefs).where(eq(prefs.userId, userId));
  return {
    locale: row ? chatLocale(row.locale) : null,
    available: row?.available ?? false,
    translationAvailable: assistantAvailable(),
  };
}
export async function messagingPresence(
  userId: number,
  locale: MessageLocale,
  available?: boolean
) {
  const db = await messagingDatabase();
  await db
    .insert(prefs)
    .values({
      userId,
      locale,
      available: available ?? false,
      lastSeenAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        locale,
        lastSeenAt: new Date(),
        ...(available === undefined ? {} : { available }),
      },
    });
  // A newly available employee immediately receives queued requests.
  if (available) await dispatchSupport();
  return messagingProfile(userId);
}
export async function messagingDirectory(userId: number) {
  const db = await messagingDatabase();
  return db
    .select({
      id: users.id,
      name: users.name,
      locale: prefs.locale,
      available: prefs.available,
      online: sql<boolean>`${prefs.lastSeenAt} > ${recent()}`.mapWith(Boolean),
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .leftJoin(prefs, eq(prefs.userId, users.id))
    .where(and(eq(teamMembers.status, "active"), ne(users.id, userId)))
    .orderBy(asc(users.name))
    .limit(150);
}

export async function startDirect(userId: number, recipientId: number) {
  if (userId === recipientId) chatFail("messaging_recipient");
  const db = await messagingDatabase();
  return db.transaction(async tx => {
    const active = await tx
      .select({ id: teamMembers.userId })
      .from(teamMembers)
      .where(
        and(
          inArray(teamMembers.userId, [userId, recipientId]),
          eq(teamMembers.status, "active")
        )
      )
      .for("share");
    if (new Set(active.map(r => r.id)).size !== 2)
      return chatFail("messaging_recipient");
    const directKey = [userId, recipientId].sort((a, b) => a - b).join(":");
    await tx
      .insert(chats)
      .values({
        id: randomUUID(),
        kind: "direct",
        directKey,
        status: "assigned",
      })
      .onDuplicateKeyUpdate({ set: { directKey } });
    const [chat] = await tx
      .select({ id: chats.id })
      .from(chats)
      .where(eq(chats.directKey, directKey));
    for (const id of [userId, recipientId])
      await tx
        .insert(members)
        .values({ conversationId: chat.id, userId: id })
        .onDuplicateKeyUpdate({ set: { userId: id } });
    return { id: chat.id };
  });
}

async function queueForRecipients(
  tx: MessagingTransaction,
  chat: typeof chats.$inferSelect,
  row: typeof messages.$inferSelect
) {
  const targets = new Set<MessageLocale>();
  if (chat.kind === "support" && row.sender === "staff")
    targets.add(chatLocale(chat.visitorLocale));
  const participants = await tx
    .select({ userId: members.userId, locale: prefs.locale })
    .from(members)
    .leftJoin(prefs, eq(prefs.userId, members.userId))
    .where(
      and(
        eq(members.conversationId, chat.id),
        row.senderUserId ? ne(members.userId, row.senderUserId) : undefined
      )
    );
  for (const person of participants) {
    if (chat.kind === "direct" || person.userId === chat.assignedUserId)
      targets.add(chatLocale(person.locale));
  }
  for (const locale of Array.from(targets))
    await tx
      .insert(translations)
      .values({ messageId: row.id, locale })
      .onDuplicateKeyUpdate({ set: { messageId: row.id } });
}

async function appendMessage(
  tx: MessagingTransaction,
  chat: typeof chats.$inferSelect,
  input: {
    clientId: string;
    text: string;
    locale: MessageLocale;
    sender: "visitor" | "staff" | "assistant";
    senderUserId?: number;
    imported?: boolean;
  }
) {
  const [duplicate] = await tx
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, chat.id),
        eq(messages.clientId, input.clientId)
      )
    )
    .limit(1);
  if (duplicate) {
    if (
      duplicate.senderUserId !== (input.senderUserId ?? null) ||
      duplicate.sender !== input.sender ||
      duplicate.original !== input.text
    )
      return chatFail("messaging_retry_conflict", "CONFLICT");
    return duplicate;
  }
  const [{ id }] = await tx
    .insert(messages)
    .values({
      conversationId: chat.id,
      clientId: input.clientId,
      original: input.text,
      sourceLocale: input.locale,
      sender: input.sender,
      senderUserId: input.senderUserId,
      imported: input.imported ?? false,
    })
    .$returningId();
  const [row] = await tx.select().from(messages).where(eq(messages.id, id));
  await tx
    .update(chats)
    .set({ lastMessageId: id, updatedAt: new Date() })
    .where(eq(chats.id, chat.id));
  await queueForRecipients(tx, chat, row);
  return row;
}

export async function sendChatMessage(
  actor: ChatActor,
  input: {
    conversationId: string;
    clientId: string;
    text: string;
    locale: MessageLocale;
  }
) {
  const db = await messagingDatabase();
  return db.transaction(async tx => {
    const chat = await authorize(tx, input.conversationId, actor, true);
    if (chat.status === "closed")
      return chatFail("messaging_closed", "CONFLICT");
    if (
      chat.kind === "support" &&
      actor.kind === "staff" &&
      chat.assignedUserId !== actor.userId
    )
      return chatFail("messaging_claim_first", "CONFLICT");
    if (chat.kind === "direct") {
      const active = await tx
        .select({ id: members.userId })
        .from(members)
        .innerJoin(
          teamMembers,
          and(
            eq(teamMembers.userId, members.userId),
            eq(teamMembers.status, "active")
          )
        )
        .where(eq(members.conversationId, chat.id));
      if (new Set(active.map(r => r.id)).size !== 2)
        return chatFail("messaging_recipient", "CONFLICT");
    }
    const row = await appendMessage(tx, chat, {
      ...input,
      clientId: `${actor.kind === "staff" ? `s${actor.userId}` : "v"}:${input.clientId}`,
      sender: actor.kind,
      senderUserId: actor.kind === "staff" ? actor.userId : undefined,
    });
    return { id: row.id };
  });
}

export async function startSupport(
  key: string,
  input: {
    locale: MessageLocale;
    text: string;
    clientId: string;
    name?: string;
    history: { role: "user" | "assistant"; content: string }[];
  }
) {
  const db = await messagingDatabase();
  const result = await db.transaction(async tx => {
    await tx
      .insert(chats)
      .values({
        id: randomUUID(),
        kind: "support",
        visitorKey: key,
        visitorExpiresAt: new Date(Date.now() + 30 * 86400000),
        visitorLocale: input.locale,
        visitorName: input.name || null,
      })
      .onDuplicateKeyUpdate({ set: { visitorKey: key } });
    const [chat] = await tx
      .select()
      .from(chats)
      .where(eq(chats.visitorKey, key))
      .for("update");
    if (!chat.visitorExpiresAt || chat.visitorExpiresAt.getTime() < Date.now())
      return chatFail("messaging_session");
    if (chat.status === "closed") {
      await tx
        .update(chats)
        .set({
          status: "waiting",
          assignedUserId: null,
          visitorLocale: input.locale,
          updatedAt: new Date(),
        })
        .where(eq(chats.id, chat.id));
      chat.status = "waiting";
      chat.assignedUserId = null;
    }
    if (!chat.lastMessageId)
      for (const [i, item] of Array.from(input.history.entries())) {
        await appendMessage(tx, chat, {
          clientId: `history:${i}`,
          text: item.content,
          locale: input.locale,
          sender: item.role === "user" ? "visitor" : "assistant",
          imported: true,
        });
      }
    await appendMessage(tx, chat, {
      clientId: `v:${input.clientId}`,
      text: input.text,
      locale: input.locale,
      sender: "visitor",
    });
    return { id: chat.id };
  });
  await dispatchSupport();
  return result;
}

export async function visitorConversation(key: string | null) {
  if (!key) return null;
  const db = await messagingDatabase();
  const [row] = await db
    .select({
      id: chats.id,
      status: chats.status,
      name: users.name,
      unread:
        sql<number>`(select count(*) from messaging_messages mm where mm.conversation_id = ${chats.id} and mm.id > ${chats.visitorReadId} and mm.sender = 'staff' and mm.imported = false)`.mapWith(
          Number
        ),
      lastIncomingId:
        sql<number>`coalesce((select max(mm.id) from messaging_messages mm where mm.conversation_id = ${chats.id} and mm.id > ${chats.visitorReadId} and mm.sender = 'staff' and mm.imported = false),0)`.mapWith(
          Number
        ),
    })
    .from(chats)
    .leftJoin(users, eq(users.id, chats.assignedUserId))
    .where(
      and(eq(chats.visitorKey, key), gt(chats.visitorExpiresAt, new Date()))
    )
    .limit(1);
  return row ?? null;
}

export async function expiredVisitorKey(key: string) {
  const db = await messagingDatabase();
  const [row] = await db
    .select({ expires: chats.visitorExpiresAt })
    .from(chats)
    .where(eq(chats.visitorKey, key))
    .limit(1);
  return !!row && (!row.expires || row.expires.getTime() < Date.now());
}

async function assign(
  tx: MessagingTransaction,
  chat: typeof chats.$inferSelect,
  userId: number,
  actorUserId?: number
) {
  await tx
    .update(chats)
    .set({ assignedUserId: userId, status: "assigned", updatedAt: new Date() })
    .where(eq(chats.id, chat.id));
  await tx
    .insert(members)
    .values({ conversationId: chat.id, userId })
    .onDuplicateKeyUpdate({ set: { userId } });
  await tx
    .update(prefs)
    .set({ lastAssignedAt: new Date() })
    .where(eq(prefs.userId, userId));
  await writeAudit(
    {
      actorUserId,
      action: "messaging.support.assigned",
      entityType: "support_conversation",
      entityId: chat.id,
      summary: "Assigned customer support conversation",
      metadata: { assignedUserId: userId },
    },
    tx
  );
  const [language] = await tx
    .select({ locale: prefs.locale })
    .from(prefs)
    .where(eq(prefs.userId, userId));
  const history = await tx
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, chat.id),
        or(isNull(messages.senderUserId), ne(messages.senderUserId, userId))
      )
    )
    .orderBy(desc(messages.id))
    .limit(50);
  for (const row of history)
    await tx
      .insert(translations)
      .values({ messageId: row.id, locale: chatLocale(language?.locale) })
      .onDuplicateKeyUpdate({ set: { messageId: row.id } });
}

export async function dispatchSupport() {
  const db = await messagingDatabase();
  await db.transaction(async tx => {
    // One short dispatch lock makes capacity and assignment deterministic across
    // concurrent requests/replicas. No network/model calls occur in this lock.
    await tx.select().from(control).where(eq(control.id, 1)).for("update");
    await tx
      .update(chats)
      .set({ status: "closed", updatedAt: new Date() })
      .where(
        and(
          eq(chats.kind, "support"),
          ne(chats.status, "closed"),
          lt(chats.visitorExpiresAt, new Date())
        )
      );
    const online = await tx
      .select({ id: prefs.userId, lastAssignedAt: prefs.lastAssignedAt })
      .from(prefs)
      .innerJoin(
        teamMembers,
        and(
          eq(teamMembers.userId, prefs.userId),
          eq(teamMembers.status, "active"),
          ne(teamMembers.role, "auditor")
        )
      )
      .where(and(eq(prefs.available, true), gt(prefs.lastSeenAt, recent())))
      .orderBy(asc(prefs.lastAssignedAt), asc(prefs.userId))
      .limit(150);
    const ids = online.map(r => r.id);
    const assigned = await tx
      .select()
      .from(chats)
      .where(and(eq(chats.kind, "support"), eq(chats.status, "assigned")))
      .for("update");
    for (const chat of assigned)
      if (!ids.includes(chat.assignedUserId ?? -1)) {
        await tx
          .update(chats)
          .set({
            assignedUserId: null,
            status: "waiting",
            updatedAt: new Date(),
          })
          .where(eq(chats.id, chat.id));
      }
    if (!ids.length) return;
    const load = new Map(
      ids.map(id => [id, assigned.filter(c => c.assignedUserId === id).length])
    );
    const waiting = await tx
      .select()
      .from(chats)
      .where(and(eq(chats.kind, "support"), eq(chats.status, "waiting")))
      .orderBy(asc(chats.createdAt))
      .limit(20)
      .for("update");
    for (const chat of waiting) {
      const next = [...online]
        .sort(
          (a, b) =>
            load.get(a.id)! - load.get(b.id)! ||
            (a.lastAssignedAt?.getTime() ?? 0) -
              (b.lastAssignedAt?.getTime() ?? 0)
        )
        .find(a => load.get(a.id)! < 5);
      if (!next) break;
      await assign(tx, chat, next.id);
      load.set(next.id, load.get(next.id)! + 1);
      next.lastAssignedAt = new Date();
    }
  });
}

export async function changeSupportAssignment(
  actor: Extract<ChatActor, { kind: "staff" }>,
  id: string,
  targetId: number
) {
  if (
    actor.role === "auditor" ||
    (targetId !== actor.userId && !manager(actor))
  )
    chatFail("messaging_forbidden");
  const db = await messagingDatabase();
  await db.transaction(async tx => {
    await tx.select().from(control).where(eq(control.id, 1)).for("update");
    const [chat] = await tx
      .select()
      .from(chats)
      .where(and(eq(chats.id, id), eq(chats.kind, "support")))
      .for("update");
    if (!chat || chat.status === "closed")
      return chatFail("messaging_missing", "NOT_FOUND");
    if (
      !manager(actor) &&
      chat.assignedUserId !== null &&
      chat.assignedUserId !== actor.userId
    )
      return chatFail("messaging_already_assigned", "CONFLICT");
    const [target] = await tx
      .select({ id: prefs.userId })
      .from(prefs)
      .innerJoin(teamMembers, eq(teamMembers.userId, prefs.userId))
      .where(
        and(
          eq(prefs.userId, targetId),
          eq(prefs.available, true),
          gt(prefs.lastSeenAt, recent()),
          eq(teamMembers.status, "active"),
          ne(teamMembers.role, "auditor")
        )
      );
    if (!target) return chatFail("messaging_agent_offline", "CONFLICT");
    const [count] = await tx
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(chats)
      .where(
        and(
          eq(chats.assignedUserId, targetId),
          eq(chats.status, "assigned"),
          eq(chats.kind, "support"),
          ne(chats.id, id)
        )
      );
    if (count.n >= 5) return chatFail("messaging_agent_full", "CONFLICT");
    await assign(tx, chat, targetId, actor.userId);
  });
  return { id };
}

export async function listConversations(
  actor: Extract<ChatActor, { kind: "staff" }>,
  before?: ConversationCursor,
  filters?: { kind?: "direct" | "support"; status?: "all" | "open" | "closed" }
) {
  const db = await messagingDatabase();
  const rows = await db
    .select({
      id: chats.id,
      kind: chats.kind,
      status: chats.status,
      visitorName: chats.visitorName,
      assignedUserId: chats.assignedUserId,
      agentName: users.name,
      updatedAt: chats.updatedAt,
      lastMessageId: chats.lastMessageId,
      unread:
        sql<number>`(select count(*) from messaging_messages mm where mm.conversation_id = ${chats.id} and mm.id > coalesce(${members.readId},0) and (mm.sender_user_id is null or mm.sender_user_id != ${actor.userId}) and mm.imported = false)`.mapWith(
          Number
        ),
    })
    .from(chats)
    .leftJoin(
      members,
      and(
        eq(members.conversationId, chats.id),
        eq(members.userId, actor.userId)
      )
    )
    .leftJoin(users, eq(users.id, chats.assignedUserId))
    .where(
      and(
        or(
          and(eq(chats.kind, "direct"), eq(members.userId, actor.userId)),
          and(
            eq(chats.kind, "support"),
            manager(actor)
              ? ne(chats.status, "waiting")
              : eq(chats.assignedUserId, actor.userId)
          )
        ),
        filters?.kind ? eq(chats.kind, filters.kind) : undefined,
        filters?.status === "closed"
          ? eq(chats.status, "closed")
          : filters?.status === "open"
            ? ne(chats.status, "closed")
            : undefined,
        before
          ? or(
              lt(chats.lastMessageId, before.messageId),
              and(
                eq(chats.lastMessageId, before.messageId),
                lt(chats.id, before.id)
              )
            )
          : undefined
      )
    )
    .orderBy(desc(chats.lastMessageId), desc(chats.id))
    .limit(61);
  const ids = rows
    .slice(0, 60)
    .filter(row => row.kind === "direct")
    .map(row => row.id);
  const peers = ids.length
    ? await db
        .select({ id: members.conversationId, name: users.name })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(
          and(
            inArray(members.conversationId, ids),
            ne(members.userId, actor.userId)
          )
        )
    : [];
  const names = new Map(peers.map(peer => [peer.id, peer.name]));
  const items = rows.slice(0, 60).map(row => ({
    ...row,
    name: row.kind === "direct" ? (names.get(row.id) ?? null) : row.visitorName,
  }));
  const queue =
    actor.role === "auditor" ||
    filters?.kind === "direct" ||
    filters?.status === "closed"
      ? []
      : await db
          .select({
            id: chats.id,
            name: chats.visitorName,
            locale: chats.visitorLocale,
            createdAt: chats.createdAt,
          })
          .from(chats)
          .where(and(eq(chats.kind, "support"), eq(chats.status, "waiting")))
          .orderBy(asc(chats.createdAt))
          .limit(50);
  return {
    items,
    nextCursor:
      rows.length > 60
        ? { messageId: items.at(-1)!.lastMessageId, id: items.at(-1)!.id }
        : null,
    queue,
  };
}

// Independent of inbox pagination. Only incoming unread messages from the
// actor's own direct chats and assigned support conversations are counted.
// No message content is returned to the notification client.
export async function messageNotifications(
  actor: Extract<ChatActor, { kind: "staff" }>
): Promise<MessageNotificationSnapshot> {
  const db = await messagingDatabase();
  return db.transaction(async tx => {
    const access = or(
      and(eq(chats.kind, "direct"), eq(members.userId, actor.userId)),
      and(eq(chats.kind, "support"), eq(chats.assignedUserId, actor.userId))
    );
    const memberJoin = and(
      eq(members.conversationId, chats.id),
      eq(members.userId, actor.userId)
    );
    const incoming = and(
      eq(messages.conversationId, chats.id),
      gt(messages.id, sql`coalesce(${members.readId},0)`),
      or(
        isNull(messages.senderUserId),
        ne(messages.senderUserId, actor.userId)
      ),
      eq(messages.imported, false)
    );
    const [total] = await tx
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(chats)
      .leftJoin(members, memberJoin)
      .innerJoin(messages, incoming)
      .where(access);
    const [queue] =
      actor.role === "auditor"
        ? [{ n: 0 }]
        : await tx
            .select({ n: sql<number>`count(*)`.mapWith(Number) })
            .from(chats)
            .where(and(eq(chats.kind, "support"), eq(chats.status, "waiting")));
    if (!total.n) return { unread: 0, waiting: queue.n, items: [] };
    const rows = await tx
      .select({
        conversationId: chats.id,
        kind: chats.kind,
        name: chats.visitorName,
        messageId: sql<number>`max(${messages.id})`.mapWith(Number),
      })
      .from(chats)
      .leftJoin(members, memberJoin)
      .innerJoin(messages, incoming)
      .where(access)
      .groupBy(chats.id, chats.kind, chats.visitorName)
      .orderBy(desc(sql`max(${messages.id})`))
      .limit(60);
    const directIds = rows
      .filter(row => row.kind === "direct")
      .map(row => row.conversationId);
    const peers = directIds.length
      ? await tx
          .select({ id: members.conversationId, name: users.name })
          .from(members)
          .innerJoin(users, eq(users.id, members.userId))
          .where(
            and(
              inArray(members.conversationId, directIds),
              ne(members.userId, actor.userId)
            )
          )
      : [];
    const names = new Map(peers.map(peer => [peer.id, peer.name]));
    return {
      unread: total.n,
      waiting: queue.n,
      items: rows.map(row => ({
        conversationId: row.conversationId,
        kind: row.kind,
        messageId: row.messageId,
        name:
          row.kind === "direct"
            ? (names.get(row.conversationId) ?? null)
            : row.name,
      })),
    };
  });
}

export async function getChatThread(
  actor: ChatActor,
  id: string,
  before?: number
) {
  const db = await messagingDatabase();
  const chat = await authorize(db, id, actor);
  const [profile] =
    actor.kind === "staff"
      ? await db
          .select({ locale: prefs.locale })
          .from(prefs)
          .where(eq(prefs.userId, actor.userId))
      : [];
  const locale = chatLocale(
    actor.kind === "visitor" ? chat.visitorLocale : profile?.locale
  );
  const rows = await db
    .select({ message: messages, translation: translations, name: users.name })
    .from(messages)
    .leftJoin(
      translations,
      and(
        eq(translations.messageId, messages.id),
        eq(translations.locale, locale)
      )
    )
    .leftJoin(users, eq(users.id, messages.senderUserId))
    .where(
      and(
        eq(messages.conversationId, id),
        before ? lt(messages.id, before) : undefined
      )
    )
    .orderBy(desc(messages.id))
    .limit(51);
  const participants = await db
    .select({
      userId: members.userId,
      readId: members.readId,
      name: users.name,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.conversationId, id));
  const items: ChatMessage[] = rows
    .slice(0, 50)
    .reverse()
    .map(({ message: m, translation: t, name }) => {
      const own =
        actor.kind === "staff"
          ? m.senderUserId === actor.userId
          : m.sender === "visitor";
      const peerRead =
        actor.kind === "staff"
          ? chat.kind === "support"
            ? chat.visitorReadId
            : (participants.find(p => p.userId !== actor.userId)?.readId ?? 0)
          : (participants.find(p => p.userId === chat.assignedUserId)?.readId ??
            0);
      return {
        id: m.id,
        clientId: m.clientId,
        sender: m.sender,
        name,
        own,
        original: m.original,
        sourceLocale: t?.sourceLocale ?? m.sourceLocale,
        createdAt: m.createdAt,
        imported: m.imported,
        read: own && peerRead >= m.id,
        translation:
          own || (t?.status === "done" && t.sourceLocale === locale)
            ? null
            : {
                text: t?.text ?? null,
                status:
                  t?.status === "done"
                    ? "done"
                    : !assistantAvailable()
                      ? "failed"
                      : (t?.status ?? "missing"),
                needsReview: t?.needsReview ?? false,
              },
      };
    });
  const peer =
    chat.kind === "direct" && actor.kind === "staff"
      ? participants.find(p => p.userId !== actor.userId)
      : participants.find(p => p.userId === chat.assignedUserId);
  return {
    id,
    kind: chat.kind,
    status: chat.status,
    locale,
    assignedUserId: chat.assignedUserId,
    name:
      actor.kind === "staff" && chat.kind === "support"
        ? chat.visitorName
        : (peer?.name ?? null),
    agentName: peer?.name ?? null,
    items,
    nextCursor: rows.length > 50 ? items[0].id : null,
    lastMessageId: chat.lastMessageId,
  };
}

export async function readChat(
  actor: ChatActor,
  id: string,
  messageId: number
) {
  const db = await messagingDatabase();
  await db.transaction(async tx => {
    const chat = await authorize(tx, id, actor, true);
    const readId = Math.min(messageId, chat.lastMessageId);
    if (actor.kind === "visitor")
      await tx
        .update(chats)
        .set({ visitorReadId: sql`greatest(${chats.visitorReadId},${readId})` })
        .where(eq(chats.id, id));
    else
      await tx
        .insert(members)
        .values({ conversationId: id, userId: actor.userId, readId })
        .onDuplicateKeyUpdate({
          set: { readId: sql`greatest(${members.readId},${readId})` },
        });
  });
  return { ok: true };
}

export async function prepareTranslations(
  actor: ChatActor,
  id: string,
  messageIds: number[],
  retry = false
) {
  const db = await messagingDatabase();
  await db.transaction(async tx => {
    const chat = await authorize(tx, id, actor);
    const [profile] =
      actor.kind === "staff"
        ? await tx
            .select({ locale: prefs.locale })
            .from(prefs)
            .where(eq(prefs.userId, actor.userId))
        : [];
    const locale = chatLocale(
      actor.kind === "visitor" ? chat.visitorLocale : profile?.locale
    );
    const rows = await tx
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, id),
          inArray(messages.id, messageIds),
          actor.kind === "staff"
            ? or(
                isNull(messages.senderUserId),
                ne(messages.senderUserId, actor.userId)
              )
            : ne(messages.sender, "visitor")
        )
      );
    for (const row of rows) {
      await tx
        .insert(translations)
        .values({ messageId: row.id, locale })
        .onDuplicateKeyUpdate({ set: { messageId: row.id } });
      if (retry)
        await tx
          .update(translations)
          .set({
            status: "queued",
            attempts: 0,
            retryAt: new Date(),
            lease: null,
            leaseUntil: null,
          })
          .where(
            and(
              eq(translations.messageId, row.id),
              eq(translations.locale, locale),
              eq(translations.status, "failed")
            )
          );
    }
  });
  return { ok: true };
}

export async function setVisitorLanguage(
  actor: Extract<ChatActor, { kind: "visitor" }>,
  id: string,
  locale: MessageLocale
) {
  const db = await messagingDatabase();
  await db.transaction(async tx => {
    await authorize(tx, id, actor, true);
    await tx
      .update(chats)
      .set({ visitorLocale: locale })
      .where(eq(chats.id, id));
  });
  return { ok: true };
}
export async function closeChat(actor: ChatActor, id: string) {
  const db = await messagingDatabase();
  await db.transaction(async tx => {
    const chat = await authorize(tx, id, actor, true);
    if (chat.kind !== "support") return chatFail("messaging_forbidden");
    await tx
      .update(chats)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(chats.id, id));
    await writeAudit(
      {
        actorUserId: actor.kind === "staff" ? actor.userId : undefined,
        action: "messaging.support.closed",
        entityType: "support_conversation",
        entityId: id,
        summary: "Closed support conversation",
      },
      tx
    );
  });
  await dispatchSupport();
  return { ok: true };
}
