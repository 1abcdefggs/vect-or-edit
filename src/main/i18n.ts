/**
 * @api-source electron: app
 * @api-table  local: electron_main_modules_map.csv
 * @api-check  2026-11-19 (checked against the breaking-changes page; skill electron-api)
 */
import { app } from 'electron';
import en from '../renderer/locales/en.json';
import ja from '../renderer/locales/ja.json';

const DICTIONARIES: Record<string, Record<string, string>> = { en, ja };

/**
 * Text for the main process (dialog titles, error messages). It reads the renderer dictionaries, so each string
 * has one definition. The main process has no saved language, so the language follows the OS locale.
 */
export function mainT(key: string): string {
  const lang = app.getLocale().startsWith('ja') ? 'ja' : 'en';
  return DICTIONARIES[lang][key] ?? DICTIONARIES.en[key] ?? key;
}
