/**
 * Save folder for new documents and .settings.json. The main process keeps the choice (userData),
 * because .settings.json itself is read from this folder.
 * The folder has two parts the user can change on their own: its location (a folder picker) and its name (text).
 * First-run setup and the settings modal bind the same controls; both follow app:saveLocationChanged.
 */
import { t } from '../../core/i18n';
import { getWorkspaceRoot } from '../../core/workspaceRoot';
import { showToast } from '../notifications/toastManager.js';
import { syncSettingsToBackend } from './settingsState.js';
import { checkFolderName } from '../../../shared/folderName';

/** @returns {Promise<{ path: string, isBuiltIn: boolean } | null>} null in the browser build */
export async function getSaveLocation() {
  const root = await getWorkspaceRoot();
  return root ? { path: root.path, isBuiltIn: root.isBuiltIn } : null;
}

/** Splits a folder path into where it is and what it is called. Works for Windows and POSIX separators. */
export function splitFolderPath(fullPath) {
  const text = String(fullPath || '').replace(/[\\/]+$/, '');
  const cut = Math.max(text.lastIndexOf('\\'), text.lastIndexOf('/'));
  if (cut < 0) return { parent: '', separator: '', name: text };
  return { parent: text.slice(0, cut), separator: text[cut], name: text.slice(cut + 1) };
}

async function changeSaveLocation(request, ...args) {
  const api = window.engineAPI;
  if (!api?.[request]) return null;
  const res = await api[request](...args);
  if (res?.canceled) return null;
  if (!res?.success) {
    // A refused name already has its own message beside the field
    if (!res?.problem) showToast(t('save_location_failed'), 'error');
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
export const renameSaveLocation = (name) => changeSaveLocation('renameDefaultWorkspace', name);

// Every bound set of controls; the window listeners below are added once and re-render all of them
const boundControls = new Set();
let windowListenersBound = false;
let lastLocation = null;

function renderPath(pathEl, location) {
  const { parent, separator, name } = splitFolderPath(location.path);
  // First-run setup shows only where the folder is; the name lives in the input beside it
  if (pathEl.hasAttribute('data-parent-only')) {
    pathEl.textContent = parent + separator;
    return;
  }
  if (!pathEl.hasAttribute('data-split-name')) {
    pathEl.textContent = location.path;
    return;
  }
  // The name is the part the user can rename, so it is set apart from where the folder is
  const parentEl = document.createElement('span');
  parentEl.className = 'save-path-parent';
  parentEl.textContent = parent + separator;
  const nameEl = document.createElement('span');
  nameEl.className = 'save-path-name';
  nameEl.textContent = name;
  pathEl.replaceChildren(parentEl, nameEl);
}

function renderHint(controls) {
  const { nameInput, nameHintEl } = controls;
  if (!nameInput) return;
  const problem = controls.problem;
  nameInput.setAttribute('aria-invalid', String(Boolean(problem)));
  nameInput.classList.toggle('is-invalid', Boolean(problem));
  if (!nameHintEl) return;
  nameHintEl.classList.toggle('is-error', Boolean(problem));
  // The saved state lights the line with a check and flashes the name frame once (CSS); the classes end with the status
  const saved = !problem && Boolean(controls.statusKey);
  nameHintEl.classList.toggle('is-saved', saved);
  nameInput.closest('.first-run-name-box')?.classList.toggle('is-saved', saved);
  // A valid name shows the default hint only where the caller wants it; first-run setup keeps the line empty
  // (its explanation lives in the info icon), so the line shows nothing but a problem
  // The line always says something useful: the problem, else the status of the last save, else how saving works
  const idleKey = controls.showDefaultHint === false ? null : (controls.idleHintKey || 'setup_folder_name_hint');
  const key = controls.statusKey || idleKey;
  nameHintEl.textContent = problem ? t(`folder_name_problem_${problem}`) : (key ? t(key) : '');
}

/** Shows "saved" for a moment after a rename, then falls back to the idle line. */
function flashStatus(controls, key) {
  clearTimeout(controls.statusTimer);
  controls.statusKey = key;
  renderHint(controls);
  controls.statusTimer = setTimeout(() => {
    controls.statusKey = null;
    renderHint(controls);
  }, 2000);
}

function renderControls(controls, location) {
  const { pathEl, changeBtn, resetBtn, nameInput, browserTextKey } = controls;
  if (!pathEl) return;
  if (!location) {
    pathEl.textContent = browserTextKey ? t(browserTextKey) : '';
    if (changeBtn) changeBtn.hidden = true;
    if (resetBtn) resetBtn.hidden = true;
    if (nameInput) nameInput.closest('[data-save-name-field]')?.setAttribute('hidden', '');
    return;
  }
  renderPath(pathEl, location);
  if (changeBtn) changeBtn.hidden = false;
  if (resetBtn) resetBtn.hidden = location.isBuiltIn;
  if (nameInput) {
    nameInput.closest('[data-save-name-field]')?.removeAttribute('hidden');
    // Do not overwrite what the user is typing; the field follows the folder once it is left
    if (document.activeElement !== nameInput && !controls.problem) nameInput.value = splitFolderPath(location.path).name;
  }
  renderHint(controls);
}

function renderAll(location) {
  lastLocation = location;
  boundControls.forEach((controls) => renderControls(controls, location));
}

// One IPC round trip refreshes every bound set
const refreshAll = async () => renderAll(await getSaveLocation());

/**
 * Shows the folder in pathEl and wires the change / reset buttons.
 * Optional: nameInput (+ nameHintEl) lets the user rename the folder in place; a name with a problem is
 * explained beside the field and is never sent to the main process.
 * In the browser build there is no folder: pathEl shows browserText and the buttons are hidden.
 * Binding the same pathEl again is a no-op apart from the refresh.
 * @returns {{ refresh: () => Promise<void>, commit: () => Promise<boolean>, isValid: () => boolean, focusName: () => void }}
 */
export function bindSaveLocationControls(controls) {
  const { pathEl, changeBtn, resetBtn, nameInput } = controls;
  controls.problem = null;

  const isCurrentName = () => lastLocation && nameInput.value.trim() === splitFolderPath(lastLocation.path).name;

  /** Renames the folder when the field holds a different, valid name. Resolves false when the name has a problem. */
  async function commit() {
    // No name field, or no folder at all (browser build): there is nothing to rename
    if (!nameInput || !lastLocation) return true;
    const check = checkFolderName(nameInput.value);
    controls.problem = check.ok ? null : check.problem;
    renderHint(controls);
    if (!check.ok) return false;
    if (isCurrentName()) return true;
    const location = await renameSaveLocation(check.name);
    if (!location) {
      // The main process refused it (for example the folder cannot be created): show the current name again
      await refreshAll();
      return false;
    }
    flashStatus(controls, 'setup_folder_name_saved');
    return true;
  }

  const refresh = async () => {
    const location = await getSaveLocation();
    lastLocation = location;
    renderControls(controls, location);
  };

  if (![...boundControls].some((c) => c.pathEl === pathEl)) {
    boundControls.add(controls);
    changeBtn?.addEventListener('click', () => chooseSaveLocation());
    resetBtn?.addEventListener('click', () => {
      controls.problem = null;
      resetSaveLocation();
    });
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        const check = checkFolderName(nameInput.value);
        controls.problem = check.ok ? null : check.problem;
        // Typing again ends the "saved" status, so the line never claims a save that is not the current text
        clearTimeout(controls.statusTimer);
        controls.statusKey = null;
        renderHint(controls);
      });
      nameInput.addEventListener('change', () => { commit(); });
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
      });
    }
  }
  if (!windowListenersBound) {
    windowListenersBound = true;
    window.addEventListener('app:saveLocationChanged', (e) => renderAll(e.detail));
    window.addEventListener('app:languageChanged', refreshAll);
  }
  refresh();
  return {
    refresh,
    commit,
    isValid: () => !controls.problem,
    focusName: () => nameInput?.focus()
  };
}
