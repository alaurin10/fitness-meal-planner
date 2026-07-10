import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Garmin OAuth tokens are encrypted at rest with AES-256-GCM. The key lives in
// GARMIN_TOKEN_ENC_KEY (base64, 32 bytes — `openssl rand -base64 32`). The key
// is read lazily so a missing var only affects Garmin endpoints, never startup.

export class GarminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GarminConfigError";
  }
}

function encryptionKey(): Buffer {
  const raw = process.env.GARMIN_TOKEN_ENC_KEY;
  if (!raw) {
    throw new GarminConfigError(
      "GARMIN_TOKEN_ENC_KEY is not set — generate one with `openssl rand -base64 32`",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new GarminConfigError("GARMIN_TOKEN_ENC_KEY must be 32 bytes, base64-encoded");
  }
  return key;
}

// Blob format: base64(iv).base64(authTag).base64(ciphertext)
export function encryptJson(value: unknown): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptJson<T>(blob: string): T {
  const key = encryptionKey();
  const parts = blob.split(".");
  if (parts.length !== 3) {
    throw new GarminConfigError("Stored Garmin token blob is malformed");
  }
  const [iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv!);
  decipher.setAuthTag(tag!);
  const plaintext = Buffer.concat([decipher.update(ciphertext!), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
