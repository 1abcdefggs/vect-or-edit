import { GITHUB_REPO_URL, CURRENT_APP_VERSION } from '../api/githubAPI.js';

export function bindUpdateModalEvents() {
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
}

export function showUpdateModal(latestTag, releaseBody) {
  const updateModal = document.getElementById('updateModal');
  const updateLatestVersion = document.getElementById('updateLatestVersion');
  const updateChangelog = document.getElementById('updateChangelog');

  if (updateLatestVersion) updateLatestVersion.textContent = latestTag;
  if (updateChangelog) updateChangelog.textContent = releaseBody;
  if (updateModal) updateModal.style.display = 'flex';
}
