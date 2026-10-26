/**
 * Tooltip text shown as one item per line. Only these keys are changed; the locale files keep the sentence as it is.
 * The menu tips already have their own two-line form and the status tips use a line break, so they are not listed.
 */
export const BULLET_TIP_KEYS: ReadonlySet<string> = new Set([
  'tip_header_color_mode',
  'tip_save_all_needs_tabs',
  'tip_setup_sample_toggle',
  'tip_setup_install_local',
  'tip_menu_maximize',
  'tip_header_theme',
  'tip_show_full_metadata',
  'tip_editor_options_toggle',
  'tip_settings_guide',
  'tip_open_guide_item',
  'tip_ws_save_normally',
  'tip_vis_locked',
  'tip_set_master_ai',
  'tip_set_remember_layout',
  'tip_monaco_opts_reset_all'
]);

/** Each 、 starts a new bulleted line. The tooltip element uses white-space: pre-wrap, so the line breaks show. */
export function formatTipText(key: string, text: string): string {
  if (!BULLET_TIP_KEYS.has(key)) return text;
  return text.replace(/、/g, '\n・');
}
