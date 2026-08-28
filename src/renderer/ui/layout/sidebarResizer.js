export function initSidebarResizer() {
  const resizer = document.getElementById('sidebarResizer');
  const sidebar = document.getElementById('suggestionSidebar');
  if (!resizer || !sidebar) return;

  // Restore saved width
  const savedWidth = localStorage.getItem('vectoreditor_sidebar_width');
  if (savedWidth) {
    const parsed = parseInt(savedWidth, 10);
    if (parsed >= 240 && parsed <= 800) {
      document.documentElement.style.setProperty('--sidebar-width', `${parsed}px`);
    }
  }

  let isDragging = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    resizer.classList.add('is-dragging');
    document.body.classList.add('resizing-sidebar');

    const onMouseMove = (moveEvent) => {
      if (!isDragging) return;
      const deltaX = startX - moveEvent.clientX;
      const maxWidth = Math.min(window.innerWidth * 0.65, 800);
      const newWidth = Math.max(240, Math.min(maxWidth, startWidth + deltaX));
      document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
      if (window.monacoEditorInstance) {
        window.monacoEditorInstance.layout();
      }
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        resizer.classList.remove('is-dragging');
        document.body.classList.remove('resizing-sidebar');
        const finalWidth = sidebar.getBoundingClientRect().width;
        localStorage.setItem('vectoreditor_sidebar_width', String(Math.round(finalWidth)));
        if (window.monacoEditorInstance) {
          window.monacoEditorInstance.layout();
        }
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}
