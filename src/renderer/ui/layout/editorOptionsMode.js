/**
 * Editor Options mode of the right panel (ADR-11, user decision 2026-10-23).
 *
 * The toolbar button "Editor options" turns the right panel over: the dictionary side (Guidelines, Knowledge, results)
 * steps back and only the Editor Options card is shown, so every Monaco option can be tried live against the editor.
 * Pressing it again brings the dictionary side back, with the card as it was before.
 */
import { settingsStore } from '../../core/settingsStore.js';

const MODE_CLASS = 'sidebar-options-mode';
const CARD_KEY = 'sbr:editor-options-card';

export function initEditorOptionsMode() {
  const button = document.getElementById('btnEditorOptionsToggle');
  const card = document.getElementById('monacoOptionsCard');
  const sidebar = document.getElementById('suggestionSidebar');
  if (!button || !card || !sidebar) return;

  let cardWasCollapsed = true;
  let sidebarWasCollapsed = false;

  const setMode = (on) => {
    if (on === document.body.classList.contains(MODE_CLASS)) return;
    document.body.classList.toggle(MODE_CLASS, on);
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', String(on));

    if (on) {
      // A collapsed sidebar opens by itself, and the card opens so its options are visible at once
      sidebarWasCollapsed = sidebar.classList.contains('collapsed');
      if (sidebarWasCollapsed) document.getElementById('btnRailExpand')?.click();
      // The card is hidden by default (its visibility setting); the mode shows it for as long as the mode lasts
      card.removeAttribute('hidden');
      cardWasCollapsed = card.classList.contains('collapsed');
      card.classList.remove('collapsed');
      card.querySelector('.semantic-module-header')?.setAttribute('aria-expanded', 'true');
    } else {
      // Put the card back the way it was; the sidebar stays open (it was the user's choice to open it, or it was open already)
      if (cardWasCollapsed) card.classList.add('collapsed');
      // Back to the setting: hidden again unless the user made the card visible in the settings
      card.toggleAttribute('hidden', !settingsStore.isVisible(CARD_KEY));
      card.querySelector('.semantic-module-header')?.setAttribute('aria-expanded', String(!cardWasCollapsed));
    }
    window.__monacoEditorInstance?.layout();
  };

  button.addEventListener('click', () => setMode(!document.body.classList.contains(MODE_CLASS)));
}
