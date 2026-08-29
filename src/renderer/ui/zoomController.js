export function initZoomControls() {
  const modalZoomSelect = document.getElementById('modalZoomSelect');

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

  function applyZoom(factor) {
    if (factor < MIN_ZOOM) factor = MIN_ZOOM;
    if (factor > MAX_ZOOM) factor = MAX_ZOOM;
    currentZoom = factor;
    window.engineAPI.setZoomFactor(currentZoom);
    localStorage.setItem(STORAGE_KEY, currentZoom.toString());

    if (modalZoomSelect) {
      // Find the closest option or just set value if it exists
      modalZoomSelect.value = currentZoom.toString();
      // If the value doesn't exactly match an option, it will show blank.
      // So we might want to fallback to 1.0 or dynamically add it, 
      // but our predefined list (1.0, 1.1, 1.25, 1.4, 1.5) matches common defaults.
      if (!modalZoomSelect.value) {
        modalZoomSelect.value = "1.0";
      }
    }
  }

  if (modalZoomSelect) {
    modalZoomSelect.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        applyZoom(val);
      }
    });
  }
}
