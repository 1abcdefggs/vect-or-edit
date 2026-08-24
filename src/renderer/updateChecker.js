import { STORAGE_KEYS } from './constants.js';

export const CURRENT_APP_VERSION = '0.2.0';
export const GITHUB_REPO_URL = 'https://github.com/1abcdefggs/vect-or-edit';

/**
 * Checks if latest version has a Major or Minor update compared to current version.
 * Patch updates (e.g. 0.2.0 -> 0.2.1) return false.
 */
export function isMajorOrMinorUpdate(currentVer, latestVer) {
  if (!currentVer || !latestVer) return false;
  const parse = (v) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const [cMajor = 0, cMinor = 0] = parse(currentVer);
  const [lMajor = 0, lMinor = 0] = parse(latestVer);

  if (lMajor > cMajor) return true;
  if (lMajor === cMajor && lMinor > cMinor) return true;
  return false;
}

export function initUpdateChecker() {
  const btnGitHub = document.getElementById('btnGitHub');
  if (btnGitHub) {
    btnGitHub.addEventListener('click', () => {
      if (window.engineAPI && window.engineAPI.openExternal) {
        window.engineAPI.openExternal(GITHUB_REPO_URL);
      } else {
        window.open(GITHUB_REPO_URL, '_blank');
      }
    });
  }

  const updateModal = document.getElementById('updateModal');
  const btnCloseUpdateModal = document.getElementById('btnCloseUpdateModal');
  const btnRemindLater = document.getElementById('btnRemindLater');
  const btnOpenRelease = document.getElementById('btnOpenRelease');
  const updateCurrentVersion = document.getElementById('updateCurrentVersion');
  const updateLatestVersion = document.getElementById('updateLatestVersion');

  if (updateCurrentVersion) {
    updateCurrentVersion.textContent = `v${CURRENT_APP_VERSION}`;
  }

  if (btnCloseUpdateModal && updateModal) {
    btnCloseUpdateModal.addEventListener('click', () => {
      updateModal.style.display = 'none';
    });
  }

  if (btnRemindLater && updateModal) {
    btnRemindLater.addEventListener('click', () => {
      updateModal.style.display = 'none';
    });
  }

  if (btnOpenRelease) {
    btnOpenRelease.addEventListener('click', () => {
      const releaseUrl = `${GITHUB_REPO_URL}/releases`;
      if (window.engineAPI && window.engineAPI.openExternal) {
        window.engineAPI.openExternal(releaseUrl);
      } else {
        window.open(releaseUrl, '_blank');
      }
      if (updateModal) updateModal.style.display = 'none';
    });
  }

  // Periodic or startup check for GitHub Releases
  checkForUpdates(false);
}

export async function checkForUpdates(isManual = false) {
  const updateModal = document.getElementById('updateModal');
  const updateLatestVersion = document.getElementById('updateLatestVersion');
  const updateChangelog = document.getElementById('updateChangelog');

  try {
    const res = await fetch('https://api.github.com/repos/1abcdefggs/vect-or-edit/releases/latest', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });

    if (!res.ok) return;
    const data = await res.json();
    const latestTag = data.tag_name || data.name || '';
    const releaseBody = data.body || 'New features, improvements and bug fixes.';

    if (isMajorOrMinorUpdate(CURRENT_APP_VERSION, latestTag)) {
      if (updateLatestVersion) updateLatestVersion.textContent = latestTag;
      if (updateChangelog) updateChangelog.textContent = releaseBody;
      if (updateModal) updateModal.style.display = 'flex';
    }
  } catch (err) {
    // Offline or network error - fail silently on startup
    if (isManual) {
      console.warn('Update check failed:', err);
    }
  }
}
