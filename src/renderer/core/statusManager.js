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

import { icons } from './icons.js';
import { t } from './i18n.js';

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

const badgeMap = {
  bin: 'badgeLedBin',
  kb: 'badgeLedKb',
  conf: 'badgeLedConf',
  thm: 'badgeLedThm',
  i18n: 'badgeLedI18n',
  monaco: 'badgeLedMonaco',
  ai: 'badgeLedAi'
};

// Lazy-loaded cache for DOM elements to prevent redundant lookups
const domCache = new Map();

function getCachedBadges(type) {
  if (domCache.has(type)) {
    return domCache.get(type);
  }

  const badgeId = badgeMap[type] || type;
  const startupBadgeId = 'startup' + badgeId.charAt(0).toUpperCase() + badgeId.slice(1);

  const bottomEl = document.getElementById(badgeId);
  const startupEl = document.getElementById(startupBadgeId);

  const badges = [bottomEl, startupEl].filter(Boolean).map(badge => ({
    badge,
    dot: badge.querySelector('.status-led-dot')
  }));

  domCache.set(type, badges);
  return badges;
}

/**
 * Main Status & Diagnostic Setter
 * Updates the 7-stage HTML badge indicators in the top SYSTEM LOG RUNTIME bar
 * @param {string} type - Subsystem key ('bin', 'kb', 'conf', 'thm', 'i18n', 'monaco', 'ai')
 * @param {boolean|string} status - true/'ready', false/'pending', or 'error'
 * @param {string} [tooltipText] - Detailed tooltip info
 */
const lastTooltips = {};

export function setLedStatus(type, status, tooltipText) {
  if (typeof document === 'undefined') return;

  if (tooltipText !== undefined) {
    lastTooltips[type] = tooltipText;
  } else {
    tooltipText = lastTooltips[type] || '';
  }

  const isReady = status === true || status === 'ready';
  const isError = status === 'error';
  const isPending = !isReady && !isError; // false or 'pending'

  if (type in subsystemState) {
    subsystemState[type] = isReady;
  }

  const cachedBadges = getCachedBadges(type);

  const tooltipExplanations = {
    bin: { desc: t('tt_desc_bin') || "Core search and analysis engine (Rust).", active: t('tt_active_bin') || "Automatically starts and connects." },
    kb: { desc: t('tt_desc_kb') || "Search index for specialized dictionaries and past documents.", active: t('tt_active_kb') || "Load dictionary JSON from [+Slot] in the sidebar." },
    conf: { desc: t('tt_desc_conf') || "User settings (font size, etc.).", active: t('tt_active_conf') || "Opens the settings screen and saves them." },
    thm: { desc: t('tt_desc_thm') || "Editor color theme (dark mode, etc.).", active: t('tt_active_thm') || "Select a theme from the settings screen." },
    i18n: { desc: t('tt_desc_i18n') || "Multilingual UI data (Japanese, etc.).", active: t('tt_active_i18n') || "Loaded automatically." },
    monaco: { desc: t('tt_desc_monaco') || "High-performance editor (Monaco Editor).", active: t('tt_active_monaco') || "Drawn automatically upon screen initialization." },
    ai: { desc: t('tt_desc_ai') || "AI model for understanding and searching by semantic meaning.", active: t('tt_active_ai') || "Download or enable the AI model from the settings screen." }
  };

  cachedBadges.forEach(({ badge, dot }) => {
    if (dot) {
      dot.className = 'status-led-dot'; // Reset classes
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
      }
    }
    if (tooltipText) {
      let fullTitle = tooltipText;
      const info = tooltipExplanations[type];
      if (info) {
        fullTitle += `\n\n${t('tt_meaning') || '[Meaning]'}\n${info.desc}`;
        if (!isReady) {
          fullTitle += `\n\n${t('tt_how_to_enable') || '[How to Enable]'}\n${info.active}`;
        }
      }
      // Instant custom tooltip attribute instead of 'title'
      badge.removeAttribute('title');
      badge.setAttribute('data-instant-tooltip', fullTitle);
    }
  });

  if (tooltipText) {
    // Also log it so it streams to the console panel for the user to see the pipeline progression
    const prefix = isReady ? '[OK]' : (isError ? '[ERROR]' : '[PENDING]');
    const msg = `[Pipeline] ${prefix} ${tooltipText}`;
    console.log(msg);
    if (window.appendSystemLog) {
      window.appendSystemLog(msg, isError ? 'error' : (isReady ? 'success' : 'info'));
    }

    // Cache the loader text if not cached
    if (!domCache.has('loaderStatusText')) {
      domCache.set('loaderStatusText', document.getElementById('loaderStatusText'));
    }
    const loaderText = domCache.get('loaderStatusText');
    if (loaderText) {
      loaderText.textContent = msg;
    }
  }
}

/**
 * Get current snapshot of all 7 subsystem states
 */
export function getSubsystemStates() {
  return { ...subsystemState };
}

/**
 * Initializes all LED badges with their localized pending state
 * so they instantly get the formatted data-instant-tooltip.
 */
export function initAllLedTooltips() {
  setLedStatus('conf', 'pending', '1. CONFIG: Loading...');
  setLedStatus('thm', 'pending', '2. THEME: Loading...');
  setLedStatus('i18n', 'pending', '3. LOCALE: Loading...');
  setLedStatus('monaco', 'pending', '4. EDITOR: Initializing...');
  setLedStatus('bin', 'pending', '5. RUST: Initializing...');
  setLedStatus('ai', 'pending', '6. AI-MODEL: Standby');
  setLedStatus('kb', 'pending', '7. HNSW: Unloaded');
}

// Ensure tooltip translations update when language changes
if (typeof window !== 'undefined') {
  window.addEventListener('app:languageChanged', () => {
    Object.keys(subsystemState).forEach(type => {
      setLedStatus(type, subsystemState[type], lastTooltips[type]);
    });
  });
}
