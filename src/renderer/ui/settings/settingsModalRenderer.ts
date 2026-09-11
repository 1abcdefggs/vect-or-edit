import { SETTINGS_REGISTRY } from '../../core/settingsRegistry';
import { settingsStore } from '../../core/settingsStore';
import { SettingItemDef, UiKey } from '../../types/settings';

export function enhanceSettingsModalVisibilityControls(): void {
  const container = document.getElementById('settingsModal');
  if (!container) return;

  // 1. Attach eye toggle buttons to registered settings in modal
  SETTINGS_REGISTRY.forEach((item) => {
    if (!item.visibilityKey) return;

    // Find corresponding setting row or create an indicator
    attachVisibilityToggleToRow(item);
  });

  // 2. Wire quadrant quick settings gear buttons across UI
  wireQuickSettingsGears();
}

function attachVisibilityToggleToRow(item: SettingItemDef): void {
  const visKey = item.visibilityKey as UiKey;
  if (!visKey) return;

  // Find setting element by mapping conventions or existing IDs
  let targetRow: HTMLElement | null = findTargetRowForItem(item);
  if (!targetRow) return;

  // Check if toggle is already attached
  if (targetRow.querySelector(`.vis-toggle-wrapper[data-vis-key="${visKey}"]`)) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'vis-toggle-wrapper';
  wrapper.setAttribute('data-vis-key', visKey);
  wrapper.style.cssText = 'display: inline-flex; align-items: center; margin-right: 8px; flex-shrink: 0;';

  if (item.isEssential) {
    const lock = document.createElement('span');
    lock.className = 'vis-lock-icon';
    lock.innerHTML = '&#xe897;'; // material-symbols lock
    lock.title = 'Essential item: cannot be hidden';
    lock.style.cssText = 'font-family: "Material Symbols Outlined"; font-size: 1.05rem; color: var(--text-muted); opacity: 0.6; cursor: not-allowed;';
    wrapper.appendChild(lock);
  } else {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vis-toggle-btn';
    btn.setAttribute('data-ui-key', visKey);
    btn.title = settingsStore.isVisible(visKey) ? 'Hide on main interface' : 'Show on main interface';
    
    updateEyeButtonState(btn, settingsStore.isVisible(visKey));

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      settingsStore.toggleVisibility(visKey);
      const isVis = settingsStore.isVisible(visKey);
      updateEyeButtonState(btn, isVis);
    });

    wrapper.appendChild(btn);
  }

  // Prepend wrapper to the setting row label area
  const labelContainer = targetRow.querySelector('.setting-label')?.parentElement || targetRow.firstElementChild;
  if (labelContainer) {
    labelContainer.insertBefore(wrapper, labelContainer.firstChild);
  }
}

function updateEyeButtonState(btn: HTMLButtonElement, isVisible: boolean): void {
  btn.innerHTML = isVisible
    ? '<span class="material-symbols-outlined" style="font-size: 1.1rem; color: var(--accent-color, #38bdf8);">visibility</span>'
    : '<span class="material-symbols-outlined" style="font-size: 1.1rem; color: var(--text-muted); opacity: 0.5;">visibility_off</span>';
  btn.style.cssText = `background: transparent; border: 1px solid ${isVisible ? 'rgba(56, 189, 248, 0.3)' : 'var(--border-color)'}; border-radius: 4px; padding: 2px 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;`;
}

function findTargetRowForItem(item: SettingItemDef): HTMLElement | null {
  // Try finding by select/input IDs
  if (item.id === 'h_theme') {
    return document.getElementById('modalThemeSelect')?.closest('.setting-item') as HTMLElement;
  }
  if (item.id === 'h_locale') {
    return document.getElementById('modalLangSelect')?.closest('.setting-item') as HTMLElement;
  }
  if (item.id === 'h_zoom') {
    return document.getElementById('modalZoomSelect')?.closest('.setting-item') as HTMLElement;
  }
  if (item.id === 'ed_font_family') {
    return document.getElementById('modalFontFamilySelect')?.closest('.setting-item') as HTMLElement;
  }
  if (item.id === 'ed_font_size') {
    return document.getElementById('modalFontSizeSelect')?.closest('.setting-item') as HTMLElement;
  }
  if (item.id === 'sb_min_score') {
    return document.getElementById('numMinScore')?.closest('label') as HTMLElement;
  }
  if (item.id === 'sb_limit_select') {
    return document.getElementById('selSearchLimit')?.closest('label') as HTMLElement;
  }
  if (item.id === 'sb_metadata_toggle') {
    return document.getElementById('chkShowFullMetadata')?.closest('label') as HTMLElement;
  }
  return null;
}

function wireQuickSettingsGears(): void {
  const gears = document.querySelectorAll('[data-tab-target]');
  gears.forEach((gear) => {
    gear.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = (gear as HTMLElement).getAttribute('data-tab-target');
      if (targetTab) {
        window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: targetTab } }));
      }
    });
  });
}
