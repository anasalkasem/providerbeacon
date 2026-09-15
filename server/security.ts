import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

export const STAFF_SESSION_COOKIE = "__Host-pb_staff_session";
export const STAFF_SESSION_HOURS = 12;
export const PENDING_MFA_MINUTES = 10;

export type EncryptedValue = {
  ciphertext: string;
  iv: string;
  tag: string;
  version: number;
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function assertStrongPassword(password: string) {
  if (password.length < 14 || password.length > 128) {
    throw new Error("Password must contain 14 to 128 characters");
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error("Password must include uppercase, lowercase, number, and symbol characters");
  }
}

export async function hashPassword(password: string) {
  assertStrongPassword(password);
  return encodePassword(password);
}

// Policy belongs to each account system; both use the same salted scrypt format.
export async function encodePassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY,
  }) as Buffer;
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, nRaw, rRaw, pRaw, saltRaw, hashRaw] = encoded.split("$");
  if (algorithm !== "scrypt" || !nRaw || !rRaw || !pRaw || !saltRaw || !hashRaw) return false;
  const expected = Buffer.from(hashRaw, "base64url");
  const actual = await scrypt(password, Buffer.from(saltRaw, "base64url"), expected.length, {
    N: Number(nRaw),
    r: Number(rRaw),
    p: Number(pRaw),
    maxmem: SCRYPT_MAX_MEMORY,
  }) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function decodeMasterKey(raw: string) {
  if (!raw) throw new Error("VAULT_MASTER_KEY is not configured");
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const decoded = Buffer.from(raw, raw.includes("-") || raw.includes("_") ? "base64url" : "base64");
  if (decoded.length !== 32) throw new Error("VAULT_MASTER_KEY must decode to exactly 32 bytes");
  return decoded;
}

export function encryptValue(plaintext: string, purpose: string): EncryptedValue {
  const key = decodeMasterKey(process.env.VAULT_MASTER_KEY ?? "");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`providerbeacon:${purpose}:v1`));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    version: 1,
  };
}

export function decryptValue(value: EncryptedValue, purpose: string) {
  if (value.version !== 1) throw new Error("Unsupported encrypted value version");
  const key = decodeMasterKey(process.env.VAULT_MASTER_KEY ?? "");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64url"));
  decipher.setAAD(Buffer.from(`providerbeacon:${purpose}:v1`));
  decipher.setAuthTag(Buffer.from(value.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashRecoveryCode(code: string) {
  const pepper = process.env.AUTH_PEPPER ?? "";
  if (!pepper) throw new Error("AUTH_PEPPER is not configured");
  return createHmac("sha256", pepper).update(code.replace(/\s|-/g, "").toUpperCase()).digest("hex");
}

export function constantTimeTokenMatch(input: string, expected: string) {
  const inputHash = createHash("sha256").update(input).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(inputHash, expectedHash);
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(6).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
  });
}
