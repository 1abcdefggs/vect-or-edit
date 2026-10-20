/**
 * Save folder for new documents and .settings.json. The main process keeps the choice (userData),
 * because .settings.json itself is read from this folder.
 * First-run setup and the settings modal bind the same controls; both follow app:saveLocationChanged.
 */
import { t } from '../../core/i18n';
import { showToast } from '../notifications/toastManager.js';
import { syncSettingsToBackend } from './settingsState.js';

/** @returns {Promise<{ path: string, isBuiltIn: boolean } | null>} null in the browser build */
export async function getSaveLocation() {
  const api = window.engineAPI;
  if (!api?.getDefaultWorkspace) return null;
  const ws = await api.getDefaultWorkspace(false);
  return ws?.success ? { path: ws.path, isBuiltIn: ws.isBuiltIn !== false } : null;
}

async function changeSaveLocation(request) {
  const api = window.engineAPI;
  if (!api?.[request]) return null;
  const res = await api[request]();
  if (res?.canceled) return null;
  if (!res?.success) {
    showToast(t('save_location_failed'), 'error');
    return null;
  }
  // The settings follow the folder: write the current settings into the new one
  await syncSettingsToBackend();
  const location = { path: res.path, isBuiltIn: res.isBuiltIn !== false };
  window.dispatchEvent(new CustomEvent('app:saveLocationChanged', { detail: location }));
  showToast(t('save_location_changed', { path: res.path }), 'success');
  return location;
}

export const chooseSaveLocation = () => changeSaveLocation('chooseDefaultWorkspace');
export const resetSaveLocation = () => changeSaveLocation('resetDefaultWorkspace');

// Every bound set of controls; the window listeners below are added once and re-render all of them
const boundControls = new Set();
let windowListenersBound = false;

function renderControls({ pathEl, changeBtn, resetBtn, browserTextKey }, location) {
  if (!pathEl) return;
  if (!location) {
    pathEl.textContent = browserTextKey ? t(browserTextKey) : '';
    if (changeBtn) changeBtn.hidden = true;
    if (resetBtn) resetBtn.hidden = true;
    return;
  }
  pathEl.textContent = location.path;
  if (changeBtn) changeBtn.hidden = false;
  if (resetBtn) resetBtn.hidden = location.isBuiltIn;
}

const renderAll = (location) => boundControls.forEach((controls) => renderControls(controls, location));
// One IPC round trip refreshes every bound set
const refreshAll = async () => renderAll(await getSaveLocation());

/**
 * Shows the folder in pathEl and wires the change / reset buttons.
 * In the browser build there is no folder: pathEl shows browserText and the buttons are hidden.
 * Binding the same pathEl again is a no-op apart from the refresh.
 */
export function bindSaveLocationControls(controls) {
  const { pathEl, changeBtn, resetBtn } = controls;
  const refresh = async () => renderControls(controls, await getSaveLocation());

  if (![...boundControls].some((c) => c.pathEl === pathEl)) {
    boundControls.add(controls);
    changeBtn?.addEventListener('click', () => chooseSaveLocation());
    resetBtn?.addEventListener('click', () => resetSaveLocation());
  }
  if (!windowListenersBound) {
    windowListenersBound = true;
    window.addEventListener('app:saveLocationChanged', (e) => renderAll(e.detail));
    window.addEventListener('app:languageChanged', refreshAll);
  }
  refresh();
  return refresh;
}
