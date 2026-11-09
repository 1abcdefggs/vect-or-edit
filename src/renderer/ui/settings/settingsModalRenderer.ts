import { SETTINGS_REGISTRY } from '../../core/settingsRegistry';
import { settingsStore } from '../../core/settingsStore';
import { SettingItemDef, UiKey } from '../../types/settings';
import { t } from '../../core/i18n';
import { formatTipText } from '../../core/tipFormat';
import { showToast } from '../notifications/toastManager.js';

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
  // Items without a row of their own get one in the "Parts of the window" list (System tab)
  let targetRow: HTMLElement | null = findTargetRowForItem(item) ?? createVisibilityListRow(item);
  if (!targetRow) return;

  // Check if toggle is already attached
  if (targetRow.querySelector(`.vis-toggle-wrapper[data-vis-key="${visKey}"]`)) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'vis-toggle-wrapper';
  wrapper.setAttribute('data-vis-key', visKey);
  wrapper.style.cssText = 'display: inline-flex; align-items: center; flex-shrink: 0;';

  // The row's name is the switch's name (aria-labelledby), so a screen reader says which part it is
  const labelEl = targetRow.querySelector<HTMLElement>('.setting-label');
  if (labelEl && !labelEl.id) labelEl.id = `vis-label-${visKey}`;

  if (item.isEssential) {
    // A required part cannot be hidden: the reason is written out, not only shown as a grey lock
    const lock = document.createElement('span');
    lock.className = 'vis-state-required';
    lock.title = formatTipText('tip_vis_locked', t('tip_vis_locked'));
    const glyph = document.createElement('span');
    glyph.className = 'material-symbols-outlined';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = 'lock';
    const text = document.createElement('span');
    text.textContent = t('vis_state_required');
    lock.append(glyph, text);
    wrapper.appendChild(lock);
  } else {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vis-toggle-btn';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('data-ui-key', visKey);
    if (labelEl) btn.setAttribute('aria-labelledby', labelEl.id);
    btn.title = t(settingsStore.isVisible(visKey) ? 'tip_vis_hide' : 'tip_vis_show');

    updateEyeButtonState(btn, settingsStore.isVisible(visKey));

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      settingsStore.toggleVisibility(visKey);
      const isVis = settingsStore.isVisible(visKey);
      updateEyeButtonState(btn, isVis);
      btn.title = t(isVis ? 'tip_vis_hide' : 'tip_vis_show');
      // Parts that other features lean on say what stopped being available, and how to get it back
      if (!isVis && item.hideNoticeKey) showToast(`${t(item.hideNoticeKey)} ${t('hide_notice_restore')}`, 'warning');
    });

    wrapper.appendChild(btn);
  }

  // Prepend wrapper to the setting row label area
  const labelContainer = targetRow.querySelector('.setting-label')?.parentElement || targetRow.firstElementChild;
  if (labelContainer) {
    // The eye sits in front of the heading on one line (see .has-eye in settings-ui.css)
    labelContainer.classList.add('has-eye');
    labelContainer.insertBefore(wrapper, labelContainer.firstChild);
  }
}

/** A switch with both states written out: the lit word is the current state (look in settings-ui.css). */
function updateEyeButtonState(btn: HTMLButtonElement, isVisible: boolean): void {
  btn.replaceChildren(stateWord('vis_state_shown', isVisible), stateWord('vis_state_hidden', !isVisible));
  btn.setAttribute('aria-checked', String(isVisible));
}

function stateWord(key: string, lit: boolean): HTMLElement {
  const word = document.createElement('span');
  word.className = lit ? 'vis-state-word is-lit' : 'vis-state-word';
  word.textContent = t(key);
  return word;
}

function findTargetRowForItem(item: SettingItemDef): HTMLElement | null {
  // A row written in the page itself (the menu bar card in the Header tab)
  const ownRow = document.querySelector<HTMLElement>(`[data-vis-target="${item.id}"]`);
  if (ownRow) return ownRow;
  // Try finding by select/input IDs
  if (item.id === 'h_color_mode') {
    return document.getElementById('modalColorModeSelect')?.closest('.setting-item') as HTMLElement;
  }
  if (item.id === 'h_theme') {
    return document.getElementById('modalThemeCards')?.closest('.setting-item') as HTMLElement;
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
  if (item.id === 'sb_score_filter') {
    return document.getElementById('modalMinScoreInput')?.closest('.setting-item') as HTMLElement;
  }
  if (item.id === 'sb_limit_select') {
    return document.getElementById('modalLimitSelect')?.closest('.setting-item') as HTMLElement;
  }
  if (item.id === 'sb_metadata_toggle') {
    return document.getElementById('modalShowFullMetadataChk')?.closest('.setting-item') as HTMLElement;
  }
  return null;
}

/** A row in the "Parts of the window" list for a registered part that no settings row stands for. */
function createVisibilityListRow(item: SettingItemDef): HTMLElement | null {
  const list = document.getElementById('visibilityList');
  if (!list) return null;

  let group = list.querySelector<HTMLElement>(`[data-vis-group="${item.category}"]`);
  if (!group) {
    group = document.createElement('div');
    group.setAttribute('data-vis-group', item.category);
    const heading = document.createElement('div');
    heading.className = 'setting-label';
    heading.setAttribute('data-vis-group-heading', item.category);
    heading.style.cssText = 'margin: 14px 0 4px 0; color: var(--text-muted);';
    heading.textContent = t(`vis_group_${item.category}`);
    group.appendChild(heading);
    list.appendChild(group);
  }

  const row = document.createElement('div');
  row.className = 'setting-item';
  row.setAttribute('data-vis-item', item.id);
  row.style.cssText = 'padding: 6px 0;';
  const labelBox = document.createElement('div');
  // The eye sits in front of the name on one line
  labelBox.style.cssText = 'display: flex; align-items: center; gap: 4px;';
  const label = document.createElement('div');
  label.className = 'setting-label';
  label.setAttribute('data-vis-label', item.id);
  label.textContent = t(`vis_${item.id}`);
  labelBox.appendChild(label);
  row.appendChild(labelBox);
  group.appendChild(row);
  return row;
}

// Names in the list follow the language
window.addEventListener('app:languageChanged', () => {
  document.querySelectorAll<HTMLElement>('[data-vis-label]').forEach((el) => {
    el.textContent = t(`vis_${el.getAttribute('data-vis-label')}`);
  });
  document.querySelectorAll<HTMLElement>('[data-vis-group-heading]').forEach((el) => {
    el.textContent = t(`vis_group_${el.getAttribute('data-vis-group-heading')}`);
  });
});

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
