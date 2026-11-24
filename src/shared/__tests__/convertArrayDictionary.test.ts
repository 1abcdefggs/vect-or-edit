import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { toHeaderForm, outputPathFor, convertFile, EMBEDDING_DEFAULTS } from '../../../scripts/convert-array-dictionary.mjs';

describe('convert-array-dictionary', () => {
  it('wraps an array in the header form and keeps the items as they are', () => {
    const items = [{ id: 'A', name: 'a', vector: [1, 0] }, { id: 'B', name: 'b', vector: [0, 1] }];
    const doc = toHeaderForm(items, { domain: 'medical_test' });
    expect(doc.entities).toEqual(items);
    expect(doc.dimension).toBe(2);
    expect(doc.metric).toBe('cosine');
    expect(doc.model).toBe(EMBEDDING_DEFAULTS.model);
    expect(doc.spaceId).toBe(EMBEDDING_DEFAULTS.spaceId);
  });

  it('rejects a non-array, an empty array, a missing vector and mixed vector lengths', () => {
    expect(() => toHeaderForm({}, {})).toThrow('not a JSON array');
    expect(() => toHeaderForm([], {})).toThrow('empty');
    expect(() => toHeaderForm([{ id: 'x' }], {})).toThrow('no vector');
    expect(() => toHeaderForm([{ vector: [1, 0] }, { vector: [1] }], {})).toThrow('differs');
  });

  it('writes the output beside the source under a new name and never overwrites it', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-dict-'));
    try {
      const src = path.join(dir, 'kb_sample.json');
      const original = JSON.stringify([{ id: 'A', vector: [1, 0] }]);
      fs.writeFileSync(src, original);
      expect(outputPathFor(src)).toBe(path.join(dir, 'kb_sample.v2.json'));
      const r = convertFile(src);
      expect(r.count).toBe(1);
      const out = JSON.parse(fs.readFileSync(r.outPath, 'utf8'));
      expect(out.domain).toBe('medical_sample');
      expect(out.entities).toEqual([{ id: 'A', vector: [1, 0] }]);
      expect(fs.readFileSync(src, 'utf8')).toBe(original);
      expect(() => convertFile(src)).toThrow('not overwritten');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
