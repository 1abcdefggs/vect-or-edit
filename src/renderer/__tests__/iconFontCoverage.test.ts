import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { scanIconNames } from '../../../scripts/icon-font/scan-icon-names.mjs';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const manifest = fs.readFileSync(path.join(repoRoot, 'scripts', 'icon-font', 'icon-names.txt'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean);

describe('bundled Material Symbols font', () => {
  it('lists every icon name the renderer uses (rerun scan-icon-names.mjs --write after adding one)', () => {
    const scanned: string[] = scanIconNames();
    const missing = scanned.filter((name) => !manifest.includes(name));
    const unused = manifest.filter((name) => !scanned.includes(name));
    expect({ missing, unused }).toEqual({ missing: [], unused: [] });
  });

  it('has the subset font file that the stylesheet points at', () => {
    const font = path.join(repoRoot, 'src', 'renderer', 'assets', 'fonts', 'material-symbols-outlined.subset.woff2');
    expect(fs.existsSync(font)).toBe(true);
  });

  it('keeps no numeric icon code points in the renderer source', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__' && entry.name !== 'generated') walk(full);
        } else if (/\.(html|js|ts)$/.test(entry.name) && /&#x[ef][0-9a-f]{3};/i.test(fs.readFileSync(full, 'utf8'))) {
          offenders.push(path.relative(repoRoot, full));
        }
      }
    };
    walk(path.join(repoRoot, 'src', 'renderer'));
    expect(offenders).toEqual([]);
  });
});
