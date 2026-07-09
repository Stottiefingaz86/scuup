import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/** AES-256-GCM for credential fields. The DB only ever sees ciphertext;
 * CREDENTIALS_KEY (32-byte hex) stays in the server environment. */

function key(): Buffer {
  const hex = process.env.CREDENTIALS_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "CREDENTIALS_KEY must be a 32-byte hex string — generate one with `openssl rand -hex 32`."
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("malformed secret");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
