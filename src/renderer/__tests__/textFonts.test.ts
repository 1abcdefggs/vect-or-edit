import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildTextFontsCss, OUTPUT, TEXT_FONTS } from '../../../scripts/text-fonts/generate-text-fonts-css.mjs';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

describe('bundled text fonts', () => {
  it('text-fonts.css matches the @fontsource-variable packages (rerun generate-text-fonts-css.mjs after a package update)', () => {
    const current = fs.readFileSync(OUTPUT, 'utf8').replace(/\r\n/g, '\n');
    expect(current === buildTextFontsCss()).toBe(true);
  });

  it('declares every family under the plain name the app uses', () => {
    const css = fs.readFileSync(OUTPUT, 'utf8');
    for (const { family } of TEXT_FONTS) expect(css, family).toContain(`font-family: '${family}';`);
    expect(css).not.toMatch(/ Variable'/);
  });

  it('is imported by style.css and nothing loads Google Fonts', () => {
    expect(read('src/renderer/style.css')).toContain("@import './css/text-fonts.css';");
    expect(read('src/renderer/index.html')).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });
});
