// vault module – provides encryption/decryption for knowledge bases
// This file intentionally hides low‑level details from end‑users.
import crypto from "crypto";
import { argon2id } from "hash-wasm";
import dotenv from "dotenv";
import path from "path";

// Load .env (contains VECTOR_APP_SECRET)
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
const APP_SECRET = process.env.VECTOR_APP_SECRET;

if (!APP_SECRET) {
  console.warn("Environment variable VECTOR_APP_SECRET is not set. The key file will not be read.");
}

/**
 * Derive an AES‑256‑GCM key from the user's password and a random salt.
 * The secret (APP_SECRET) is blended via HMAC to prevent offline attacks.
 */
async function deriveArgon2Key(userPassword, salt) {
  const secretKey = APP_SECRET || "default_dev_secret_fallback";
  const blended = crypto.createHmac("sha256", secretKey).update(userPassword).digest("hex");
  const keyHex = await argon2id({
    password: blended,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64 MiB
    hashLength: 32,
    outputType: "hex",
  });
  return Buffer.from(keyHex, "hex");
}

/** Encrypt a JSON knowledge‑base object.
 * Returns a Buffer ready to be written as ".venc".
 */
export async function encryptKnowledgeBase(jsonData, userPassword) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = await deriveArgon2Key(userPassword, salt);
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

  const key = await deriveArgon2Key(userPassword, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}
