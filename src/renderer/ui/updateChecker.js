import { fetchLatestRelease, isMajorOrMinorUpdate, CURRENT_APP_VERSION, GITHUB_REPO_URL } from './api/githubAPI.js';
import { bindUpdateModalEvents, showUpdateModal } from './modals/updateModal.js';

export { CURRENT_APP_VERSION, GITHUB_REPO_URL, isMajorOrMinorUpdate };

export function initUpdateChecker() {
  bindUpdateModalEvents();
  // Periodic or startup check for GitHub Releases
  checkForUpdates(false);
}

export async function checkForUpdates(isManual = false) {
  try {
    const { latestTag, releaseBody } = await fetchLatestRelease();

    if (isMajorOrMinorUpdate(CURRENT_APP_VERSION, latestTag)) {
      showUpdateModal(latestTag, releaseBody);
    }
  } catch (err) {
    // Offline or network error - fail silently on startup
    if (isManual) {
      console.warn('Update check failed:', err);
    }
  }
}
