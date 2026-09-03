import fs from 'fs';
import path from 'path';
import { decryptKnowledgeBase } from '../core/vault/index.js';

async function run() {
  const encryptedFile = path.resolve(process.cwd(), 'test.venc');
  
  if (!fs.existsSync(encryptedFile)) {
    console.error(`File not found: ${encryptedFile}`);
    return;
  }
  
  const encryptedBuf = fs.readFileSync(encryptedFile);
  const password = "password123";
  
  console.log(`Trying to decrypt ${encryptedFile} with password: "${password}"...`);
  
  try {
    const decrypted = await decryptKnowledgeBase(encryptedBuf, password);
    console.log("-> SUCCESS: Decryption succeeded! Recovered data length:", JSON.stringify(decrypted).length);
  } catch (err) {
    console.error("-> ERROR: Decryption failed for correct password:", err.message);
  }
}

run().catch(console.error);
