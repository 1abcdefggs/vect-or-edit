/**
 * panelResizer.ts - drag the top edge of a bottom panel to change its height (ADR-11 section 2.8).
 *
 * One shared part for the log panel and the chat dock: a thin handle on the top edge, `ns-resize` cursor,
 * double-click goes back to the default height, the height is remembered through layoutMemory.
 * The height is written to a CSS variable, so the panel's own CSS decides how to use it.
 */
import { loadLayoutSize, saveLayoutSize } from './layoutMemory.js';

export interface PanelResizerOptions {
  panel: HTMLElement;
  /** 'y' (default): drag the top edge to change the height. 'x': drag the left edge to change the width */
  axis?: 'x' | 'y';
  /** CSS variable that holds the height, for example --log-panel-height */
  cssVar: string;
  /** localStorage key kept by layoutMemory */
  storageKey: string;
  defaultHeight: number;
  minHeight: number;
  /** Largest height allowed right now (it depends on the window) */
  maxHeight: () => number;
}

export function attachPanelResizer(options: PanelResizerOptions): void {
  const { panel, cssVar, storageKey, defaultHeight, minHeight, maxHeight } = options;
  const horizontal = options.axis === 'x';
  if (panel.querySelector(':scope > .panel-resizer')) return;

  const clamp = (value: number) => Math.max(minHeight, Math.min(maxHeight(), value));
  const apply = (height: number | null) => {
    if (height === null) panel.style.removeProperty(cssVar);
    else panel.style.setProperty(cssVar, `${clamp(height)}px`);
    (window as any).monacoEditorInstance?.layout();
  };

  const stored = loadLayoutSize(storageKey);
  if (stored !== null) apply(stored);

  const handle = document.createElement('div');
  handle.className = horizontal ? 'panel-resizer panel-resizer--x' : 'panel-resizer';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', horizontal ? 'vertical' : 'horizontal');
  panel.insertBefore(handle, panel.firstChild);

  handle.addEventListener('dblclick', () => {
    apply(null);
    saveLayoutSize(storageKey, defaultHeight);
  });

  handle.addEventListener('mousedown', (event: MouseEvent) => {
    event.preventDefault();
    const startY = horizontal ? event.clientX : event.clientY;
    const startHeight = horizontal ? panel.getBoundingClientRect().width : panel.getBoundingClientRect().height;
    handle.classList.add('is-dragging');
    document.body.classList.add('resizing-panel');

    const onMove = (move: MouseEvent) => apply(startHeight + (startY - (horizontal ? move.clientX : move.clientY)));
    const onUp = () => {
      handle.classList.remove('is-dragging');
      document.body.classList.remove('resizing-panel');
      saveLayoutSize(storageKey, horizontal ? panel.getBoundingClientRect().width : panel.getBoundingClientRect().height);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

/** Attaches the resizer to the log panel and the chat dock (both exist once the components are loaded). */
export function initPanelResizers(): void {
  const log = document.getElementById('systemLogPanel');
  if (log) {
    attachPanelResizer({
      panel: log,
      cssVar: '--log-panel-height',
      storageKey: 'layout_log_height',
      defaultHeight: 220,
      minHeight: 80,
      maxHeight: () => Math.round(window.innerHeight * 0.7)
    });
  }
  const dock = document.getElementById('editorLlmChatDock');
  if (dock) {
    attachPanelResizer({
      panel: dock,
      cssVar: '--llm-dock-height',
      storageKey: 'layout_chat_height',
      defaultHeight: 220,
      minHeight: 140,
      maxHeight: () => Math.round(window.innerHeight * 0.7)
    });
  }
}
