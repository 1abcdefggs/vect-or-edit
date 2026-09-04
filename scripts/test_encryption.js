import fs from 'fs';
import path from 'path';
import { encryptKnowledgeBase, decryptKnowledgeBase } from '../core/vault/index.js';

async function run() {
  console.log("=== Encryption Verification Test ===");
  
  const testData = [
    {
      "id": "test_001",
      "title": "Secret Document",
      "description": "This is a highly confidential document for testing."
    }
  ];
  
  const originalFile = path.resolve(process.cwd(), 'test_original.json');
  const encryptedFile = path.resolve(process.cwd(), 'test.venc');
  
  // 1. Create JSON
  fs.writeFileSync(originalFile, JSON.stringify(testData, null, 2));
  console.log("1. Created original test.json");

  // 2. Encrypt
  const password = "password123";
  console.log(`2. Encrypting with password: "${password}"...`);
  
  const encryptedBuf = await encryptKnowledgeBase(testData, password);
  fs.writeFileSync(encryptedFile, encryptedBuf);
  console.log(`-> Saved as test.venc (${encryptedBuf.length} bytes)`);
  
  // Show file structure
  console.log("\n--- File Structure Analysis ---");
  console.log("Magic bytes (4B):", encryptedBuf.subarray(0, 4).toString());
  console.log("Salt (16B):", encryptedBuf.subarray(4, 20).toString('hex'));
  console.log("IV (12B):", encryptedBuf.subarray(20, 32).toString('hex'));
  console.log("AuthTag (16B):", encryptedBuf.subarray(32, 48).toString('hex'));
  console.log("Ciphertext length:", encryptedBuf.length - 48);
  console.log("Note: The password itself is NOT stored in the file. It is used with the Salt to mathematically derive the AES decryption key.");

  // 3. Test Decryption with WRONG password
  console.log("\n3. Testing decryption with WRONG password...");
  try {
    await decryptKnowledgeBase(encryptedBuf, "wrongpassword");
    console.error("-> ERROR: Decryption succeeded when it should have failed!");
  } catch (err) {
    console.log("-> SUCCESS: Decryption blocked! Error message:", err.message);
  }

  // 4. Test Decryption with CORRECT password
  console.log("\n4. Testing decryption with CORRECT password...");
  try {
    const decrypted = await decryptKnowledgeBase(encryptedBuf, password);
    console.log("-> SUCCESS: Decryption succeeded! Recovered data:");
    console.log(JSON.stringify(decrypted, null, 2));
  } catch (err) {
    console.error("-> ERROR: Decryption failed for correct password:", err.message);
  }
}

run().catch(console.error);
