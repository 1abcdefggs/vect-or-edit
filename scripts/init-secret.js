import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';


const ENV_PATH = path.resolve(process.cwd(), '.env');
const FALLBACK_PASSWORD = 'vectoreditor_default_password_change_me_soon';

/**
 * Generates a secure random 32-byte hex string.
 */
function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Checks if the VECTOR_APP_SECRET is already set in the .env file.
 */
async function hasExistingSecret() {
  if (!existsSync(ENV_PATH)) return false;
  const currentEnv = await fs.readFile(ENV_PATH, 'utf8');
  return currentEnv.includes('VECTOR_APP_SECRET=');
}

/**
 * Extracts the vault password from the existing .env file, or returns a fallback.
 */
async function getVaultPassword() {
  if (!existsSync(ENV_PATH)) return FALLBACK_PASSWORD;

  try {
    const currentEnv = await fs.readFile(ENV_PATH, 'utf8');
    const match = currentEnv.match(/VECTOR_VAULT_PASSWORD=["']?([^"'\n]+)["']?/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (e) {
    console.warn('Failed to read vault password from .env, using fallback.', e);
  }

  console.warn('Vault password not found in .env, using fallback.');
  return FALLBACK_PASSWORD;
}

/**
 * Appends the generated secrets to the .env file.
 */
async function appendSecretsToEnv(secret, vaultPassword) {
  const envContent = `\n# VectOrEditOr Core Secret (DO NOT SHARE)\nVECTOR_APP_SECRET="${secret}"\n\n# Vault Password (CHANGE ME!)\nVECTOR_VAULT_PASSWORD="${vaultPassword}"\n`;
  await fs.appendFile(ENV_PATH, envContent, 'utf8');
}

async function main() {
  try {
    if (await hasExistingSecret()) {
      console.log('Secret key already exists. Initialization skipped.');
      process.exit(0);
    }

    const secureRandomSecret = generateSecret();
    const vaultPassword = await getVaultPassword();

    await appendSecretsToEnv(secureRandomSecret, vaultPassword);
    console.log(' New secret key and vault password have been generated and saved to .env!');
  } catch (error) {
    console.error(' Failed to initialize secrets:', error);
    process.exit(1);
  }
}

main();
