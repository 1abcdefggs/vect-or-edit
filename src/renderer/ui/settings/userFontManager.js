/**
 * Fonts the user added from the PC. The main process stores the files (userData/fonts); this module loads them
 * into the page with the FontFace API (from bytes, so the page's font-src rule stays closed) and shows each one as
 * an extra option in the font selects. The font cards (fontFamilyPicker.js) are drawn from those options.
 * Nothing is downloaded and nothing leaves the PC.
 */
import { t } from '../../core/i18n.js';
import { readStorage } from '../../core/storage.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { showToast } from '../notifications/toastManager.js';

const loaded = new Map(); // alias -> FontFace

/** The CSS font-family value of an added font: its own alias first, then the generic fallbacks of the app. */
export function fontValueFor(font) {
  return `'${font.alias}', 'Noto Sans JP', sans-serif`;
}

async function loadFace(font) {
  if (loaded.has(font.alias)) return true;
  const bytes = await window.engineAPI.readUserFont(font.file);
  if (!bytes) return false;
  try {
    const face = new FontFace(font.alias, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    await face.load();
    document.fonts.add(face);
    loaded.set(font.alias, face);
    return true;
  } catch {
    return false;
  }
}

function syncOptions(selects, fonts) {
  selects.filter(Boolean).forEach((select) => {
    const chosen = select.value;
    select.querySelectorAll('option[data-user-font]').forEach((option) => option.remove());
    fonts.forEach((font) => {
      const option = new Option(font.name, fontValueFor(font));
      option.dataset.userFont = font.file;
      select.append(option);
    });
    // Keep the choice; an added font that was saved as the choice becomes selectable again here
    const saved = readStorage(STORAGE_KEYS.FONT_FAMILY);
    const wanted = Array.from(select.options).some((o) => o.value === chosen) ? chosen : saved;
    if (wanted && Array.from(select.options).some((o) => o.value === wanted)) select.value = wanted;
  });
}

/**
 * options:
 *   selects:  the font <select> elements (toolbar and settings) that list the fonts
 *   onChange: called after the list changed, so the cards are redrawn and the editor takes the font
 * Returns { reload, add, remove }.
 */
export function createUserFontManager({ selects, onChange }) {
  let fonts = [];

  async function reload() {
    if (!window.engineAPI?.listUserFonts) return fonts;
    const listed = await window.engineAPI.listUserFonts();
    const ready = [];
    for (const font of listed) {
      if (await loadFace(font)) ready.push(font);
    }
    fonts = ready;
    syncOptions(selects, fonts);
    window.dispatchEvent(new Event('app:userFontsChanged'));
    onChange?.();
    return fonts;
  }

  async function add() {
    if (!window.engineAPI?.addUserFonts) return;
    const result = await window.engineAPI.addUserFonts();
    if (result.canceled) return;
    result.rejected.forEach((item) => showToast(t(`font_add_rejected_${item.problem}`, { name: item.name }), 'warning'));
    if (result.added.length) showToast(t('font_added_toast', { count: result.added.length }), 'info');
    await reload();
  }

  async function remove(file) {
    const font = fonts.find((f) => f.file === file);
    const res = await window.engineAPI.removeUserFont(file);
    if (!res.success) return;
    if (font) {
      const face = loaded.get(font.alias);
      if (face) document.fonts.delete(face);
      loaded.delete(font.alias);
      showToast(t('font_removed_toast', { name: font.name }), 'info');
    }
    await reload();
  }

  return { reload, add, remove };
}
