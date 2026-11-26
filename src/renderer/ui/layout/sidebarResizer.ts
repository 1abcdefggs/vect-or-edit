import { loadLayoutSize, saveLayoutSize } from './layoutMemory.js';
import { SIDEBAR_PANE, clampPaneWidth, isStoredPaneWidthValid } from './paneLimits.js';

export function initSidebarResizer(): void {
  const resizer = document.getElementById('sidebarResizer');
  const sidebar = document.getElementById('suggestionSidebar');
  if (!resizer || !sidebar) return;

  // Restore saved width (or the default when none is saved). This runs once at startup, so the startup sweep
  // folds the pane to the rail width and opens it to the target; returning to the top page does not sweep.
  const parsed = loadLayoutSize(SIDEBAR_PANE.storageKey);
  const savedWidth = parsed !== null && isStoredPaneWidthValid(SIDEBAR_PANE, parsed) ? parsed : SIDEBAR_PANE.defaultWidth;
  // The width the user chose. A window resize clamps the applied width to it, so a later, wider window restores it.
  let preferredWidth = savedWidth;
  const targetWidth = clampPaneWidth(SIDEBAR_PANE, preferredWidth, window.innerWidth);
  const STARTUP_SWEEP_ENABLED = true;
  if (!STARTUP_SWEEP_ENABLED) {
    document.documentElement.style.setProperty(SIDEBAR_PANE.cssVar, `${targetWidth}px`);
  } else {
  const root = document.documentElement;
  const RAIL_WIDTH = 44;
  sidebar.classList.add('startup-sweep');
  root.style.setProperty(SIDEBAR_PANE.cssVar, `${RAIL_WIDTH}px`);
  // Force a style flush so the rail width is the starting value of the transition; without it the browser
  // sees only the final width and nothing animates
  void sidebar.offsetWidth;
  root.style.setProperty(SIDEBAR_PANE.cssVar, `${targetWidth}px`);
  const endSweep = () => {
    sidebar.classList.remove('startup-sweep');
    if ((window as any).monacoEditorInstance) {
      (window as any).monacoEditorInstance.layout();
    }
  };
  sidebar.addEventListener('transitionend', (e: TransitionEvent) => {
    if (e.propertyName === 'width') endSweep();
  }, { once: true });
  window.setTimeout(endSweep, 1200);
  }

  let isDragging = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    resizer.classList.add('is-dragging');
    document.body.classList.add('resizing-sidebar');

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = startX - moveEvent.clientX;
      const newWidth = clampPaneWidth(SIDEBAR_PANE, startWidth + deltaX, window.innerWidth);
      document.documentElement.style.setProperty(SIDEBAR_PANE.cssVar, `${newWidth}px`);
      if ((window as any).monacoEditorInstance) {
        (window as any).monacoEditorInstance.layout();
      }
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        resizer.classList.remove('is-dragging');
        document.body.classList.remove('resizing-sidebar');
        const finalWidth = sidebar.getBoundingClientRect().width;
        preferredWidth = finalWidth;
        saveLayoutSize(SIDEBAR_PANE.storageKey, finalWidth);
        if ((window as any).monacoEditorInstance) {
          (window as any).monacoEditorInstance.layout();
        }
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // Keeps the editor's minimum when the window shrinks (rule 8). Not saved: the chosen width comes back on a wider window.
  window.addEventListener('resize', () => {
    if (isDragging) return;
    const applied = clampPaneWidth(SIDEBAR_PANE, preferredWidth, window.innerWidth);
    document.documentElement.style.setProperty(SIDEBAR_PANE.cssVar, `${applied}px`);
    if ((window as any).monacoEditorInstance) {
      (window as any).monacoEditorInstance.layout();
    }
  });
}
