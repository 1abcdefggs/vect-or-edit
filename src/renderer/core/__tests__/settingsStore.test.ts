import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsStore } from '../settingsStore';
import { DEFAULT_SETTINGS, SETTINGS_REGISTRY } from '../settingsRegistry';

describe('SettingsStore & UI Visibility Architecture (Phase 6 Integration)', () => {
  let store: SettingsStore;
  let mockElements: Map<string, any>;

  beforeEach(() => {
    mockElements = new Map();

    // Mock document and localStorage for node environment
    (global as any).document = {
      querySelectorAll: (selector: string) => {
        const match = selector.match(/\[data-ui="([^"]+)"\]/);
        if (match && mockElements.has(match[1])) {
          return [mockElements.get(match[1])!];
        }
        return [];
      }
    };

    (global as any).localStorage = {
      store: {} as Record<string, string>,
      getItem(key: string) { return this.store[key] || null; },
      setItem(key: string, val: string) { this.store[key] = String(val); },
      clear() { this.store = {}; }
    };

    store = new SettingsStore();
  });

  function createMockElement(uiKey: string) {
    const el = {
      attributes: {} as Record<string, string>,
      hasAttribute(attr: string) { return attr in this.attributes; },
      setAttribute(attr: string, val: string) { this.attributes[attr] = val; },
      removeAttribute(attr: string) { delete this.attributes[attr]; }
    };
    mockElements.set(uiKey, el);
    return el;
  }

  it('should initialize with default preferences and full visibility', () => {
    const settings = store.getSettings();
    expect(settings.version).toBe('0.3.12');
    expect(settings.preferences.header.theme).toBe('Dracula');
    expect(settings.preferences.header.locale).toBe('en');
    expect(store.isVisible('hdr:logo')).toBe(true);
    expect(store.isVisible('hdr:settings-btn')).toBe(true);
    expect(store.isVisible('edt:toolbar')).toBe(true);
    expect(store.isVisible('sbr:sidebar')).toBe(true);
    expect(store.isVisible('sys:bottom-bar')).toBe(true);
  });

  it('should update preference value and notify listeners', () => {
    const listener = vi.fn();
    const unsub = store.onPreferenceChange('header.theme', listener);

    store.updatePreference('header.theme', 'Night Owl');
    expect(store.getPreference('header.theme')).toBe('Night Owl');
    expect(listener).toHaveBeenCalledWith('Night Owl');

    unsub();
    store.updatePreference('header.theme', 'Monokai');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should toggle visibility for non-essential items and apply [hidden] attribute to DOM', () => {
    const logoEl = createMockElement('hdr:logo');

    expect(store.isVisible('hdr:logo')).toBe(true);
    expect(logoEl.hasAttribute('hidden')).toBe(false);

    store.toggleVisibility('hdr:logo');
    expect(store.isVisible('hdr:logo')).toBe(false);
    expect(logoEl.hasAttribute('hidden')).toBe(true);

    store.toggleVisibility('hdr:logo');
    expect(store.isVisible('hdr:logo')).toBe(true);
    expect(logoEl.hasAttribute('hidden')).toBe(false);
  });

  it('should protect essential items from being hidden (isEssential: true)', () => {
    const settingsBtn = createMockElement('hdr:settings-btn');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(store.isVisible('hdr:settings-btn')).toBe(true);
    store.toggleVisibility('hdr:settings-btn');
    expect(store.isVisible('hdr:settings-btn')).toBe(true);
    expect(settingsBtn.hasAttribute('hidden')).toBe(false);

    store.setVisibility('hdr:settings-btn', false);
    expect(store.isVisible('hdr:settings-btn')).toBe(true);
    expect(settingsBtn.hasAttribute('hidden')).toBe(false);

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('should reset all visibilities to default on resetVisibility()', () => {
    const menuFile = createMockElement('hdr:menu-file');

    store.setVisibility('hdr:menu-file', false);
    expect(store.isVisible('hdr:menu-file')).toBe(false);
    expect(menuFile.hasAttribute('hidden')).toBe(true);

    store.resetVisibility();
    expect(store.isVisible('hdr:menu-file')).toBe(true);
    expect(menuFile.hasAttribute('hidden')).toBe(false);
  });

  it('should correctly register all 4 quadrant items in SETTINGS_REGISTRY', () => {
    const categories = new Set(SETTINGS_REGISTRY.map((item) => item.category));
    expect(categories.has('header')).toBe(true);
    expect(categories.has('editor')).toBe(true);
    expect(categories.has('sidebar')).toBe(true);
    expect(categories.has('system')).toBe(true);

    // Verify gear triggers and visibility keys
    const visibilityKeys = SETTINGS_REGISTRY.map((i) => i.visibilityKey).filter(Boolean);
    expect(visibilityKeys).toContain('hdr:logo');
    expect(visibilityKeys).toContain('edt:font-family');
    expect(visibilityKeys).toContain('sbr:score-filter');
    expect(visibilityKeys).toContain('sys:pipeline-meter');
  });
});
