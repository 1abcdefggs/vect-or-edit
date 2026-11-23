import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GEAR_TOKEN, splitGearToken } from '../gearToken';

const LOCALES = path.resolve(__dirname, '..', '..', 'locales');
const read = (name: string): Record<string, string> =>
  JSON.parse(fs.readFileSync(path.join(LOCALES, `${name}.json`), 'utf8'));

describe('the {gear} token', () => {
  it('splits a text around each token', () => {
    expect(splitGearToken('a {gear} b')).toEqual(['a ', ' b']);
    expect(splitGearToken('no token')).toEqual(['no token']);
    expect(splitGearToken('{gear} first {gear} twice')).toEqual(['', ' first ', ' twice']);
  });

  it('is used with the same count of tokens in both languages', () => {
    const ja = read('ja');
    const en = read('en');
    const keys = Object.keys(en).filter((k) => en[k].includes(GEAR_TOKEN) || (ja[k] ?? '').includes(GEAR_TOKEN));
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(splitGearToken(ja[key] ?? '').length, key).toBe(splitGearToken(en[key]).length);
    }
  });
});
