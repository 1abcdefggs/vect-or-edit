import { readStorage } from '../../core/storage.js';
import { icons } from '../../core/icons.js';
import { t } from '../../core/i18n';

const STORAGE_KEY = 'header_minimized';
const HEADER_SELECTOR = '.app-header';
const BUTTON_ID = 'btnHeaderMinimize';

function readMinimized(): boolean {
  try {
    return readStorage(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMinimized(minimized: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, minimized ? '1' : '0');
  } catch {
    // Storage is unavailable (private window, blocked site data): the state lasts for this session only.
  }
}

export function initHeaderMinimize(): void {
  const header = document.querySelector<HTMLElement>(HEADER_SELECTOR);
  const button = document.getElementById(BUTTON_ID);
  if (!header || !button) return;

  const icon = button.querySelector('.material-symbols-outlined');

  const apply = (minimized: boolean) => {
    header.classList.toggle('app-header--minimized', minimized);
    if (icon) icon.innerHTML = minimized ? icons.chevronsRight : icons.chevronsLeft;
    // The tooltip names what a click does now; the key is kept on the button so a language change redraws the right one
    const tipKey = minimized ? 'tip_header_expand' : 'tip_header_collapse';
    button.setAttribute('data-i18n-title', tipKey);
    button.title = t(tipKey);
    button.setAttribute('aria-expanded', String(!minimized));
  };

  apply(readMinimized());
  window.addEventListener('app:languageChanged', () => apply(header.classList.contains('app-header--minimized')));

  button.addEventListener('click', () => {
    const minimized = !header.classList.contains('app-header--minimized');
    apply(minimized);
    writeMinimized(minimized);
  });
}
