/**
 * The {gear} token of a text: the place where the settings gear icon stands inside a sentence.
 * The locale files keep the plain token, so a translation can put the icon where its grammar wants it;
 * the one place that draws a text (i18n.ts) swaps the token for the same icon the real gears use.
 */
export const GEAR_TOKEN = '{gear}';

/** The parts of a text around each {gear} token; an empty string stands for the token itself. */
export function splitGearToken(text: string): string[] {
  return text.split(GEAR_TOKEN);
}

/** The gear icon in the shared "settings key" colour (same class as the gears in the first-run window). */
function gearIcon(): HTMLSpanElement {
  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined settings-key-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = 'settings';
  return icon;
}

/** Text with each {gear} token replaced by the gear icon, as a fragment (no HTML parsing, so nothing to escape). */
export function withGearIcons(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  splitGearToken(text).forEach((part, index) => {
    if (index > 0) frag.append(gearIcon());
    if (part) frag.append(part);
  });
  return frag;
}
