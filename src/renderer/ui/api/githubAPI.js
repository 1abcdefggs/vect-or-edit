export const GITHUB_REPO_URL = 'https://github.com/1abcdefggs/vect-or-edit';

/**
 * Returns the app version from the Electron main process (app.getVersion()).
 * No hardcoded fallback: returns 'unknown' when the value cannot be read.
 */
export async function getCurrentAppVersion() {
  try {
    if (window.engineAPI && typeof window.engineAPI.getAppVersion === 'function') {
      const v = await window.engineAPI.getAppVersion();
      if (v) return v.replace(/^v/, '');
    }
  } catch {
    // ignore
  }
  return 'unknown';
}

