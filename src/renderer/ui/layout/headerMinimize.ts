const STORAGE_KEY = 'header_minimized';
const HEADER_SELECTOR = '.app-header';
const BUTTON_ID = 'btnHeaderMinimize';

function readMinimized(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
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
    if (icon) icon.textContent = minimized ? 'expand_more' : 'expand_less';
    button.setAttribute('aria-expanded', String(!minimized));
  };

  apply(readMinimized());

  button.addEventListener('click', () => {
    const minimized = !header.classList.contains('app-header--minimized');
    apply(minimized);
    writeMinimized(minimized);
  });
}
