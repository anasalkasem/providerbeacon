import { createHash, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { appRouter } from "./routers";
import { assistantUsageBuckets, teamMembers, users } from "../drizzle/schema";
import {
  conversations as chats,
  conversationMessages as messages,
  messageTranslations as translations,
  messagingPreferences as prefs,
} from "../drizzle/messagingSchema";
import { dispatchSupport, messagingBudget } from "./messagingDb";
import { runTranslationStep } from "./messageTranslation";

export function messagingAcceptanceCases(
  database: () => any,
  ownerId: () => number
) {
  describe("staff messenger and customer handoff", () => {
    let arabic: number, spanish: number;
    const origin = "https://providerbeacon.com";
    const caller = (
      id: number | null,
      token?: string,
      requestOrigin = origin
    ) =>
      appRouter.createCaller({
        user:
          id === null
            ? null
            : {
                id,
                openId: `chat-user-${id}`,
                name: `Employee ${id}`,
                role: "user",
              },
        req: {
          headers: {
            origin: requestOrigin,
            host: "providerbeacon.com",
            ...(token ? { cookie: `pb_support=${token}` } : {}),
          },
          socket: { remoteAddress: "127.0.0.1" },
        },
        res: { setHeader: vi.fn(), cookie: vi.fn() },
      } as any);
    const staff = async (name: string, role = "catalogue_editor") => {
      const [{ id }] = await database()
        .insert(users)
        .values({ openId: `chat-test-${randomUUID()}`, name })
        .$returningId();
      await database()
        .insert(teamMembers)
        .values({
          userId: id,
          email: `${id}@chat.example`,
          role,
          status: "active",
        });
      return id as number;
    };
    const input = (conversationId: string, text = "مرحبا") => ({
      conversationId,
      clientId: randomUUID(),
      text,
      locale: "ar" as const,
    });
    const handoff = (text = "Necesito ayuda") => ({
      clientId: randomUUID(),
      locale: "es" as const,
      text,
      history: [
        { role: "user" as const, content: "Necesito comparar" },
        { role: "assistant" as const, content: "¿Qué servicio buscas?" },
      ],
    });
    beforeEach(async () => {
      await database().delete(chats);
      await database().delete(prefs);
      await database().delete(assistantUsageBuckets);
      vi.stubEnv("PUBLIC_APP_URL", origin);
      vi.stubEnv("AUTH_PEPPER", "test-messaging-pepper");
      vi.stubEnv("OPENAI_API_KEY", "test-key");
      arabic = await staff("موظف عربي");
      spanish = await staff("Empleado español");
      await caller(arabic).messaging.presence({ locale: "ar" });
      await caller(spanish).messaging.presence({ locale: "es" });
    });
    it("deduplicates direct chats and retries, persists unread/read state and translates each direction", async () => {
      const starts = await Promise.all([
        caller(arabic).messaging.direct({ recipientId: spanish }),
        caller(spanish).messaging.direct({ recipientId: arabic }),
      ]);
      expect(starts[0].id).toBe(starts[1].id);
      const first = input(starts[0].id);
      const saved = await caller(arabic).messaging.send(first);
      expect(await caller(arabic).messaging.send(first)).toEqual(saved);
      expect(await database().select().from(messages)).toHaveLength(1);
      expect((await caller(spanish).messaging.list()).items[0].unread).toBe(1);
      expect(await caller(spanish).messaging.notifications()).toMatchObject({
        unread: 1,
        items: [
          {
            conversationId: starts[0].id,
            messageId: saved.id,
            name: "موظف عربي",
          },
        ],
      });
      expect(await caller(arabic).messaging.notifications()).toEqual({
        unread: 0,
        waiting: 0,
        items: [],
      });
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                status: "completed",
                output: [
                  {
                    type: "message",
                    content: [
                      {
                        type: "output_text",
                        text: JSON.stringify({
                          text: "Hola",
                          sourceLocale: "ar",
                          needsReview: false,
                        }),
                      },
                    ],
                  },
                ],
              })
            )
        )
      );
      expect(await runTranslationStep()).toBe(true);
      const incoming = await caller(spanish).messaging.thread({
        conversationId: first.conversationId,
      });
      expect(incoming.items[0]).toMatchObject({
        original: "مرحبا",
        own: false,
        translation: { text: "Hola", status: "done" },
      });
      await caller(spanish).messaging.read({
        conversationId: first.conversationId,
        messageId: saved.id,
      });
      expect((await caller(spanish).messaging.list()).items[0].unread).toBe(0);
      expect(await caller(spanish).messaging.notifications()).toEqual({
        unread: 0,
        waiting: 0,
        items: [],
      });
      expect(
        (
          await caller(arabic).messaging.thread({
            conversationId: first.conversationId,
          })
        ).items[0].read
      ).toBe(true);
      await caller(spanish).messaging.send({
        ...input(first.conversationId, "Hola"),
        locale: "es",
      });
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                status: "completed",
                output: [
                  {
                    type: "message",
                    content: [
                      {
                        type: "output_text",
                        text: JSON.stringify({
                          text: "مرحبًا",
                          sourceLocale: "es",
                          needsReview: false,
                        }),
                      },
                    ],
                  },
                ],
              })
            )
        )
      );
      await runTranslationStep();
      expect(
        (
          await caller(arabic).messaging.thread({
            conversationId: first.conversationId,
          })
        ).items[1].translation?.text
      ).toBe("مرحبًا");
    });
    it("keeps private staff messages away from nonparticipants, owners, customers and suspended staff", async () => {
      const { id } = await caller(arabic).messaging.direct({
        recipientId: spanish,
      });
      await caller(arabic).messaging.send(input(id));
      await expect(
        caller(ownerId()).messaging.thread({ conversationId: id })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        caller(null, "a".repeat(64)).messaging.support.thread({
          conversationId: id,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(caller(null).messaging.list()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await expect(
        caller(arabic, undefined, "https://evil.example").messaging.send(
          input(id)
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await database()
        .update(teamMembers)
        .set({ status: "suspended" })
        .where(eq(teamMembers.userId, spanish));
      await expect(
        caller(spanish).messaging.thread({ conversationId: id })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        caller(arabic).messaging.send(input(id))
      ).rejects.toMatchObject({ message: "messaging_recipient" });
    });
    it("queues an offline handoff with its history, then assigns when an employee becomes available", async () => {
      const guest = caller(null, "a".repeat(64));
      const request = handoff();
      const { id } = await guest.messaging.support.start(request);
      await guest.messaging.support.start(request);
      let thread = await guest.messaging.support.thread({ conversationId: id });
      expect(thread.status).toBe("waiting");
      expect(thread.items).toHaveLength(3);
      expect(thread.items.filter(m => m.imported)).toHaveLength(2);
      expect((await caller(arabic).messaging.list()).queue[0].id).toBe(id);
      expect(await caller(arabic).messaging.notifications()).toEqual({
        unread: 0,
        waiting: 1,
        items: [],
      });
      const auditor = await staff("Auditor", "auditor");
      expect(await caller(auditor).messaging.notifications()).toEqual({
        unread: 0,
        waiting: 0,
        items: [],
      });
      await expect(
        caller(spanish).messaging.thread({ conversationId: id })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await caller(arabic).messaging.presence({
        locale: "ar",
        available: true,
      });
      thread = await guest.messaging.support.thread({ conversationId: id });
      expect(thread).toMatchObject({
        status: "assigned",
        assignedUserId: arabic,
        agentName: "موظف عربي",
      });
      expect(
        (await caller(arabic).messaging.thread({ conversationId: id })).items
      ).toHaveLength(3);
      const [queued] = await database()
        .select()
        .from(translations)
        .where(eq(translations.locale, "ar"));
      expect(queued).toBeTruthy();
      await caller(arabic).messaging.send(input(id, "كيف أساعدك؟"));
      expect(
        (
          await database()
            .select()
            .from(translations)
            .where(eq(translations.locale, "es"))
        ).length
      ).toBe(1);
      await guest.messaging.support.close({ conversationId: id });
      await expect(
        guest.messaging.support.send({ ...input(id), locale: "es" })
      ).rejects.toMatchObject({ message: "messaging_closed" });
    });
    it("binds every public operation to the visitor cookie, never a submitted conversation ID alone", async () => {
      const guest = caller(null, "b".repeat(64)),
        intruder = caller(null, "c".repeat(64));
      const { id } = await guest.messaging.support.start(handoff());
      expect((await guest.messaging.support.current())?.id).toBe(id);
      expect(await intruder.messaging.support.current()).toBeNull();
      await expect(
        intruder.messaging.support.thread({ conversationId: id })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        intruder.messaging.support.send(input(id))
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        intruder.messaging.support.prepare({
          conversationId: id,
          messageIds: [1],
          retry: false,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        intruder.messaging.support.close({ conversationId: id })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        JSON.stringify(
          await guest.messaging.support.thread({ conversationId: id })
        )
      ).not.toContain(
        createHash("sha256").update("b".repeat(64)).digest("hex")
      );
    });
    it("routes fairly, enforces capacity, and recovers when an assigned employee leaves", async () => {
      await caller(arabic).messaging.presence({
        locale: "ar",
        available: true,
      });
      await caller(spanish).messaging.presence({
        locale: "es",
        available: true,
      });
      // Use the shared database function to avoid one fixture IP's public anti-abuse cap.
      const { startSupport } = await import("./messagingDb");
      const created = [];
      for (let n = 0; n < 11; n++)
        created.push(
          await startSupport(
            createHash("sha256").update(`capacity-${n}`).digest("hex"),
            handoff()
          )
        );
      const all = await database().select().from(chats);
      expect(all.filter((c: any) => c.assignedUserId === arabic)).toHaveLength(
        5
      );
      expect(all.filter((c: any) => c.assignedUserId === spanish)).toHaveLength(
        5
      );
      expect(all.filter((c: any) => c.status === "waiting")).toHaveLength(1);
      const first = all.find((c: any) => c.assignedUserId === arabic);
      await expect(
        caller(spanish).messaging.assign({
          conversationId: first.id,
          userId: spanish,
        })
      ).rejects.toMatchObject({ message: "messaging_already_assigned" });
      await database()
        .update(prefs)
        .set({ lastSeenAt: new Date(Date.now() - 180000) })
        .where(eq(prefs.userId, arabic));
      await dispatchSupport();
      expect(
        await database().select().from(chats).where(eq(chats.status, "waiting"))
      ).toHaveLength(6);
      await expect(
        caller(arabic).messaging.send(input(first.id))
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("expires visitor access on the server and rotates the session for a new request", async () => {
      const guest = caller(null, "e".repeat(64));
      const { id } = await guest.messaging.support.start(handoff());
      await database()
        .update(chats)
        .set({ visitorExpiresAt: new Date(Date.now() - 1000) })
        .where(eq(chats.id, id));
      expect(await guest.messaging.support.current()).toBeNull();
      await expect(
        guest.messaging.support.thread({ conversationId: id })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        guest.messaging.support.send(input(id))
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const next = await guest.messaging.support.start(handoff());
      expect(next.id).not.toBe(id);
      const [closed] = await database()
        .select()
        .from(chats)
        .where(eq(chats.id, id));
      expect(closed.status).toBe("closed");
      await expect(
        guest.messaging.support.thread({ conversationId: next.id })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("lets an owner reassign customer support while removing the previous employee's access", async () => {
      await caller(arabic).messaging.presence({
        locale: "ar",
        available: true,
      });
      const { id } = await caller(null, "d".repeat(64)).messaging.support.start(
        handoff()
      );
      await caller(spanish).messaging.presence({
        locale: "es",
        available: true,
      });
      await caller(ownerId()).messaging.assign({
        conversationId: id,
        userId: spanish,
      });
      await expect(
        caller(arabic).messaging.thread({ conversationId: id })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        (await caller(spanish).messaging.thread({ conversationId: id })).status
      ).toBe("assigned");
    });
    it("recovers a crashed translation lease and reports failure without dropping the original", async () => {
      const { id } = await caller(arabic).messaging.direct({
        recipientId: spanish,
      });
      await caller(arabic).messaging.send(input(id));
      await database()
        .update(translations)
        .set({
          status: "working",
          lease: randomUUID(),
          leaseUntil: new Date(Date.now() - 1000),
        });
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("unavailable", { status: 503 }))
      );
      for (let n = 0; n < 3; n++) {
        await runTranslationStep();
        await database()
          .update(translations)
          .set({ retryAt: new Date(Date.now() - 1000) });
      }
      const result = await caller(spanish).messaging.thread({
        conversationId: id,
      });
      expect(result.items[0]).toMatchObject({
        original: "مرحبا",
        translation: { text: null, status: "failed" },
      });
      await caller(spanish).messaging.prepare({
        conversationId: id,
        messageIds: [result.items[0].id],
        retry: true,
      });
      expect((await database().select().from(translations))[0].status).toBe(
        "queued"
      );
    });
    it("uses atomic budgets and translates each message once under concurrent workers", async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () => messagingBudget("concurrency", 3))
      );
      expect(
        results.filter(result => result.status === "fulfilled")
      ).toHaveLength(3);
      const { id } = await caller(arabic).messaging.direct({
        recipientId: spanish,
      });
      await caller(arabic).messaging.send(input(id));
      const fetch = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: "completed",
              output: [
                {
                  type: "message",
                  content: [
                    {
                      type: "output_text",
                      text: JSON.stringify({
                        text: "Hola",
                        sourceLocale: "ar",
                        needsReview: false,
                      }),
                    },
                  ],
                },
              ],
            })
          )
      );
      vi.stubGlobal("fetch", fetch);
      await Promise.all([runTranslationStep(), runTranslationStep()]);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    it("lets managers follow every customer conversation without exposing private team chats or changing others' receipts", async () => {
      await caller(arabic).messaging.presence({
        locale: "ar",
        available: true,
      });
      const guest = caller(null, "a".repeat(64));
      const { id } = await guest.messaging.support.start(handoff());
      const reply = await caller(arabic).messaging.send(
        input(id, "كيف أساعدك؟")
      );
      const owner = caller(ownerId());
      const managed = await owner.messaging.list({
        kind: "support",
        status: "open",
      });
      expect(managed.items).toHaveLength(1);
      expect(managed.items[0]).toMatchObject({
        id,
        assignedUserId: arabic,
        agentName: "موظف عربي",
        unread: 2,
      });
      expect(
        (await caller(spanish).messaging.list({ kind: "support" })).items
      ).toHaveLength(0);
      expect(
        (await owner.messaging.thread({ conversationId: id })).items.some(
          item => item.id === reply.id
        )
      ).toBe(true);
      await owner.messaging.read({ conversationId: id, messageId: reply.id });
      expect(
        (await owner.messaging.list({ kind: "support" })).items[0].unread
      ).toBe(0);
      expect((await caller(arabic).messaging.notifications()).unread).toBe(1);
      expect((await owner.messaging.notifications()).unread).toBe(0);
      expect(await guest.messaging.support.current()).toMatchObject({
        id,
        unread: 1,
        lastIncomingId: reply.id,
      });
      await guest.messaging.support.send({
        ...input(id, "Gracias"),
        locale: "es",
      });
      expect(await guest.messaging.support.current()).toMatchObject({
        unread: 1,
        lastIncomingId: reply.id,
      });
      expect(
        await caller(null, "b".repeat(64)).messaging.support.current()
      ).toBeNull();
      const privateChat = await caller(arabic).messaging.direct({
        recipientId: spanish,
      });
      await caller(arabic).messaging.send(input(privateChat.id));
      expect(
        (await owner.messaging.list({ kind: "direct" })).items
      ).toHaveLength(0);
      await expect(
        owner.messaging.thread({ conversationId: privateChat.id })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        owner.messaging.read({
          conversationId: privateChat.id,
          messageId: reply.id,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await guest.messaging.support.read({
        conversationId: id,
        messageId: reply.id,
      });
      expect((await guest.messaging.support.current())?.unread).toBe(0);
      await guest.messaging.support.close({ conversationId: id });
      expect(
        (await owner.messaging.list({ kind: "support", status: "open" })).items
      ).toHaveLength(0);
      expect(
        (await owner.messaging.list({ kind: "support", status: "closed" }))
          .items[0].id
      ).toBe(id);
    });
    it("counts incoming notifications beyond inbox pagination and denies suspended staff", async () => {
      const rows = Array.from({ length: 65 }, () => ({
        id: randomUUID(),
        kind: "support" as const,
        status: "closed" as const,
        assignedUserId: spanish,
      }));
      await database().insert(chats).values(rows);
      await database()
        .insert(messages)
        .values(
          rows.map((chat, n) => ({
            conversationId: chat.id,
            clientId: `notification-seed-${n}`,
            sender: "visitor",
            original: "Customer message",
            sourceLocale: "es",
          }))
        );
      await database().insert(messages).values({
        conversationId: rows[0].id,
        clientId: "own-reply",
        sender: "staff",
        senderUserId: spanish,
        original: "My reply",
        sourceLocale: "es",
      });
      await database().insert(messages).values({
        conversationId: rows[0].id,
        clientId: "imported-history",
        sender: "assistant",
        imported: true,
        original: "Old history",
        sourceLocale: "es",
      });
      const page = await caller(spanish).messaging.list({ kind: "support" });
      expect(page.items).toHaveLength(60);
      const unread = await caller(spanish).messaging.notifications();
      expect(unread.unread).toBe(65);
      expect(unread.items).toHaveLength(60);
      expect(Object.keys(unread.items[0]).sort()).toEqual([
        "conversationId",
        "kind",
        "messageId",
        "name",
      ]);
      expect((await caller(arabic).messaging.notifications()).unread).toBe(0);
      const next = await caller(spanish).messaging.list({
        kind: "support",
        before: page.nextCursor!,
      });
      expect(next.items).toHaveLength(5);
      expect((await caller(spanish).messaging.notifications()).unread).toBe(65);
      await database()
        .update(teamMembers)
        .set({ status: "suspended" })
        .where(eq(teamMembers.userId, spanish));
      await expect(
        caller(spanish).messaging.notifications()
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("paginates messages and queues translations only for authorized requested rows", async () => {
      const { id } = await caller(arabic).messaging.direct({
        recipientId: spanish,
      });
      await database()
        .insert(messages)
        .values(
          Array.from({ length: 55 }, (_, n) => ({
            conversationId: id,
            clientId: `seed-${n}`,
            sender: "staff",
            senderUserId: arabic,
            original: `message ${n}`,
            sourceLocale: "en",
          }))
        );
      const latest = await caller(spanish).messaging.thread({
        conversationId: id,
      });
      expect(latest.items).toHaveLength(50);
      const older = await caller(spanish).messaging.thread({
        conversationId: id,
        before: latest.nextCursor!,
      });
      expect(older.items).toHaveLength(5);
      expect(older.items.at(-1)!.id).toBeLessThan(latest.items[0].id);
      await caller(spanish).messaging.prepare({
        conversationId: id,
        messageIds: [latest.items[0].id, 2147483647],
        retry: false,
      });
      expect(await database().select().from(translations)).toHaveLength(1);
    });
  });
}
