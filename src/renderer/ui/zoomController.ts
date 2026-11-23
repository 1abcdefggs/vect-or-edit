import { t } from '../core/i18n';
import { readStorage, writeStorage } from '../core/storage.js';
import { showToast } from './notifications/toastManager';
import { frozenHintPlacement, type HintAnchor } from './zoomHintPlacement';

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
    placeHint();

    if (notify) {
      showToast(t('toast_zoom', { percent: Math.round(currentZoom * 100) }), 'info');
    }
  }

  // Mouse wheel zoom support on header zoom group / badge
  const zoomBadge = (document.getElementById('headerZoomBadge') || document.querySelector('.header-zoom-group')) as HTMLElement | null;
  const zoomHint = zoomBadge?.querySelector<HTMLElement>('.header-zoom-hint') ?? null;
  // Zooming scales the whole window, so the badge moves under a pointer that stays where it is. A wheel gesture that
  // started on the badge therefore keeps working for a moment after the pointer has slipped off it.
  const SESSION_MS = 1200;
  let sessionTimer: number | undefined;
  let pointerDown = false;
  // While a zoom gesture runs, the popup is held where it was on screen (see zoomHintPlacement.ts)
  let hintAnchor: HintAnchor | null = null;

  const holdHint = (): void => {
    if (hintAnchor || !zoomHint || getComputedStyle(zoomHint).display === 'none') return;
    const rect = zoomHint.getBoundingClientRect();
    hintAnchor = { left: rect.left * currentZoom, top: rect.top * currentZoom, factor: currentZoom };
  };
  const placeHint = (): void => {
    if (!zoomHint || !hintAnchor) return;
    const p = frozenHintPlacement(hintAnchor, currentZoom);
    zoomHint.classList.add('is-held');
    zoomHint.style.left = `${p.left}px`;
    zoomHint.style.top = `${p.top}px`;
    zoomHint.style.transform = `scale(${p.scale})`;
  };
  const releaseHint = (): void => {
    hintAnchor = null;
    zoomHint?.classList.remove('is-held');
    zoomHint?.style.removeProperty('left');
    zoomHint?.style.removeProperty('top');
    zoomHint?.style.removeProperty('transform');
  };
  const keepZoomSession = (): void => {
    zoomBadge?.classList.add('is-zooming');
    holdHint();
    window.clearTimeout(sessionTimer);
    sessionTimer = window.setTimeout(() => {
      // A press that is still held (a slider thumb that stands still) keeps the session going
      if (pointerDown) {
        keepZoomSession();
        return;
      }
      zoomBadge?.classList.remove('is-zooming');
      releaseHint();
    }, SESSION_MS);
  };
  // A press that is still held keeps the popup in place even after the session time has run out
  window.addEventListener('pointerdown', (e: PointerEvent) => {
    if (zoomBadge?.contains(e.target as Node)) pointerDown = true;
  }, true);
  const endPress = (): void => {
    if (!pointerDown) return;
    pointerDown = false;
    if (!zoomBadge?.classList.contains('is-zooming')) releaseHint();
  };
  window.addEventListener('pointerup', endPress, true);
  window.addEventListener('pointercancel', endPress, true);
  // A release outside the window or a lost focus sends no pointerup: without these the press would stay "held" for good
  window.addEventListener('blur', endPress);
  window.addEventListener('pointermove', (e: PointerEvent) => {
    if (pointerDown && e.buttons === 0) endPress();
  }, true);
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

    // Press and drag up or down on the badge to set the zoom step by step (each DRAG_PX_PER_STEP pixels is one STEP;
    // up = bigger, the same axis as the popup's arrows and slider). A drag ends with a release that must not count
    // as a click, so a click-to-reset is ignored after a drag.
    const DRAG_PX_PER_STEP = 12;
    const DRAG_START_PX = 4;
    let dragStartY = 0;
    let dragStartZoom = 1;
    let dragPressed = false;
    let dragMoved = false;
    let swallowClick = false;
    zoomBadge.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('.header-zoom-slider')) return;
      dragPressed = true;
      dragMoved = false;
      dragStartY = e.clientY;
      dragStartZoom = currentZoom;
      // Keep the drag on the badge when the pointer leaves it (the popup slider lies below it)
      zoomBadge.setPointerCapture(e.pointerId);
    });
    zoomBadge.addEventListener('pointermove', (e: PointerEvent) => {
      if (!dragPressed) return;
      const up = dragStartY - e.clientY;
      if (!dragMoved && Math.abs(up) < DRAG_START_PX) return;
      dragMoved = true;
      keepZoomSession();
      const steps = Math.trunc(up / DRAG_PX_PER_STEP);
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
    zoomSlider?.addEventListener('input', () => {
      keepZoomSession();
      applyZoom(parseFloat(zoomSlider.value), false);
    });

    // The hover meter's arrows step the zoom by 10%. Stopped here so the press is not a drag and the click is not a reset.
    zoomBadge.querySelectorAll<HTMLButtonElement>('.header-zoom-step').forEach((step) => {
      step.addEventListener('pointerdown', (e) => e.stopPropagation());
      step.addEventListener('click', (e) => {
        e.stopPropagation();
        keepZoomSession();
        applyZoom(Math.round((currentZoom + Number(step.dataset.zoomStep)) * 10) / 10, false);
      });
    });
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

  // Apply initial zoom last: applyZoom places the held popup, whose helpers are defined above
  applyZoom(currentZoom, false);
}

