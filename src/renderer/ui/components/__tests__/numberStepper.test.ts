import { describe, expect, it } from 'vitest';
import { nextStepValue } from '../numberStepper';

const delay = { min: 0.5, max: 10, step: 0.5 };
const score = { min: 50, max: 99, step: 1 };

describe('nextStepValue', () => {
  it('moves by one step in each direction and keeps the decimals of the step', () => {
    expect(nextStepValue(1.5, 1, delay)).toBe(2);
    expect(nextStepValue(1.5, -1, delay)).toBe(1);
  });

  it('stops at the minimum and the maximum', () => {
    expect(nextStepValue(0.5, -1, delay)).toBe(0.5);
    expect(nextStepValue(10, 1, delay)).toBe(10);
  });

  it('does not drift from floating point error on a fractional step', () => {
    expect(nextStepValue(0.5, 1, delay)).toBe(1);
    expect(nextStepValue(1, 1, delay)).toBe(1.5);
  });

  it('works on whole numbers', () => {
    expect(nextStepValue(70, 1, score)).toBe(71);
    expect(nextStepValue(99, 1, score)).toBe(99);
  });
});
