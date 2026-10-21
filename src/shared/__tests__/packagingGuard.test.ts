import { describe, expect, it } from 'vitest';
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '../../..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));

// sharp and its libvips binaries (LGPL) are a hard dependency of transformers but are unused in the app
describe('packaging guard: sharp stays out of the distributable', () => {
  it('excludes sharp and @img from build.files', () => {
    const files: string[] = pkg.build.files;
    expect(files).toContain('!**/node_modules/sharp/**/*');
    expect(files).toContain('!**/node_modules/@img/**/*');
  });

  it('keeps the exclusions after the broad includes so they win', () => {
    const files: string[] = pkg.build.files;
    const lastInclude = Math.max(...files.map((f, i) => (f.startsWith('!') ? -1 : i)));
    expect(files.indexOf('!**/node_modules/sharp/**/*')).toBeGreaterThan(lastInclude);
    expect(files.indexOf('!**/node_modules/@img/**/*')).toBeGreaterThan(lastInclude);
  });

  it('has no sharp or @img entries in a built app.asar (checked only when a build exists)', () => {
    const asar = resolve(root, 'dist/win-unpacked/resources/app.asar');
    if (!existsSync(asar)) return;
    // A build older than package.json predates the current exclusions, so it says nothing about them
    if (statSync(asar).mtimeMs < statSync(resolve(root, 'package.json')).mtimeMs) return;
    // Only the header is read: [4][4][4][4] bytes of sizes, then the JSON index of every packed path
    const fd = openSync(asar, 'r');
    try {
      const prefix = Buffer.alloc(16);
      readSync(fd, prefix, 0, 16, 0);
      const jsonLength = prefix.readUInt32LE(12);
      const json = Buffer.alloc(jsonLength);
      readSync(fd, json, 0, jsonLength, 16);
      var text = json.toString('utf-8');
    } finally {
      closeSync(fd);
    }
    expect(text).not.toMatch(/"sharp"\s*:\s*\{"files"/);
    expect(text).not.toMatch(/"@img"\s*:\s*\{"files"/);
  });
});
