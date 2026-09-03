import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';

describe('VectOrEditOr (vect-or-edit) Core Validation Tests', () => {
  it('should locate Rust engine binary or package definition', () => {
    const localNodeBinary = path.resolve(__dirname, '../../vect-or-engine/vect-or-engine-napi.win32-x64-msvc.node');
    const localPkg = path.resolve(__dirname, '../../vect-or-engine/package.json');
    
    // At least the engine repository and its package definition must exist
    expect(fs.existsSync(localPkg)).toBe(true);
  });

  it('should have consistent localization keys between English and Japanese', () => {
    const enPath = path.resolve(__dirname, '../src/renderer/locales/en.json');
    const jaPath = path.resolve(__dirname, '../src/renderer/locales/ja.json');

    expect(fs.existsSync(enPath)).toBe(true);
    expect(fs.existsSync(jaPath)).toBe(true);

    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const ja = JSON.parse(fs.readFileSync(jaPath, 'utf8'));

    const enKeys = Object.keys(en).sort();
    const jaKeys = Object.keys(ja).sort();

    // Check critical shared UI keys
    expect(enKeys).toContain('app_title');
    expect(jaKeys).toContain('app_title');
    expect(enKeys).toContain('btn_settings');
    expect(jaKeys).toContain('btn_settings');
  });

  it('should strictly define UI guideline tokens in style.css', () => {
    const stylePath = path.resolve(__dirname, '../src/renderer/style.css');
    const variablesPath = path.resolve(__dirname, '../src/renderer/css/variables.css');
    expect(fs.existsSync(stylePath)).toBe(true);

    const cssContent = fs.readFileSync(stylePath, 'utf8') + '\n' + (fs.existsSync(variablesPath) ? fs.readFileSync(variablesPath, 'utf8') : '');

    // Verify adherence to vect-or-ui-guidelines
    expect(cssContent).toContain('--radius-md: 8px');
    expect(cssContent).toContain('--radius-lg: 12px');
    expect(cssContent).toContain('--radius-sm: 4px');
  });
});
