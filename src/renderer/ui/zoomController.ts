import { showToast } from './notifications/toastManager';

export function initZoomControls(): void {
  const modalZoomSelect = document.getElementById('modalZoomSelect') as HTMLSelectElement | null;
  const btnHeaderZoomIn = document.getElementById('btnHeaderZoomIn');
  const btnHeaderZoomOut = document.getElementById('btnHeaderZoomOut');

  if (!window.engineAPI?.setZoomFactor) return;

  const STORAGE_KEY = 'app_zoom_factor';
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3.0;
  const STEP = 0.1;

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
  applyZoom(currentZoom, false);

  function applyZoom(factor: number, notify = true): void {
    if (factor < MIN_ZOOM) factor = MIN_ZOOM;
    if (factor > MAX_ZOOM) factor = MAX_ZOOM;
    currentZoom = Math.round(factor * 100) / 100;
    window.engineAPI?.setZoomFactor(currentZoom);
    localStorage.setItem(STORAGE_KEY, currentZoom.toString());

    if (modalZoomSelect) {
      modalZoomSelect.value = currentZoom.toString();
      if (!modalZoomSelect.value) {
        modalZoomSelect.value = "1.0";
      }
    }

    if (notify) {
      showToast(`Zoom: ${Math.round(currentZoom * 100)}%`, 'info');
    }
  }

  // Relative Zoom In (+)
  if (btnHeaderZoomIn) {
    btnHeaderZoomIn.addEventListener('click', () => {
      applyZoom(currentZoom + STEP);
    });
  }

  // Relative Zoom Out (-)
  if (btnHeaderZoomOut) {
    btnHeaderZoomOut.addEventListener('click', () => {
      applyZoom(currentZoom - STEP);
    });
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

