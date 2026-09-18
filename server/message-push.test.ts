import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import webpush from "web-push";
import { pushEndpoint } from "../shared/push";
import { pushPayload, validatePushKeys } from "./messagePush";
describe("push transport boundaries", () => {
  it.each([
    "http://fcm.googleapis.com/a",
    "https://localhost/a",
    "https://127.0.0.1/a",
    "https://fcm.googleapis.com.evil.test/a",
    "https://evil.test@web.push.apple.com/a",
    "https://web.push.apple.com:8443/a",
    "https://web.push.apple.com/a#fragment",
    "https://notify.windows.com.evil.test/a",
  ])("rejects untrusted endpoint %s", endpoint => {
    expect(pushEndpoint.safeParse(endpoint).success).toBe(false);
  });
  it.each([
    "https://fcm.googleapis.com/fcm/send/token",
    "https://web.push.apple.com/token",
    "https://updates.push.services.mozilla.com/wpush/v2/token",
    "https://wns2-test.notify.windows.com/w/?token=opaque",
  ])("accepts a supported push service %s", endpoint => {
    expect(pushEndpoint.safeParse(endpoint).success).toBe(true);
  });
  it("validates actual curve points, not just a base64-shaped key", () => {
    const keys = {
      p256dh: webpush.generateVAPIDKeys().publicKey,
      auth: randomBytes(16).toString("base64url"),
    };
    expect(() =>
      validatePushKeys({ endpoint: "https://web.push.apple.com/a", keys })
    ).not.toThrow();
    expect(() =>
      validatePushKeys({
        endpoint: "https://web.push.apple.com/a",
        keys: { ...keys, p256dh: Buffer.alloc(65, 4).toString("base64url") },
      })
    ).toThrow("push_key");
  });
  it("uses generic localized content without message text or names", () => {
    const payload = JSON.parse(
      pushPayload("ar", "/admin?messageThread=example")
    );
    expect(payload.title).toBe("ProviderBeacon");
    expect(payload.body).toBe(
      "لديك رسالة جديدة. افتح ProviderBeacon لقراءتها."
    );
    expect(Object.keys(payload).sort()).toEqual([
      "body",
      "tag",
      "title",
      "url",
    ]);
  });
});
