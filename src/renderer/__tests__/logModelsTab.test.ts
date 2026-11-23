// Unit tests for the log panel Models tab: mount once, seed the saved choice, fetch the list, choose a model.
// Runs in the node environment (no jsdom in this project), so the DOM is a minimal stub.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const picker = { setModels: vi.fn(), setValue: vi.fn() };
let savedModel: string | null = null;

vi.mock('../ui/settings/geminiModelPicker', () => ({
  createGeminiModelPicker: vi.fn(() => picker),
  usableGeminiModels: (models: Array<{ name?: string; canGenerate?: boolean }>) =>
    models.filter((m) => m.name && m.canGenerate !== false),
  rememberGeminiModels: vi.fn()
}));
vi.mock('../core/geminiModel', () => ({ readGeminiModel: () => savedModel }));
vi.mock('../core/constants', () => ({ STORAGE_KEYS: { GEMINI_MODEL: 'vect_gemini_model' } }));
vi.mock('../core/storage', () => ({ writeStorage: vi.fn() }));
vi.mock('../ui/settings/settingsState', () => ({ syncSettingsToBackend: vi.fn() }));
vi.mock('../core/i18n', () => ({
  t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
}));

import { createGeminiModelPicker, rememberGeminiModels } from '../ui/settings/geminiModelPicker';
import { writeStorage } from '../core/storage';
import { syncSettingsToBackend } from '../ui/settings/settingsState';

type StubEl = {
  id: string;
  textContent: string;
  style: { color?: string };
  listeners: Record<string, () => void>;
  addEventListener: (type: string, fn: () => void) => void;
  click: () => void;
};

function makeEl(id: string): StubEl {
  return {
    id,
    textContent: '',
    style: {},
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    click() {
      this.listeners.click?.();
    }
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

let els: Record<string, StubEl>;
let engineAPI: { listGeminiModels: ReturnType<typeof vi.fn> };
let dispatched: string[];

async function loadTab() {
  vi.resetModules();
  return import('../ui/console/logModelsTab');
}

beforeEach(() => {
  els = {
    logModelsPicker: makeEl('logModelsPicker'),
    logModelsStatus: makeEl('logModelsStatus'),
    btnLogFetchModels: makeEl('btnLogFetchModels')
  };
  engineAPI = { listGeminiModels: vi.fn() };
  dispatched = [];
  vi.stubGlobal('document', { getElementById: (id: string) => els[id] ?? null });
  vi.stubGlobal('window', {
    engineAPI,
    dispatchEvent: (e: Event) => dispatched.push(e.type)
  });
  savedModel = null;
  picker.setModels.mockClear();
  picker.setValue.mockClear();
  vi.mocked(createGeminiModelPicker).mockClear();
  vi.mocked(writeStorage).mockClear();
  vi.mocked(syncSettingsToBackend).mockClear();
  vi.mocked(rememberGeminiModels).mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('initLogModelsTab', () => {
  it('mounts the picker once and ignores a second call', async () => {
    const { initLogModelsTab } = await loadTab();
    initLogModelsTab();
    initLogModelsTab();
    expect(createGeminiModelPicker).toHaveBeenCalledTimes(1);
    expect(createGeminiModelPicker).toHaveBeenCalledWith(els.logModelsPicker, expect.any(Object));
  });

  it('does nothing when the picker container is missing', async () => {
    delete els.logModelsPicker;
    const { initLogModelsTab } = await loadTab();
    initLogModelsTab();
    expect(createGeminiModelPicker).not.toHaveBeenCalled();
  });

  it('seeds the saved model into the picker', async () => {
    savedModel = 'gemini-2.5-pro';
    const { initLogModelsTab } = await loadTab();
    initLogModelsTab();
    expect(picker.setModels).toHaveBeenCalledWith([{ name: 'gemini-2.5-pro', canGenerate: true }]);
    expect(picker.setValue).toHaveBeenCalledWith('gemini-2.5-pro');
  });

  it('writes the choice, syncs the backend and announces the change', async () => {
    const { initLogModelsTab } = await loadTab();
    initLogModelsTab();
    const options = vi.mocked(createGeminiModelPicker).mock.calls[0][1] as { onChange: (n: string) => void };
    options.onChange('gemini-2.5-flash');
    expect(writeStorage).toHaveBeenCalledWith('vect_gemini_model', 'gemini-2.5-flash');
    expect(syncSettingsToBackend).toHaveBeenCalledTimes(1);
    expect(dispatched).toContain('app:settingsChanged');
  });
});

describe('fetch from the Models tab', () => {
  const models = [
    { name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', canGenerate: true },
    { name: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', canGenerate: true },
    { name: 'gemini-x', canGenerate: false }
  ];

  it('lists the models and asks the user to choose when nothing is saved', async () => {
    engineAPI.listGeminiModels.mockResolvedValue(models);
    const { initLogModelsTab } = await loadTab();
    initLogModelsTab();
    els.btnLogFetchModels.click();
    await flush();
    expect(engineAPI.listGeminiModels).toHaveBeenCalledWith(undefined);
    expect(picker.setModels).toHaveBeenLastCalledWith(models);
    expect(picker.setValue).not.toHaveBeenCalled();
    expect(rememberGeminiModels).toHaveBeenCalledWith(models);
    expect(els.logModelsStatus.textContent).toBe('gemini_keys_loaded_choose:{"count":2}');
  });

  it('keeps the saved choice selected after a fetch', async () => {
    savedModel = 'gemini-2.5-pro';
    engineAPI.listGeminiModels.mockResolvedValue(models);
    const { initLogModelsTab } = await loadTab();
    initLogModelsTab();
    picker.setValue.mockClear();
    els.btnLogFetchModels.click();
    await flush();
    expect(picker.setValue).toHaveBeenCalledWith('gemini-2.5-pro');
    expect(els.logModelsStatus.textContent).toBe('gemini_keys_loaded:{"count":2}');
  });

  it('shows the error text when the list is empty', async () => {
    engineAPI.listGeminiModels.mockResolvedValue([]);
    const { initLogModelsTab } = await loadTab();
    initLogModelsTab();
    els.btnLogFetchModels.click();
    await flush();
    expect(els.logModelsStatus.textContent).toBe('gemini_keys_error');
    expect(els.logModelsStatus.style.color).toBe('#ef4444');
    expect(rememberGeminiModels).not.toHaveBeenCalled();
  });

  it('shows the error text when the response is not a list', async () => {
    engineAPI.listGeminiModels.mockResolvedValue({ error: 'x' });
    const { initLogModelsTab } = await loadTab();
    initLogModelsTab();
    els.btnLogFetchModels.click();
    await flush();
    expect(els.logModelsStatus.textContent).toBe('gemini_keys_error');
  });

  it('shows the error text when the request rejects', async () => {
    engineAPI.listGeminiModels.mockRejectedValue(new Error('network'));
    const { initLogModelsTab } = await loadTab();
    initLogModelsTab();
    els.btnLogFetchModels.click();
    await flush();
    expect(els.logModelsStatus.textContent).toBe('gemini_keys_error');
  });
});
