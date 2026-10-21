import { GITHUB_REPO_URL, getCurrentAppVersion } from '../api/githubAPI.js';
import { confirmClose } from '../notifications/closeGuard.js';

export function bindUpdateModalEvents() {
  const updateModal = document.getElementById('updateModal');
  const btnCloseUpdateModal = document.getElementById('btnCloseUpdateModal');
  const btnRemindLater = document.getElementById('btnRemindLater');
  const btnOpenRelease = document.getElementById('btnOpenRelease');
  const updateCurrentVersion = document.getElementById('updateCurrentVersion');

  if (updateCurrentVersion) {
    getCurrentAppVersion().then((ver) => {
      updateCurrentVersion.textContent = `v${ver}`;
    });
  }

  if (btnCloseUpdateModal && updateModal) {
    btnCloseUpdateModal.addEventListener('click', async () => {
      if (await confirmClose('update')) updateModal.style.display = 'none';
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
}

export function showUpdateModal(latestTag, releaseBody) {
  const updateModal = document.getElementById('updateModal');
  const updateLatestVersion = document.getElementById('updateLatestVersion');
  const updateChangelog = document.getElementById('updateChangelog');

  if (updateLatestVersion) updateLatestVersion.textContent = latestTag;
  if (updateChangelog) updateChangelog.textContent = releaseBody;
  if (updateModal) updateModal.style.display = 'flex';
}
