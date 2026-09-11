import { AppSettings, AppPreferences, AppVisibility, UiKey } from '../types/settings';
import { DEFAULT_SETTINGS, SETTINGS_REGISTRY } from './settingsRegistry';

type Listener<T> = (val: T) => void;

function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

function setNestedValue(obj: any, path: string, value: any): any {
  const keys = path.split('.');
  const result = { ...obj };
  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    current[key] = { ...current[key] };
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

export class SettingsStore {
  private settings: AppSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  private prefListeners = new Map<string, Set<Listener<any>>>();
  private visibilityListeners = new Set<Listener<AppVisibility>>();
  private saveDebounceTimer: any = null;

  constructor() {
    this.loadInitial();
  }

  private loadInitial(): void {
    try {
      const local = typeof localStorage !== 'undefined' ? localStorage.getItem('vect_settings_v3') : null;
      if (local) {
        const parsed = JSON.parse(local);
        this.settings = {
          version: DEFAULT_SETTINGS.version,
          preferences: {
            header: { ...DEFAULT_SETTINGS.preferences.header, ...parsed.preferences?.header },
            editor: { ...DEFAULT_SETTINGS.preferences.editor, ...parsed.preferences?.editor },
            sidebar: { ...DEFAULT_SETTINGS.preferences.sidebar, ...parsed.preferences?.sidebar },
            system: { ...DEFAULT_SETTINGS.preferences.system, ...parsed.preferences?.system }
          },
          visibility: { ...DEFAULT_SETTINGS.visibility, ...parsed.visibility }
        };
      } else {
        this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      }
    } catch (e) {
      console.warn('[SettingsStore] LocalStorage load failed, using defaults.', e);
      this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
  }

  public async syncWithBackend(): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).engineAPI?.loadSettings) {
      try {
        const res = await (window as any).engineAPI.loadSettings();
        if (res?.success && res.settings && Object.keys(res.settings).length > 0) {
          const s = res.settings;
          if (s.preferences || s.visibility) {
            this.settings = {
              version: DEFAULT_SETTINGS.version,
              preferences: {
                header: { ...this.settings.preferences.header, ...s.preferences?.header },
                editor: { ...this.settings.preferences.editor, ...s.preferences?.editor },
                sidebar: { ...this.settings.preferences.sidebar, ...s.preferences?.sidebar },
                system: { ...this.settings.preferences.system, ...s.preferences?.system }
              },
              visibility: { ...this.settings.visibility, ...s.visibility }
            };
          }
          this.notifyAll();
        }
      } catch (err) {
        console.error('[SettingsStore] Backend settings sync failed:', err);
      }
    }
  }

  public getSettings(): AppSettings {
    return this.settings;
  }

  public getPreferences(): AppPreferences {
    return this.settings.preferences;
  }

  public getVisibility(): AppVisibility {
    return this.settings.visibility;
  }

  public getPreference<T = any>(path: string): T {
    return getNestedValue(this.settings.preferences, path);
  }

  public isVisible(key: UiKey): boolean {
    return this.settings.visibility[key] ?? true;
  }

  public updatePreference(path: string, value: any): void {
    this.settings.preferences = setNestedValue(this.settings.preferences, path, value);
    this.notifyPref(path, value);
    this.scheduleSave();
  }

  public toggleVisibility(key: UiKey): void {
    const def = SETTINGS_REGISTRY.find((item) => item.visibilityKey === key);
    if (def?.isEssential) {
      console.warn(`[SettingsStore] "${key}" is marked as essential and cannot be hidden.`);
      return;
    }

    const current = this.isVisible(key);
    this.settings.visibility[key] = !current;
    this.applyDomVisibility(key, !current);
    this.notifyVisibility();
    this.scheduleSave();
  }

  public setVisibility(key: UiKey, visible: boolean): void {
    const def = SETTINGS_REGISTRY.find((item) => item.visibilityKey === key);
    if (def?.isEssential && !visible) {
      console.warn(`[SettingsStore] "${key}" is marked as essential and cannot be hidden.`);
      return;
    }

    this.settings.visibility[key] = visible;
    this.applyDomVisibility(key, visible);
    this.notifyVisibility();
    this.scheduleSave();
  }

  public resetVisibility(): void {
    this.settings.visibility = { ...DEFAULT_SETTINGS.visibility };
    (Object.keys(DEFAULT_SETTINGS.visibility) as UiKey[]).forEach((k) => {
      this.applyDomVisibility(k, true);
    });
    this.notifyVisibility();
    this.scheduleSave();
  }

  public applyAllDomVisibility(): void {
    if (typeof document === 'undefined') return;
    (Object.keys(this.settings.visibility) as UiKey[]).forEach((k) => {
      this.applyDomVisibility(k, this.settings.visibility[k]);
    });
  }

  public applyDomVisibility(key: UiKey, isVisible: boolean): void {
    if (typeof document === 'undefined') return;
    const elements = document.querySelectorAll(`[data-ui="${key}"]`);
    elements.forEach((el) => {
      if (isVisible) {
        el.removeAttribute('hidden');
      } else {
        el.setAttribute('hidden', '');
      }
    });
  }

  private scheduleSave(): void {
    clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('vect_settings_v3', JSON.stringify(this.settings));
      }
      if (typeof window !== 'undefined' && (window as any).engineAPI?.saveSettings) {
        (window as any).engineAPI.saveSettings(this.settings).catch((err: any) => {
          console.error('[SettingsStore] File persistence failed:', err);
        });
      }
    }, 200);
  }

  public onPreferenceChange(path: string, listener: Listener<any>): () => void {
    if (!this.prefListeners.has(path)) this.prefListeners.set(path, new Set());
    this.prefListeners.get(path)!.add(listener);
    return () => this.prefListeners.get(path)?.delete(listener);
  }

  public onVisibilityChange(listener: Listener<AppVisibility>): () => void {
    this.visibilityListeners.add(listener);
    return () => this.visibilityListeners.delete(listener);
  }

  private notifyPref(path: string, val: any): void {
    this.prefListeners.get(path)?.forEach((l) => l(val));
  }

  private notifyVisibility(): void {
    this.visibilityListeners.forEach((l) => l(this.settings.visibility));
  }

  private notifyAll(): void {
    this.applyAllDomVisibility();
    this.notifyVisibility();
    this.prefListeners.forEach((listeners, path) => {
      const val = getNestedValue(this.settings.preferences, path);
      listeners.forEach((l) => l(val));
    });
  }
}

export const settingsStore = new SettingsStore();
