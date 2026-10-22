import { describe, expect, it } from 'vitest';
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../../..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const files: string[] = pkg.build.files;

// Exclusions that keep unused weight out of the Windows distributable:
// sharp and its libvips binaries (LGPL) are a hard dependency of transformers but are unused in the app,
// the other-OS onnxruntime binaries never load on Windows, and _ARCHIVES holds superseded engine builds
const EXCLUSIONS = [
  '!**/node_modules/sharp/**/*',
  '!**/node_modules/@img/**/*',
  '!**/node_modules/onnxruntime-node/bin/napi-v3/linux/**/*',
  '!**/node_modules/onnxruntime-node/bin/napi-v3/darwin/**/*',
  '!**/_ARCHIVES/**/*'
];

type AsarEntry = { files?: Record<string, AsarEntry> };

/** Lists every packed path from the asar header ([4][4][4][4] bytes of sizes, then a JSON index) without reading the body. */
function listAsar(file: string): string[] {
  const fd = openSync(file, 'r');
  let header: AsarEntry;
  try {
    const prefix = Buffer.alloc(16);
    readSync(fd, prefix, 0, 16, 0);
    const json = Buffer.alloc(prefix.readUInt32LE(12));
    readSync(fd, json, 0, json.length, 16);
    header = JSON.parse(json.toString('utf-8'));
  } finally {
    closeSync(fd);
  }
  const paths: string[] = [];
  const walk = (entry: AsarEntry, prefix: string) => {
    for (const [name, child] of Object.entries(entry.files ?? {})) {
      const path = `${prefix}/${name}`;
      paths.push(path);
      walk(child, path);
    }
  };
  walk(header, '');
  return paths;
}

describe('packaging guard: unused weight stays out of the distributable', () => {
  it('lists every exclusion in build.files', () => {
    for (const pattern of EXCLUSIONS) expect(files).toContain(pattern);
  });

  it('keeps the exclusions after the broad includes so they win', () => {
    const lastInclude = Math.max(...files.map((f, i) => (f.startsWith('!') ? -1 : i)));
    for (const pattern of EXCLUSIONS) expect(files.indexOf(pattern)).toBeGreaterThan(lastInclude);
  });

  it('has none of the excluded paths in a built app.asar (checked only when a current build exists)', () => {
    const asar = process.env.VECT_ASAR ?? resolve(root, 'dist/win-unpacked/resources/app.asar');
    if (!existsSync(asar)) return;
    // A build older than package.json predates the current exclusions, so it says nothing about them
    if (!process.env.VECT_ASAR && statSync(asar).mtimeMs < statSync(resolve(root, 'package.json')).mtimeMs) return;
    // electron-builder still copies sharp's own dependencies (a nested semver, ISC, never loaded), so only sharp's own files count
    const leaked = listAsar(asar).filter((p) =>
      (/\/node_modules\/sharp\//.test(p) && !/\/node_modules\/sharp\/node_modules(\/|$)/.test(p)) ||
      /\/node_modules\/@img(\/|$)/.test(p) ||
      /\/onnxruntime-node\/bin\/napi-v3\/(linux|darwin)(\/|$)/.test(p) ||
      /\/_ARCHIVES(\/|$)/.test(p)
    );
    expect(leaked).toEqual([]);
    // The Windows runtime this guard must not take away
    expect(listAsar(asar)).toContain('/node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v3/win32');
  });
});
