/**
 * One-line notification strip at the top of the LOGS panel.
 * Used for toasts without action buttons. Returns false when the panel is closed,
 * so the caller can fall back to the floating toast and the message is not lost.
 */
const STRIP_ID = 'logToastStrip';
let hideTimer = null;

export function showLogToastStrip(message, type = 'info', durationMs = 10000) {
  const panel = document.getElementById('systemLogPanel');
  const strip = document.getElementById(STRIP_ID);
  if (!panel || !strip || panel.style.display === 'none') return false;

  strip.className = `log-toast-strip log-toast-${type}`;
  strip.textContent = message;
  strip.style.display = 'flex';

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    strip.style.display = 'none';
  }, durationMs);
  return true;
}
