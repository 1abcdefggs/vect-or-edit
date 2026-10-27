/**
 * Pipeline lamps: a click on a lamp that is not green jumps to the place that fixes it (ADR-11 section 2.7,
 * docs/PROJECT/04_VECT_OR_EDITOR/ui_blueprint/status_lamps.csv).
 *
 * Settings problems go to their settings tab. A Rust engine problem is not something a setting can fix (the engine is a
 * package the app loads), so the click opens the System tab and says what usually causes it.
 */
import { t } from '../../core/i18n.js';
import { showToast } from '../notifications/toastManager.js';

// Lamp element id -> where the click goes. tab: a settings tab id; hint: a dictionary key shown as a toast
const LAMP_TARGETS = {
  badgeLedConf: { tab: 'tabSystem' },
  badgeLedThm: { tab: 'tabAppearance' },
  badgeLedI18n: { tab: 'tabAppearance' },
  badgeLedMonaco: { tab: 'tabEditor' },
  badgeLedBin: { tab: 'tabSystem', hint: 'lamp_rust_error_hint' },
  badgeLedAi: { tab: 'tabAiSearch' },
  badgeLedKb: { tab: 'tabAiSearch' }
};

export function initLampNavigation() {
  for (const [id, target] of Object.entries(LAMP_TARGETS)) {
    const lamp = document.getElementById(id);
    if (!lamp) continue;
    lamp.addEventListener('click', () => {
      // A green lamp has nothing to fix: it only shows its details on hover
      if (lamp.classList.contains('pill-ready')) return;
      if (target.hint) showToast(t(target.hint), 'warning');
      window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: target.tab } }));
    });
  }
}
