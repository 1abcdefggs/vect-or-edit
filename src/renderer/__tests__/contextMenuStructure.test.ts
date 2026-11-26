import { beforeEach, describe, expect, it, vi } from 'vitest';

// The editor right-click menu: one component, the order decided by the owner (provisional, 20261127).
// Runs in the node environment, so the DOM is a minimal stub; icons and texts are replaced by their keys.
type Stub = {
  tag: string;
  className: string;
  title: string;
  innerHTML: string;
  textContent: string;
  disabled: boolean;
  children: Stub[];
  attrs: Record<string, string>;
  appendChild: (c: Stub) => Stub;
  setAttribute: (k: string, v: string) => void;
  addEventListener: () => void;
  insertAdjacentHTML: (where: string, html: string) => void;
};

const make = (tag: string): Stub => {
  const el: Stub = {
    tag,
    className: '',
    title: '',
    innerHTML: '',
    textContent: '',
    disabled: false,
    children: [],
    attrs: {},
    appendChild(c) {
      el.children.push(c);
      return c;
    },
    setAttribute(k, v) {
      el.attrs[k] = v;
    },
    addEventListener() {},
    insertAdjacentHTML(_where, html) {
      el.innerHTML += html;
    }
  };
  return el;
};

const state = {
  llmBlocker: 'llm_off' as string | null,
  knowledgeBlocker: 'embed_off' as string | null,
  hasDictionary: false,
  matches: [] as Array<{ name: string; description?: string }>,
  googleOn: true,
  canUndo: false,
  canRedo: false
};

vi.mock('../core/icons', () => ({
  icons: { copy: 'ICON_COPY', cut: 'ICON_CUT', paste: 'ICON_PASTE', search: 'ICON_SEARCH', google: 'ICON_GOOGLE', settings: 'ICON_GEAR', externalLink: 'ICON_EXTERNAL' }
}));
vi.mock('../core/i18n', () => ({ t: (key: string) => key }));
vi.mock('../editor/core/editorCore', () => ({ insertTextIntoEditor: vi.fn() }));
vi.mock('../search/vectorSearch', () => ({ triggerSearchAndRender: vi.fn() }));
vi.mock('../search/dictionary', () => ({
  getQuickMatches: () => state.matches,
  hasKnowledgeDictionary: () => state.hasDictionary
}));
vi.mock('../core/aiAccess', () => ({
  knowledgeSearchBlocker: () => state.knowledgeBlocker,
  llmChatBlocker: () => state.llmBlocker
}));
vi.mock('../core/externalActions', () => ({
  isGoogleSearchEnabled: () => state.googleOn,
  openGoogleSearch: vi.fn(),
  openLlmChat: vi.fn()
}));

/** The visible name of a menu entry: the first span that is not an icon. */
const labelOf = (el: Stub): string => {
  if (el.textContent) return el.textContent;
  const spans = [...el.innerHTML.matchAll(/<span([^>]*)>([^<]*)<\/span>/g)].filter(
    (m) => !/material-symbols|external-action-icon/.test(m[1])
  );
  const plain = spans.map((m) => m[2]).find((s) => s.trim());
  return plain ?? el.innerHTML.trim();
};

/** The menu as a list: 'sep' for a line, a string for one entry, an array for a row. */
const outline = (menu: Stub): Array<string | string[]> =>
  menu.children.map((c) => {
    if (c.className.includes('custom-context-menu-separator')) return 'sep';
    if (c.className.includes('custom-context-menu-row')) return c.children.map(labelOf);
    if (c.className.includes('pill-quick-candidates')) return 'candidates:' + c.children.map(labelOf).join(',');
    return labelOf(c);
  });

const build = async (selectedText: string) => {
  const { buildPatternAMenu } = await import('../editor/ui/contextMenuBuilders.js');
  return buildPatternAMenu({ selectedText, onDismiss: () => {} }) as unknown as Stub;
};

beforeEach(() => {
  Object.assign(state, { llmBlocker: 'llm_off', knowledgeBlocker: 'embed_off', hasDictionary: false, matches: [], googleOn: true, canUndo: false, canRedo: false });
  vi.stubGlobal('document', { createElement: (tag: string) => make(tag), getElementById: () => null });
  vi.stubGlobal('navigator', { clipboard: { readText: () => Promise.resolve('x'), writeText: vi.fn() } });
  vi.stubGlobal('window', {
    monacoEditorInstance: { getModel: () => ({ canUndo: () => state.canUndo, canRedo: () => state.canRedo }), getValue: () => 'all text' },
    dispatchEvent: vi.fn()
  });
});

describe('editor right-click menu', () => {
  it('without a selection: Copy All | Paste | Select All, Undo | Redo, the right panel row, the gear', async () => {
    expect(outline(await build(''))).toEqual([
      ['ctx_copy_all', 'menu_edit_paste', 'menu_edit_select_all'],
      'sep',
      ['menu_edit_undo', 'menu_edit_redo'],
      'sep',
      ['ctx_right_panel_label', 'ctx_panel_hide'],
      ['ICON_GEAR']
    ]);
  });

  it('with a selection: Copy | Cut | Paste, AI Chat | Vector, Google, Select All, Undo | Redo, the right panel row, the gear', async () => {
    expect(outline(await build('abstract'))).toEqual([
      ['menu_edit_copy', 'menu_edit_cut', 'menu_edit_paste'],
      'sep',
      ['ctx_chat_short', 'ctx_vector_short'],
      'action_google_search',
      'menu_edit_select_all',
      'sep',
      ['menu_edit_undo', 'menu_edit_redo'],
      'sep',
      ['ctx_right_panel_label', 'ctx_panel_hide'],
      ['ICON_GEAR']
    ]);
  });

  it('puts the dictionary candidates first, only when the dictionary has a match', async () => {
    state.hasDictionary = true;
    state.matches = [{ name: 'hypertension', description: 'high blood pressure' }];
    const withMatch = outline(await build('abstract'));
    expect(withMatch[0]).toBe('candidates:hypertension');
    expect(withMatch[1]).toBe('sep');
    state.matches = [];
    expect(String(outline(await build('abstract'))[0])).not.toContain('candidates');
  });

  it('never shows the candidates without a selection', async () => {
    state.hasDictionary = true;
    state.matches = [{ name: 'hypertension' }];
    expect(String(outline(await build(''))[0])).not.toContain('candidates');
  });

  it('drops the Google entry while the Google search setting is Off', async () => {
    state.googleOn = false;
    expect(outline(await build('abstract'))).not.toContain('action_google_search');
  });

  it('makes AI Chat and Vector inactive with the reason as the tooltip, and activates them when allowed', async () => {
    const blocked = (await build('abstract')).children[2].children;
    expect(blocked.map((b) => b.disabled)).toEqual([true, true]);
    expect(blocked[0].title).toBe('ai_chat_reason_off');
    expect(blocked[1].title).toBe('ai_suggest_reason_embed_off');
    state.llmBlocker = null;
    state.knowledgeBlocker = null;
    const open = (await build('abstract')).children[2].children;
    expect(open.map((b) => b.disabled)).toEqual([false, false]);
  });

  it('makes Undo and Redo inactive while there is nothing to undo or redo', async () => {
    const row = (await build('')).children[2].children;
    expect(row.map((b) => b.disabled)).toEqual([true, true]);
    expect(row.map((b) => b.title)).toEqual(['ctx_undo_empty', 'ctx_redo_empty']);
    state.canUndo = true;
    state.canRedo = true;
    expect((await build('')).children[2].children.map((b) => b.disabled)).toEqual([false, false]);
  });

  it('ends with the gear alone at the right, named by its tooltip and accessible name', async () => {
    const menu = await build('');
    const gearRow = menu.children[menu.children.length - 1];
    expect(gearRow.className).toContain('custom-context-menu-row--end');
    const gear = gearRow.children[0];
    expect(gear.title).toBe('ctx_open_settings');
    expect(gear.attrs['aria-label']).toBe('ctx_open_settings');
    expect(gear.innerHTML).toBe('ICON_GEAR');
  });
});
