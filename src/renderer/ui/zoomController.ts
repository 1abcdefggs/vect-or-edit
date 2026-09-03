export function initZoomControls(): void {
  const modalZoomSelect = document.getElementById('modalZoomSelect') as HTMLSelectElement | null;

  if (!window.engineAPI?.setZoomFactor) return;

  const STORAGE_KEY = 'app_zoom_factor';
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3.0;

  let currentZoom = 1.0;

  // Load from localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      currentZoom = parseFloat(saved);
      if (isNaN(currentZoom) || currentZoom < MIN_ZOOM || currentZoom > MAX_ZOOM) {
        currentZoom = 1.0;
      }
    }
  } catch (e) {
    console.error('Failed to load zoom factor', e);
  }

  // Apply initial zoom
  applyZoom(currentZoom);

  function applyZoom(factor: number): void {
    if (factor < MIN_ZOOM) factor = MIN_ZOOM;
    if (factor > MAX_ZOOM) factor = MAX_ZOOM;
    currentZoom = factor;
    window.engineAPI?.setZoomFactor(currentZoom);
    localStorage.setItem(STORAGE_KEY, currentZoom.toString());

    if (modalZoomSelect) {
      modalZoomSelect.value = currentZoom.toString();
      if (!modalZoomSelect.value) {
        modalZoomSelect.value = "1.0";
      }
    }
  }

  if (modalZoomSelect) {
    modalZoomSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const val = parseFloat(target.value);
      if (!isNaN(val)) {
        applyZoom(val);
      }
    });
  }
}
