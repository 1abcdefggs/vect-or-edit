import { icons } from '../../core/icons.js';
import { getWorkspaceRoot } from '../../core/workspaceRoot';
import { setEditorContent } from '../../editor/editorManager.js';
import { setDocumentFormat, announceOpenedEncoding } from '../../editor/ui/statusBarManager.js';
import appLogoUrl from '../../assets/icon.png';
import { applyI18n } from '../../core/i18n';

export function initTopBarRenderer() {
  const appLogoEl = document.getElementById('appLogoIcon');
  if (appLogoEl && appLogoUrl) {
    appLogoEl.src = appLogoUrl;
  }

  if (window.engineAPI?.getAppVersion) {
    window.engineAPI.getAppVersion().then((version) => {
      if (!version) return;
      const label = `v${version}`;
      const badgeEls = ['appVersionBadge', 'aboutVersionBadge', 'setupVersionBadge', 'startupVersionBadge'];
      for (const id of badgeEls) {
        const el = document.getElementById(id);
        if (el) el.textContent = label;
      }
    }).catch(() => {});
  }

  const copyAllIconEl = document.getElementById('copyAllIcon');
  if (copyAllIconEl) copyAllIconEl.innerHTML = icons.copy;
}

let modalActionContext = { mode: 'open', saveCallback: null };

export function showWorkspaceModal(mode = 'open', saveCallback = null) {
  modalActionContext = { mode, saveCallback };
  const modal = document.getElementById('workspaceSetupModal');
  const btnSaveNormally = document.getElementById('btnSaveNormally');
  if (btnSaveNormally) {
    btnSaveNormally.style.display = mode === 'save' ? 'block' : 'none';
  }
  // The third button does what the mode needs: open mode goes on to the file dialog, save mode drops the save.
  const btnCancelWorkspace = document.getElementById('btnCancelWorkspace');
  if (btnCancelWorkspace) {
    btnCancelWorkspace.setAttribute('data-i18n', mode === 'open' ? 'btn_ws_open_file' : 'common_cancel');
    btnCancelWorkspace.setAttribute('data-i18n-title', mode === 'open' ? 'tip_ws_open_file' : 'tip_ws_cancel');
    applyI18n();
  }
  if (modal) modal.style.display = 'flex';
}

export function bindTopLevelUIEvents() {
  const workspaceSetupModal = document.getElementById('workspaceSetupModal');
  const btnCreateWorkspace = document.getElementById('btnCreateWorkspace');
  const btnCancelWorkspace = document.getElementById('btnCancelWorkspace');

  const openFileDialog = async () => {
    if (window.engineAPI && window.engineAPI.openFile) {
      const res = await window.engineAPI.openFile();
      if (res && res.success && res.content !== undefined) {
        setEditorContent(res.content, res.fileName);
        setDocumentFormat({ encoding: res.encoding || 'UTF-8', fileName: res.fileName });
        announceOpenedEncoding(res.encoding);
      }
    }
  };

  if (btnCreateWorkspace) {
    btnCreateWorkspace.addEventListener('click', async () => {
      if (workspaceSetupModal) workspaceSetupModal.style.display = 'none';
      await getWorkspaceRoot({ create: true });
      if (modalActionContext.mode === 'save' && modalActionContext.saveCallback) {
        await modalActionContext.saveCallback();
      } else {
        await openFileDialog();
      }
    });
  }

  const btnSaveNormally = document.getElementById('btnSaveNormally');
  if (btnSaveNormally) {
    btnSaveNormally.addEventListener('click', async () => {
      if (workspaceSetupModal) workspaceSetupModal.style.display = 'none';
      if (modalActionContext.mode === 'save' && modalActionContext.saveCallback) {
        await modalActionContext.saveCallback();
      }
    });
  }

  if (btnCancelWorkspace) {
    btnCancelWorkspace.addEventListener('click', async () => {
      if (workspaceSetupModal) workspaceSetupModal.style.display = 'none';
      if (modalActionContext.mode === 'open') {
        await openFileDialog();
      }
    });
  }
}
