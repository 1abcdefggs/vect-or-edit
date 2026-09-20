import path from 'node:path';
import fs from 'node:fs';

let engine: any = null;
let rustBinaryLoaded = false;
let _vault: { decryptKnowledgeBase: (buf: Buffer, pw: string) => Promise<any> } | null = null;

export async function initRustEngine() {
  // Vault: Dual Lock decryption (hash-wasm + AES-256-GCM)
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – vault is optional; no declaration file required
    const m = await import('../../../core/vault/index.js');
    _vault = m;
  } catch (err) {
    // optional
  }


  // Change code20260920, When searching for the engine binary, the editor checks candidate paths in order and loads the first one it finds. Near the beginning of this list of candidates, there are ten entries with version-specific filenames—such as `vect-or-engine-v0.3.0.win32-x64-msvc.node`. I have fixed the issue here, mirroring the change made on the engine side to use a version-agnostic filename.
  const candidateEnginePaths = [
    // 1. Packaged Electron app (unpacked asar resources or extraResources)
    path.join(process.resourcesPath || '', 'vect-or-engine/vect-or-engine.win32-x64-msvc.node'),
    path.join(process.resourcesPath || '', 'vect-or-engine/vect-or-engine.node'),
    path.join(process.resourcesPath || '', 'vect-or-engine/index.js'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked/node_modules/@1abcdefggs/vect-or-engine/vect-or-engine.win32-x64-msvc.node'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked/node_modules/@1abcdefggs/vect-or-engine/index.js'),
    path.join(process.resourcesPath || '', 'vect-or-engine.win32-x64-msvc.node'),
    path.join(process.resourcesPath || '', 'vect-or-engine.node'),

    // 2. Development relative workspace paths
    path.join(__dirname, '../../../vect-or-engine/vect-or-engine.win32-x64-msvc.node'),
    path.join(__dirname, '../../../vect-or-engine/index.js'),
    path.join(process.cwd(), '../vect-or-engine/vect-or-engine.win32-x64-msvc.node'),
    path.join(process.cwd(), '../vect-or-engine/index.js'),
    path.join(__dirname, '../../vect-or-engine/index.js'),
    path.join(process.cwd(), 'node_modules/@1abcdefggs/vect-or-engine/index.js'),
    path.join(process.cwd(), 'node_modules/@vect-or-engine/core/index.js')
  ];

  for (const candidate of candidateEnginePaths) {
    try {
      if (fs.existsSync(candidate)) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        engine = require(candidate);
        if (engine) {
          rustBinaryLoaded = true;
          console.log(`[App] Successfully bound Rust N-API engine from: ${candidate}`);
          break;
        }
      }
    } catch (e) {
      // Continue searching other candidates
    }
  }

  if (!rustBinaryLoaded) {
    try {
      engine = require('@1abcdefggs/vect-or-engine');
      rustBinaryLoaded = true;
      console.log('[App] Successfully bound Rust N-API engine from package @1abcdefggs/vect-or-engine');
    } catch (e1) {
      try {
        engine = require('@vect-or-engine/core');
        rustBinaryLoaded = true;
        console.log('[App] Successfully bound Rust N-API engine from legacy package @vect-or-engine/core');
      } catch (e2) {
        console.error('[App] Failed to bind Rust N-API engine binary:', e1);
      }
    }
  }

  if (engine) {
    if (typeof engine.search !== 'function' || typeof engine.validateSync !== 'function') {
      console.warn('[App] WARNING: Loaded Rust engine is missing required APIs (search or validateSync). Check ABI compatibility.');
    } else {
      console.log('[App] Engine API validation passed.');
    }
  }
}

export function getEngine() {
  return engine;
}

export function isRustBinaryLoaded() {
  return rustBinaryLoaded;
}

export function getVault() {
  return _vault;
}
