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

import { t } from './i18n';

export type SubsystemType = 'bin' | 'kb' | 'conf' | 'thm' | 'i18n' | 'monaco' | 'ai';
export type SubsystemStatus = boolean | 'ready' | 'loading' | 'pending' | 'standby' | 'unloaded' | 'error';

// Track all 7 subsystem readiness states
const subsystemState: Record<SubsystemType, SubsystemStatus> = {
  conf: 'loading',   // 1. User Config
  thm: 'loading',    // 2. Theme
  i18n: 'loading',   // 3. Locale i18n
  monaco: 'loading', // 4. Monaco Editor
  bin: 'loading',    // 5. Rust Binary
  ai: 'standby',     // 6. AI Model
  kb: 'standby'      // 7. Knowledge Base & HNSW
};

const badgeMap: Record<SubsystemType, string> = {
  bin: 'badgeLedBin',
  kb: 'badgeLedKb',
  conf: 'badgeLedConf',
  thm: 'badgeLedThm',
  i18n: 'badgeLedI18n',
  monaco: 'badgeLedMonaco',
  ai: 'badgeLedAi'
};

interface CachedBadge {
  badge: HTMLElement;
  dot: HTMLElement | null;
}

// Lazy-loaded cache for DOM elements to prevent redundant lookups
const domCache = new Map<string, any>();

function getCachedBadges(type: SubsystemType): CachedBadge[] {
  if (domCache.has(type)) {
    return domCache.get(type);
  }

  const badgeId = badgeMap[type] || type;
  const startupBadgeId = 'startup' + badgeId.charAt(0).toUpperCase() + badgeId.slice(1);

  const bottomEl = document.getElementById(badgeId);
  const startupEl = document.getElementById(startupBadgeId);

  const badges: CachedBadge[] = [bottomEl, startupEl]
    .filter((el): el is HTMLElement => Boolean(el))
    .map(badge => ({
      badge,
      dot: badge.querySelector<HTMLElement>('.status-led-dot')
    }));

  if (badges.length > 0) {
    domCache.set(type, badges);
  }
  return badges;
}

/**
 * Main Status & Diagnostic Setter
 * Updates the 7-stage HTML badge indicators in the top/bottom SYSTEM LOG RUNTIME bar
 */
const lastTooltips: Partial<Record<SubsystemType, string>> = {};

export function setLedStatus(type: SubsystemType | string, status: SubsystemStatus, tooltipText?: string): void {
  if (typeof document === 'undefined') return;

  const subType = type as SubsystemType;

  if (tooltipText !== undefined) {
    lastTooltips[subType] = tooltipText;
  } else {
    tooltipText = lastTooltips[subType] || '';
  }

  // Deep Status Classification
  const isReady = status === true || status === 'ready';
  const isError = status === 'error' || (status === false && (subType !== 'kb' && subType !== 'ai'));
  const isStandby = status === 'standby' || status === 'unloaded' || (status === false && (subType === 'kb' || subType === 'ai'));
  const isLoading = !isReady && !isError && !isStandby;

  if (subType in subsystemState) {
    subsystemState[subType] = status;
  }

  const cachedBadges = getCachedBadges(subType);

  const tooltipExplanations: Record<string, { desc: string; active: string }> = {
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
      badge.classList.remove('pill-ready', 'pill-error', 'pill-loading', 'pill-pending', 'pill-standby');

      if (isReady) {
        dot.classList.add('status-ready');
        badge.classList.add('pill-ready');
      } else if (isError) {
        dot.classList.add('status-error');
        badge.classList.add('pill-error');
      } else if (isStandby) {
        dot.classList.add('status-standby');
        badge.classList.add('pill-standby');
      } else {
        // Loading / In-Progress (Amber)
        dot.classList.add('status-loading');
        badge.classList.add('pill-loading');
      }
    }
    if (tooltipText) {
      let fullTitle = tooltipText;
      const info = tooltipExplanations[subType];
      if (info) {
        fullTitle += `\n\n${t('tt_meaning') || '[Meaning]'}\n${info.desc}`;
        if (!isReady && !isStandby) {
          fullTitle += `\n\n${t('tt_how_to_enable') || '[How to Enable]'}\n${info.active}`;
        }
      }
      // Instant custom tooltip attribute instead of 'title'
      badge.removeAttribute('title');
      badge.setAttribute('data-instant-tooltip', fullTitle);
    }
  });

  if (tooltipText) {
    const prefix = isReady ? '[OK]' : (isError ? '[ERROR]' : (isStandby ? '[STANDBY]' : '[LOADING]'));
    const msg = `[Pipeline] ${prefix} ${tooltipText}`;
    // Suppress spamming log lines during download progress (handled by progress bar row)
    const isDownloadingProgress = subType === 'ai' && tooltipText.includes('Downloading');
    if ((window as any).appendSystemLog && !isDownloadingProgress) {
      (window as any).appendSystemLog(msg, isError ? 'error' : (isReady ? 'success' : 'info'));
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
export function getSubsystemStates(): Record<SubsystemType, boolean> {
  const result = {} as Record<SubsystemType, boolean>;
  (Object.keys(subsystemState) as SubsystemType[]).forEach(k => {
    const s = subsystemState[k];
    result[k] = s === true || s === 'ready';
  });
  return result;
}

/**
 * Initializes all LED badges with their localized pending state
 * so they instantly get the formatted data-instant-tooltip.
 */
export function initAllLedTooltips(): void {
  if (subsystemState.conf !== 'ready' && subsystemState.conf !== true) {
    setLedStatus('conf', 'loading', '1. CONFIG: Loading...');
  }
  if (subsystemState.thm !== 'ready' && subsystemState.thm !== true) {
    setLedStatus('thm', 'loading', '2. THEME: Loading...');
  }
  if (subsystemState.i18n !== 'ready' && subsystemState.i18n !== true) {
    setLedStatus('i18n', 'loading', '3. LOCALE: Loading...');
  }
  if (subsystemState.monaco !== 'ready' && subsystemState.monaco !== true) {
    setLedStatus('monaco', 'loading', '4. EDITOR: Initializing...');
  }
  if (subsystemState.bin !== 'ready' && subsystemState.bin !== true) {
    setLedStatus('bin', 'loading', '5. RUST: Initializing...');
  }
  if (subsystemState.ai !== 'ready' && subsystemState.ai !== true) {
    setLedStatus('ai', 'standby', '6. AI-MODEL: Standby');
  }
  if (subsystemState.kb !== 'ready' && subsystemState.kb !== true) {
    setLedStatus('kb', 'standby', '7. HNSW: Unloaded');
  }
}

// Ensure tooltip translations update when language changes
if (typeof window !== 'undefined') {
  window.addEventListener('app:languageChanged', () => {
    (Object.keys(subsystemState) as SubsystemType[]).forEach(type => {
      setLedStatus(type, subsystemState[type], lastTooltips[type]);
    });
  });
}
