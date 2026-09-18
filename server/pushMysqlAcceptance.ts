import { randomBytes, randomUUID } from "node:crypto";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { pushDevices } from "../drizzle/pushSchema";
import { users, teamMembers, staffSessions } from "../drizzle/schema";
import { conversations, conversationMembers } from "../drizzle/messagingSchema";
import {
  pushIdentity,
  pushIdentityKey,
  subscribePush,
  unsubscribePush,
  runPushStep,
  pushStatus,
  type PushIdentity,
} from "./messagePush";
import { sendChatMessage, readChat, type ChatActor } from "./messagingDb";
import { hashToken } from "./security";
export function pushAcceptanceCases(
  database: () => any,
  ownerId: () => number
) {
  describe("durable phone notifications", () => {
    let peer: number,
      chat: string,
      identity: PushIdentity,
      subscription: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
    let transport: MockInstance<typeof webpush.sendNotification>;
    const actor = (): ChatActor => ({
      kind: "staff",
      userId: ownerId(),
      role: "administrator",
    });
    const message = () => ({
      conversationId: chat,
      clientId: randomUUID(),
      text: "Private message never included in push",
      locale: "en" as const,
    });
    const due = () =>
      database()
        .update(pushDevices)
        .set({ nextAt: new Date(1000) });
    beforeEach(async () => {
      await database().delete(pushDevices);
      const vapid = webpush.generateVAPIDKeys();
      vi.stubEnv("WEB_PUSH_PUBLIC_KEY", vapid.publicKey);
      vi.stubEnv("WEB_PUSH_PRIVATE_KEY", vapid.privateKey);
      transport = vi
        .spyOn(webpush, "sendNotification")
        .mockResolvedValue({ statusCode: 201, headers: {}, body: "" });
      const [{ id }] = await database()
        .insert(users)
        .values({ openId: `push-${randomUUID()}`, name: "Push recipient" })
        .$returningId();
      peer = id;
      await database()
        .insert(teamMembers)
        .values({
          userId: peer,
          email: `${peer}@push.example`,
          role: "catalogue_editor",
          status: "active",
        });
      const token = randomUUID();
      await database()
        .insert(staffSessions)
        .values({
          userId: peer,
          tokenHash: hashToken(token),
          mfaVerified: true,
          expiresAt: new Date(Date.now() + 3600000),
        });
      identity = await pushIdentity(
        { kind: "staff", userId: peer, role: "catalogue_editor" },
        token
      );
      chat = randomUUID();
      await database()
        .insert(conversations)
        .values({ id: chat, kind: "direct" });
      await database()
        .insert(conversationMembers)
        .values([
          { conversationId: chat, userId: peer },
          { conversationId: chat, userId: ownerId() },
        ]);
      subscription = {
        endpoint: `https://web.push.apple.com/${randomUUID()}`,
        keys: {
          p256dh: webpush.generateVAPIDKeys().publicKey,
          auth: randomBytes(16).toString("base64url"),
        },
      };
      await subscribePush(identity, {
        subscription,
        locale: "ar",
        identity: pushIdentityKey(identity),
      });
    });
    it("queues atomically, encrypts endpoints, coalesces retries and claims a delivery only once", async () => {
      const input = message();
      const first = await sendChatMessage(actor(), input);
      expect(await sendChatMessage(actor(), input)).toEqual(first);
      const [device] = await database().select().from(pushDevices);
      expect(device.encrypted).not.toContain(subscription.endpoint);
      expect(device.encrypted).not.toContain(subscription.keys.auth);
      expect(device.queuedId).toBe(first.id);
      await due();
      await Promise.all([runPushStep(), runPushStep()]);
      expect(transport).toHaveBeenCalledOnce();
      const payload = JSON.parse(String(transport.mock.calls[0][1]));
      expect(payload.body).not.toContain(input.text);
      expect(payload.url).toContain(chat);
      await sendChatMessage(actor(), input);
      expect(await runPushStep()).toBe(false);
      const [done] = await database().select().from(pushDevices);
      expect(done.sentId).toBe(first.id);
      expect(done.nextAt).toBeNull();
    });
    it.each(["read", "logout", "suspend"])(
      "does not deliver after %s",
      async mode => {
        const row = await sendChatMessage(actor(), message());
        if (mode === "read")
          await readChat(
            { kind: "staff", userId: peer, role: "catalogue_editor" },
            chat,
            row.id
          );
        if (mode === "logout")
          await database()
            .delete(staffSessions)
            .where(eq(staffSessions.userId, peer));
        if (mode === "suspend")
          await database()
            .update(teamMembers)
            .set({ status: "suspended" })
            .where(eq(teamMembers.userId, peer));
        await due();
        await runPushStep();
        expect(transport).not.toHaveBeenCalled();
      }
    );
    it("retries transient failures and retires expired endpoints", async () => {
      await sendChatMessage(actor(), message());
      await due();
      transport.mockRejectedValueOnce({ statusCode: 503 });
      await runPushStep();
      const [pending] = await database().select().from(pushDevices);
      expect(pending.sentId).toBe(0);
      expect(pending.attempts).toBe(1);
      expect(pending.nextAt.getTime()).toBeGreaterThan(Date.now());
      await due();
      transport.mockRejectedValueOnce({ statusCode: 410 });
      await runPushStep();
      expect(await database().select().from(pushDevices)).toHaveLength(0);
    });
    it("requires matching identity and supports explicit device revocation", async () => {
      await expect(
        subscribePush(identity, {
          subscription,
          locale: "en",
          identity: "0".repeat(64),
        })
      ).rejects.toThrow("push_identity_changed");
      await unsubscribePush(
        identity,
        subscription.endpoint,
        pushIdentityKey(identity)
      );
      await sendChatMessage(actor(), message());
      expect(await runPushStep()).toBe(false);
      expect((await pushStatus(identity)).devices).toHaveLength(0);
    });
    it("delivers a support reply only to the matching, unexpired visitor", async () => {
      await database().delete(pushDevices);
      const key = randomBytes(32).toString("hex");
      chat = randomUUID();
      await database()
        .insert(conversations)
        .values({
          id: chat,
          kind: "support",
          visitorKey: key,
          visitorExpiresAt: new Date(Date.now() + 3600000),
          assignedUserId: ownerId(),
          status: "assigned",
        });
      await database()
        .insert(conversationMembers)
        .values({ conversationId: chat, userId: ownerId() });
      identity = await pushIdentity({ kind: "visitor", key });
      await subscribePush(identity, {
        subscription,
        locale: "es",
        identity: pushIdentityKey(identity),
      });
      await sendChatMessage(actor(), message());
      await due();
      await runPushStep();
      expect(transport).toHaveBeenCalledOnce();
      expect(JSON.parse(String(transport.mock.calls[0][1])).url).toBe(
        `/?supportThread=${chat}`
      );
      transport.mockClear();
      await sendChatMessage(actor(), message());
      await database()
        .update(conversations)
        .set({ visitorExpiresAt: new Date(1000) })
        .where(eq(conversations.id, chat));
      await due();
      await runPushStep();
      expect(transport).not.toHaveBeenCalled();
    });
  });
}
