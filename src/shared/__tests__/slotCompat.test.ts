import { describe, it, expect } from 'vitest';
import { decideSlots, type SlotFacts } from '../slotCompat';

const models = [
  { id: 'm384', spaceId: 'sp-a', matryoshka: false },
  { id: 'mat', spaceId: 'sp-m', matryoshka: true },
] as const;
const slot = (dimension: number, header: SlotFacts['header'] = {}, innerMismatch = false): SlotFacts => ({ header, dimension, innerMismatch });
const m384 = { id: 'm384', dimensions: 384 };
const mat = { id: 'mat', dimensions: 256 };
const decide = (s: SlotFacts[], model: typeof m384 | null, trunc = true) => decideSlots(s, model, trunc, models as never).verdicts.map((v) => v.compat);

describe('decideSlots', () => {
  it('puts an empty file and an inconsistent file out, with their own reasons', () => {
    expect(decide([slot(0), slot(384, {}, true)], m384)).toEqual([
      { state: 'excluded', reason: 'no-vectors' }, { state: 'excluded', reason: 'dim-inconsistent' }]);
  });
  it('says unchecked without a model and leaves out a file of another length than the first', () => {
    expect(decide([slot(384), slot(512)], null)).toEqual([{ state: 'unchecked' }, { state: 'excluded', reason: 'dim-mismatch-mixed' }]);
  });
  it('separates other space, ok and unverified', () => {
    expect(decide([slot(384, { spaceId: 'other' }), slot(384, { model: 'm384' }), slot(384)], m384)).toEqual([
      { state: 'excluded', reason: 'space-mismatch' }, { state: 'ok' }, { state: 'unverified' }]);
  });
  it('gives the length reasons: unknown space, not truncatable, truncation off', () => {
    expect(decide([slot(100)], m384)).toEqual([{ state: 'excluded', reason: 'dim-mismatch-unknown-space' }]);
    expect(decide([slot(100, { model: 'm384' })], m384)).toEqual([{ state: 'excluded', reason: 'dim-not-truncatable' }]);
    expect(decide([slot(128, { model: 'mat' })], mat, false)).toEqual([{ state: 'excluded', reason: 'truncation-off' }]);
  });
  it('is approximate when a longer file is cut, and when every file is shorter than the model', () => {
    const d = decideSlots([slot(512, { model: 'mat' })], mat, true, models as never);
    expect(d.verdicts[0]).toMatchObject({ compat: { state: 'approximate' }, inIndex: true, cutTo: 256 });
    const q = decideSlots([slot(128, { model: 'mat' })], mat, true, models as never);
    expect(q.queryCutTo).toBe(128);
    expect(q.verdicts[0].compat).toEqual({ state: 'approximate' });
  });
  it('leaves out a shorter file that sits beside a file at the model length (mixed)', () => {
    expect(decide([slot(256, { model: 'mat' }), slot(128, { model: 'mat' })], mat)).toEqual([
      { state: 'ok' }, { state: 'excluded', reason: 'dim-mismatch-mixed' }]);
  });
  it('gives every combination of facts exactly one verdict and keeps the used lengths equal', () => {
    const lengths = [0, 128, 256, 512];
    const headers: SlotFacts['header'][] = [{}, { model: 'mat' }, { model: 'm384' }, { spaceId: 'other' }];
    const all: SlotFacts[] = [];
    for (const d of lengths) for (const h of headers) for (const inner of [false, true]) all.push(slot(d, h, inner));
    for (const model of [null, mat]) for (const trunc of [true, false]) {
      for (const a of all) for (const b of all) {
        const r = decideSlots([a, b], model, trunc, models as never);
        expect(r.verdicts).toHaveLength(2);
        const used = r.verdicts.map((v, i) => (v.inIndex ? (v.cutTo ?? [a, b][i].dimension) : null)).filter((x) => x !== null);
        expect(new Set(used).size).toBeLessThanOrEqual(1);
        r.verdicts.forEach((v) => expect(v.compat.state === 'excluded').toBe(!v.inIndex));
      }
    }
  });
});
