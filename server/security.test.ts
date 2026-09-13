import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertScheduledWorkflowClaims } from "./schedulerAuth";
import { STAFF_SESSION_COOKIE, assertStrongPassword, decryptValue, encryptValue, hashPassword, verifyPassword } from "./security";

const originalVaultKey = process.env.VAULT_MASTER_KEY;
const originalPepper = process.env.AUTH_PEPPER;

beforeEach(() => {
  process.env.VAULT_MASTER_KEY = Buffer.alloc(32, 7).toString("base64url");
  process.env.AUTH_PEPPER = Buffer.alloc(32, 9).toString("base64url");
});

afterEach(() => {
  process.env.VAULT_MASTER_KEY = originalVaultKey;
  process.env.AUTH_PEPPER = originalPepper;
});

describe("independent authentication security", () => {
  it("hashes passwords with per-password scrypt salts", async () => {
    const password = "ProviderBeacon!Owner2026";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword("wrong-password", first)).toBe(false);
  });

  it("enforces a strong password policy", () => {
    expect(() => assertStrongPassword("weakpassword")).toThrow();
    expect(() => assertStrongPassword("StrongPassword!2026")).not.toThrow();
  });

  it("encrypts provider credentials with authenticated purpose binding", () => {
    const encrypted = encryptValue("provider-secret", "provider-integration:42");
    expect(encrypted.ciphertext).not.toContain("provider-secret");
    expect(decryptValue(encrypted, "provider-integration:42")).toBe("provider-secret");
    expect(() => decryptValue(encrypted, "provider-integration:43")).toThrow();
  });

  it("uses a host-only cookie name", () => {
    expect(STAFF_SESSION_COOKIE.startsWith("__Host-")).toBe(true);
  });
});

describe("scheduled synchronization identity", () => {
  const valid = {
    aud: "https://providerbeacon.com",
    repository: "anasalkasem/providerbeacon",
    ref: "refs/heads/main",
    event_name: "schedule",
    sub: "repo:anasalkasem/providerbeacon:ref:refs/heads/main",
    run_id: "123",
  };

  it("accepts the scheduled workflow on main", () => {
    expect(assertScheduledWorkflowClaims(valid)).toMatchObject({ repository: "anasalkasem/providerbeacon", eventName: "schedule" });
    expect(assertScheduledWorkflowClaims({ ...valid, sub: "repo:anasalkasem/providerbeacon" })).toMatchObject({
      repository: "anasalkasem/providerbeacon",
    });
    expect(assertScheduledWorkflowClaims({ ...valid, sub: "repo:anasalkasem/providerbeacon:environment:production" })).toMatchObject({
      eventName: "schedule",
    });
  });

  it("rejects another repository or pull-request ref", () => {
    expect(() => assertScheduledWorkflowClaims({ ...valid, repository: "attacker/repo" })).toThrow();
    expect(() => assertScheduledWorkflowClaims({ ...valid, ref: "refs/pull/1/merge" })).toThrow();
    expect(() => assertScheduledWorkflowClaims({ ...valid, sub: undefined })).toThrow();
  });
});
