import { t } from '../core/i18n';
import { readStorage, writeStorage } from '../core/storage.js';
import { showToast } from './notifications/toastManager';

export function initZoomControls(): void {
  const modalZoomSlider = document.getElementById('modalZoomSlider') as HTMLInputElement | null;

  if (!window.engineAPI?.setZoomFactor) return;

  const STORAGE_KEY = 'app_zoom_factor';
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3.0;
  const STEP = 0.1;

  let currentZoom = 1.0;

  // Load from localStorage
  try {
    const saved = readStorage(STORAGE_KEY);
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
    try {
      writeStorage(STORAGE_KEY, currentZoom.toString());
    } catch (e) {
      // The zoom is applied already; only its memory for the next start is lost
      console.warn('Failed to save the zoom factor', e);
    }

    const percentEl = document.getElementById('headerZoomPercent');
    if (percentEl) {
      percentEl.textContent = `${Math.round(currentZoom * 100)}%`;
    }

    const sliderEl = document.getElementById('headerZoomSlider') as HTMLInputElement | null;
    if (sliderEl) sliderEl.value = currentZoom.toString();

    if (modalZoomSlider) modalZoomSlider.value = currentZoom.toString();
    const modalPercentEl = document.getElementById('modalZoomPercent');
    if (modalPercentEl) modalPercentEl.textContent = `${Math.round(currentZoom * 100)}%`;

    if (notify) {
      showToast(t('toast_zoom', { percent: Math.round(currentZoom * 100) }), 'info');
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

    // Press and drag left or right on the badge to set the zoom step by step (each DRAG_PX_PER_STEP pixels is one STEP).
    // A drag ends with a release that must not count as a click, so a click-to-reset is ignored after a drag.
    const DRAG_PX_PER_STEP = 12;
    const DRAG_START_PX = 4;
    let dragStartX = 0;
    let dragStartZoom = 1;
    let dragPressed = false;
    let dragMoved = false;
    let swallowClick = false;
    zoomBadge.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('.header-zoom-slider')) return;
      dragPressed = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartZoom = currentZoom;
      // Keep the drag on the badge when the pointer leaves it (the popup slider lies below it)
      zoomBadge.setPointerCapture(e.pointerId);
    });
    zoomBadge.addEventListener('pointermove', (e: PointerEvent) => {
      if (!dragPressed) return;
      const dx = e.clientX - dragStartX;
      if (!dragMoved && Math.abs(dx) < DRAG_START_PX) return;
      dragMoved = true;
      keepZoomSession();
      const steps = Math.trunc(dx / DRAG_PX_PER_STEP);
      applyZoom(Math.round((dragStartZoom + steps * STEP) * 10) / 10, false);
    });
    const endDrag = (): void => {
      if (dragMoved) swallowClick = true;
      dragPressed = false;
      dragMoved = false;
    };
    zoomBadge.addEventListener('pointerup', endDrag);
    zoomBadge.addEventListener('pointercancel', endDrag);

    // Click on badge resets to 100%
    zoomBadge.addEventListener('click', () => {
      if (swallowClick) {
        swallowClick = false;
        return;
      }
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

  modalZoomSlider?.addEventListener('input', () => applyZoom(parseFloat(modalZoomSlider.value), false));
}

