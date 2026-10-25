import { loadLayoutSize, saveLayoutSize } from './layoutMemory.js';
import { SIDEBAR_PANE, clampPaneWidth, isStoredPaneWidthValid } from './paneLimits.js';

export function initSidebarResizer(): void {
  const resizer = document.getElementById('sidebarResizer');
  const sidebar = document.getElementById('suggestionSidebar');
  if (!resizer || !sidebar) return;

  // Restore saved width
  const parsed = loadLayoutSize(SIDEBAR_PANE.storageKey);
  if (parsed !== null && isStoredPaneWidthValid(SIDEBAR_PANE, parsed)) {
    document.documentElement.style.setProperty(SIDEBAR_PANE.cssVar, `${parsed}px`);
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
}
