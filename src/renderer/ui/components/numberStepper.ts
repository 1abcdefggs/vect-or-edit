/**
 * Number input with a − and a ＋ button. The input itself stays (same id, min, max, step and value; the limits are read at each press, so a script may change them), so every reader of its value keeps working.
 * Opt in with data-stepper on the input; renderer startup calls enhanceNumberSteppers() once the locale is loaded.
 */
import { t } from '../../core/i18n';

interface StepRange {
  min: number;
  max: number;
  step: number;
}

/** The value after one press: moves by one step, stays inside [min, max], and keeps the decimals of the step. */
export function nextStepValue(current: number, direction: 1 | -1, { min, max, step }: StepRange): number {
  const decimals = (String(step).split('.')[1] ?? '').length;
  const moved = Number((current + direction * step).toFixed(decimals));
  return Math.min(max, Math.max(min, moved));
}

function rangeOf(input: HTMLInputElement): StepRange {
  return {
    min: input.min === '' ? -Infinity : Number(input.min),
    max: input.max === '' ? Infinity : Number(input.max),
    step: Number(input.step) > 0 ? Number(input.step) : 1
  };
}

function stepButton(label: string, step: 'decrease' | 'increase'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'num-stepper__btn';
  button.dataset.step = step;
  button.textContent = label;
  button.setAttribute('aria-label', t(`stepper_${step}`));
  return button;
}

// The names of the buttons are written when they are made; the language change writes them again
if (typeof window !== 'undefined') {
  window.addEventListener('app:languageChanged', () => {
    document.querySelectorAll<HTMLButtonElement>('.num-stepper__btn[data-step]').forEach((button) => {
      button.setAttribute('aria-label', t(`stepper_${button.dataset.step}`));
    });
  });
}

export function enhanceNumberStepper(input: HTMLInputElement): void {
  if (input.closest('.num-stepper')) return;
  const minus = stepButton('−', 'decrease');
  const plus = stepButton('+', 'increase');

  const wrap = document.createElement('span');
  wrap.className = 'num-stepper';
  input.before(wrap);
  wrap.append(minus, input, plus);

  // Each button is disabled at its own limit, so a press never has to be ignored
  function sync(): void {
    const value = Number(input.value);
    const range = rangeOf(input);
    minus.disabled = !(value > range.min);
    plus.disabled = !(value < range.max);
  }

  function press(direction: 1 | -1): void {
    input.value = String(nextStepValue(Number(input.value) || rangeOf(input).min, direction, rangeOf(input)));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    sync();
  }

  minus.addEventListener('click', () => press(-1));
  plus.addEventListener('click', () => press(1));
  input.addEventListener('input', sync);
  sync();
}

export function enhanceNumberSteppers(root: ParentNode = document): void {
  root.querySelectorAll<HTMLInputElement>('input[data-stepper]').forEach(enhanceNumberStepper);
}
