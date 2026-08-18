/**
 * 7-Stage Pipeline Status Controller
 * Coordinates and updates the 7 diagnostic stages:
 * 1. RUST-ENGINE (Native DLL)
 * 2. HNSW-INDEX (Knowledge Base & Vector Index)
 * 3. CONFIG (User Settings)
 * 4. THEME (Color Palettes & Monaco Theme)
 * 5. LOCALE (i18n Dictionaries)
 * 6. EDITOR (Monaco Code Editor)
 * 7. AI-MODEL (Embeddings Transformers Worker)
 */

// Track all 7 subsystem readiness states
const subsystemState = {
  bin: false,    // 1. Rust Binary
  kb: false,     // 2. Knowledge Base & HNSW
  conf: false,   // 3. User Config
  thm: false,    // 4. Theme
  i18n: false,   // 5. Locale i18n
  monaco: false, // 6. Monaco Editor
  ai: false      // 7. AI Model
};

/**
 * Main Status & Diagnostic Setter
 * Updates the 7-stage HTML badge indicators in the top SYSTEM LOG RUNTIME bar
 * @param {string} type - Subsystem key ('bin', 'kb', 'conf', 'thm', 'i18n', 'monaco', 'ai')
 * @param {boolean|string} status - true/'ready', false/'pending', or 'error'
 * @param {string} [tooltipText] - Detailed tooltip info
 */
export function setLedStatus(type, status, tooltipText) {
  if (typeof document === 'undefined') return;

  const isReady = status === true || status === 'ready';
  const isError = status === 'error';
  const isPending = !isReady && !isError; // false or 'pending'

  if (type in subsystemState) {
    subsystemState[type] = isReady;
  }

  const badgeMap = {
    bin: 'badgeLedBin',
    kb: 'badgeLedKb',
    conf: 'badgeLedConf',
    thm: 'badgeLedThm',
    i18n: 'badgeLedI18n',
    monaco: 'badgeLedMonaco',
    ai: 'badgeLedAi'
  };

  const badgeId = badgeMap[type] || type;
  const badge = document.getElementById(badgeId);
  if (badge) {
    const dot = badge.querySelector('.status-led-dot');
    if (dot) {
      dot.classList.remove('status-loading', 'status-ready', 'status-error', 'status-pending');
      badge.classList.remove('pill-ready', 'pill-error', 'pill-pending');

      if (isReady) {
        dot.classList.add('status-ready');
        badge.classList.add('pill-ready');
      } else if (isError) {
        dot.classList.add('status-error');
        badge.classList.add('pill-error');
      } else {
        // Pending / Processing (Yellow)
        dot.classList.add('status-pending');
        badge.classList.add('pill-pending');
      }
    }
    if (tooltipText) {
      badge.title = tooltipText;
    }
  }

  // Check if all 7 subsystems are ready
  const allReady = Object.values(subsystemState).every(Boolean);
  if (allReady) {
    const liveLogTicker = document.getElementById('liveLogTicker');
    const btnToggleLiveTicker = document.getElementById('btnToggleLiveTicker');
    // Auto-compact to 1-line after 1.5 seconds if fully healthy
    setTimeout(() => {
      if (liveLogTicker && !liveLogTicker.classList.contains('collapsed')) {
        liveLogTicker.classList.add('compact-1line');
        if (btnToggleLiveTicker) {
          btnToggleLiveTicker.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
          btnToggleLiveTicker.title = 'Switch to Full View / Hide';
        }
      }
    }, 1500);
  }
}

/**
 * Get current snapshot of all 7 subsystem states
 */
export function getSubsystemStates() {
  return { ...subsystemState };
}
