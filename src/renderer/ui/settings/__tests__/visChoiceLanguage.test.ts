import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// The Shown/Hidden choice words and tooltips must be written again when the language changes
const state = vi.hoisted(() => ({ lang: 'ja', visible: true }));
const DICT = vi.hoisted(() => ({
  ja: {
    vis_state_shown: '\u8868\u793a',
    vis_state_hidden: '\u975e\u8868\u793a',
    tip_vis_show: '\u8868\u793a\u3059\u308b',
    tip_vis_hide: '\u975e\u8868\u793a\u306b\u3059\u308b'
  },
  en: {
    vis_state_shown: 'Shown',
    vis_state_hidden: 'Hidden',
    tip_vis_show: 'Show this part',
    tip_vis_hide: 'Hide this part'
  }
}));

vi.mock('../../../core/i18n', () => ({
  t: (key: string) => (DICT as Record<string, Record<string, string>>)[state.lang][key] ?? key
}));
vi.mock('../../../core/tipFormat', () => ({ formatTipText: (_key: string, text: string) => text }));
vi.mock('../../../core/settingsRegistry', () => ({ SETTINGS_REGISTRY: [] }));
vi.mock('../../../core/settingsStore', () => ({
  settingsStore: { isVisible: () => state.visible }
}));
vi.mock('../../notifications/toastManager.js', () => ({ showToast: () => {} }));

// Minimal element stand-in: attributes, classes, text, title and child lookup
function fakeEl(kids: Record<string, unknown> = {}) {
  const attrs = new Map<string, string>();
  const classes = new Set<string>();
  return {
    attrs,
    classes,
    textContent: '',
    title: '',
    setAttribute: (k: string, v: string) => attrs.set(k, v),
    getAttribute: (k: string) => attrs.get(k) ?? null,
    classList: {
      toggle: (name: string, force?: boolean) => {
        const on = force ?? !classes.has(name);
        if (on) classes.add(name);
        else classes.delete(name);
        return on;
      }
    },
    querySelector: (sel: string) => (kids[sel] ?? null)
  };
}

function makeChoice() {
  return fakeEl({
    '.material-symbols-outlined': fakeEl(),
    '.vis-choice-word': fakeEl()
  });
}

describe('Shown/Hidden choice labels follow the language', () => {
  const handlers: Array<() => void> = [];
  const shownBtn = makeChoice();
  const hiddenBtn = makeChoice();
  const group = {
    getAttribute: (k: string) => (k === 'data-ui-key' ? 'pinnedThing' : null),
    querySelectorAll: (sel: string) => (sel === '.vis-choice' ? [shownBtn, hiddenBtn] : [])
  };

  beforeAll(async () => {
    vi.stubGlobal('window', {
      addEventListener: (type: string, fn: () => void) => {
        if (type === 'app:languageChanged') handlers.push(fn);
      },
      dispatchEvent: () => true
    });
    vi.stubGlobal('document', {
      querySelectorAll: (sel: string) => (sel === '.vis-segmented[data-ui-key]' ? [group] : [])
    });
    await import('../settingsModalRenderer');
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('writes the words and tooltips in English and marks the current choice', () => {
    state.lang = 'en';
    state.visible = true;
    handlers.forEach((fn) => fn());

    expect((shownBtn.querySelector('.vis-choice-word') as { textContent: string }).textContent).toBe('Shown');
    expect((hiddenBtn.querySelector('.vis-choice-word') as { textContent: string }).textContent).toBe('Hidden');
    expect(shownBtn.title).toBe('Show this part');
    expect(hiddenBtn.title).toBe('Hide this part');
    expect(shownBtn.getAttribute('aria-checked')).toBe('true');
    expect(hiddenBtn.getAttribute('aria-checked')).toBe('false');
  });

  it('writes the Japanese words back and moves the mark when the part is hidden', () => {
    state.lang = 'ja';
    state.visible = false;
    handlers.forEach((fn) => fn());

    expect((shownBtn.querySelector('.vis-choice-word') as { textContent: string }).textContent).toBe('\u8868\u793a');
    expect((hiddenBtn.querySelector('.vis-choice-word') as { textContent: string }).textContent).toBe('\u975e\u8868\u793a');
    expect(hiddenBtn.title).toBe('\u975e\u8868\u793a\u306b\u3059\u308b');
    expect(shownBtn.getAttribute('aria-checked')).toBe('false');
    expect(hiddenBtn.getAttribute('aria-checked')).toBe('true');
    expect(hiddenBtn.classes.has('is-current')).toBe(true);
  });
});
