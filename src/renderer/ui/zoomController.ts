import { showToast } from './notifications/toastManager';

export function initZoomControls(): void {
  const modalZoomSelect = document.getElementById('modalZoomSelect') as HTMLSelectElement | null;

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

    const percentEl = document.getElementById('headerZoomPercent');
    if (percentEl) {
      percentEl.textContent = `${Math.round(currentZoom * 100)}%`;
    }

    const sliderEl = document.getElementById('headerZoomSlider') as HTMLInputElement | null;
    if (sliderEl) sliderEl.value = currentZoom.toString();

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

  // Mouse wheel zoom support on header zoom group / badge
  const zoomBadge = (document.getElementById('headerZoomBadge') || document.querySelector('.header-zoom-group')) as HTMLElement | null;
  // Zooming scales the whole window, so the badge moves under a pointer that stays where it is. A wheel gesture that
  // started on the badge therefore keeps working for a moment after the pointer has slipped off it.
  const SESSION_MS = 1200;
  let sessionTimer: number | undefined;
  const keepZoomSession = (): void => {
    zoomBadge?.classList.add('is-zooming');
    window.clearTimeout(sessionTimer);
    sessionTimer = window.setTimeout(() => zoomBadge?.classList.remove('is-zooming'), SESSION_MS);
  };
  const stepByWheel = (e: WheelEvent): void => {
    e.preventDefault();
    keepZoomSession();
    if (e.deltaY < 0) {
      applyZoom(currentZoom + STEP);
    } else if (e.deltaY > 0) {
      applyZoom(currentZoom - STEP);
    }
  };

  if (zoomBadge) {
    zoomBadge.addEventListener('wheel', stepByWheel, { passive: false });
    window.addEventListener('wheel', (e: WheelEvent) => {
      if (!e.ctrlKey && zoomBadge.classList.contains('is-zooming')) stepByWheel(e);
    }, { passive: false });

    // Click on badge resets to 100%
    zoomBadge.addEventListener('click', () => {
      if (currentZoom !== 1.0) {
        applyZoom(1.0);
      }
    });

    // The slider sits inside the badge: dragging it sets the value and must not count as a click (reset)
    const zoomSlider = document.getElementById('headerZoomSlider') as HTMLInputElement | null;
    zoomSlider?.addEventListener('click', (e) => e.stopPropagation());
    zoomSlider?.addEventListener('input', () => applyZoom(parseFloat(zoomSlider.value), false));
  }

  // Ctrl + Mouse Wheel global zoom support
  window.addEventListener('wheel', (e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        applyZoom(currentZoom + STEP);
      } else if (e.deltaY > 0) {
        applyZoom(currentZoom - STEP);
      }
    }
  }, { passive: false });

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

