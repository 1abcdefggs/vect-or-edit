// vault module – provides encryption/decryption for knowledge bases
// This file intentionally hides low‑level details from end‑users.
// The same file lives in vect-or-edit/core/vault/index.js; keep the two identical.
import crypto from "crypto";
import { argon2id } from "hash-wasm";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Shared by the Generator (CLI and Studio, see webVault.js) and the Editor, so a .venc made by one opens in the other.
// It comes from .env, or from the build for the Editor, and must never be written in the source.
function sharedAppSecret() {
  return process.env.VECTOR_SHARED_APP_SECRET || "";
}

// Secrets earlier builds used. They are tried only when decrypting, so existing .venc files keep opening.
// The first one is public, so nothing new may be encrypted with it.
function legacySecrets() {
  return ["VECTOR_APP_DEFAULT_SECRET_2026", process.env.VECTOR_APP_SECRET, "default_dev_secret_fallback"].filter(Boolean);
}

/**
 * Derive an AES‑256‑GCM key from the user's password and a random salt.
 * The app secret is blended via HMAC, so guessing a password also needs the secret.
 * A shipped build can give the secret up, so the password stays the last defence.
 */
async function deriveArgon2Key(userPassword, salt, appSecret) {
  const blended = crypto.createHmac("sha256", appSecret).update(userPassword).digest("hex");
  const keyHex = await argon2id({
    password: blended,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64 MiB
    hashLength: 32,
    outputType: "hex",
  });
  return Buffer.from(keyHex, "hex");
}

/** Encrypt a JSON knowledge‑base object.
 * Returns a Buffer ready to be written as ".venc".
 */
export async function encryptKnowledgeBase(jsonData, userPassword) {
  const appSecret = sharedAppSecret();
  if (!appSecret) {
    throw new Error("VECTOR_SHARED_APP_SECRET is not set. Encryption needs it.");
  }
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = await deriveArgon2Key(userPassword, salt, appSecret);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const plaintext = JSON.stringify(jsonData);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const magic = Buffer.from("VENC");
  return Buffer.concat([magic, salt, iv, authTag, encrypted]);
}

/** Decrypt a ".venc" Buffer back to a JSON object. */
export async function decryptKnowledgeBase(fileBuffer, userPassword) {
  const magic = fileBuffer.subarray(0, 4).toString("utf8");
  if (magic !== "VENC") throw new Error("Invalid file format.");

  const salt = fileBuffer.subarray(4, 20);
  const iv = fileBuffer.subarray(20, 32);
  const authTag = fileBuffer.subarray(32, 48);
  const encrypted = fileBuffer.subarray(48);

  let lastError = null;
  for (const secret of [sharedAppSecret(), ...legacySecrets()].filter(Boolean)) {
    try {
      const key = await deriveArgon2Key(userPassword, salt, secret);
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return JSON.parse(decrypted.toString("utf8"));
    } catch (err) {
      lastError = err; // wrong password or a different secret: try the next one
    }
  }
  throw lastError;
}
