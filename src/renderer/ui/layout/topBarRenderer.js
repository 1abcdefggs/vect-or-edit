import { icons } from '../../core/icons.js';
import { setEditorContent } from '../../editor/editorManager.js';

export function initTopBarRenderer() {
  const btnOpenEl = document.getElementById('btnOpen');
  if (btnOpenEl) btnOpenEl.innerHTML = icons.open;

  const btnSaveEl = document.getElementById('btnSave');
  if (btnSaveEl) btnSaveEl.innerHTML = icons.save;

  const copyAllIconEl = document.getElementById('copyAllIcon');
  if (copyAllIconEl) copyAllIconEl.innerHTML = icons.copy;

  const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
  if (sidebarToggleIcon) sidebarToggleIcon.innerHTML = icons.chevronRight;

  const iconNeuroEl = document.getElementById('iconNeuroContainer');
  if (iconNeuroEl) iconNeuroEl.innerHTML = icons.vector;
}

export function bindTopLevelUIEvents() {
  const btnOpen = document.getElementById('btnOpen');
  const workspaceSetupModal = document.getElementById('workspaceSetupModal');
  const btnCreateWorkspace = document.getElementById('btnCreateWorkspace');
  const btnCancelWorkspace = document.getElementById('btnCancelWorkspace');

  const openFileDialog = async () => {
    if (window.engineAPI && window.engineAPI.openFile) {
      const res = await window.engineAPI.openFile();
      if (res && res.success && res.content !== undefined) {
        setEditorContent(res.content, res.fileName);
      }
    }
  };

  if (btnOpen) {
    btnOpen.addEventListener('click', async () => {
      if (window.engineAPI && window.engineAPI.getDefaultWorkspace) {
        const wsRes = await window.engineAPI.getDefaultWorkspace(false);
        if (wsRes && wsRes.success && !wsRes.exists) {
          if (workspaceSetupModal) workspaceSetupModal.style.display = 'flex';
          return;
        }
      }
      await openFileDialog();
    });
  }

  if (btnCreateWorkspace) {
    btnCreateWorkspace.addEventListener('click', async () => {
      if (workspaceSetupModal) workspaceSetupModal.style.display = 'none';
      if (window.engineAPI && window.engineAPI.getDefaultWorkspace) {
        await window.engineAPI.getDefaultWorkspace(true);
      }
      await openFileDialog();
    });
  }

  if (btnCancelWorkspace) {
    btnCancelWorkspace.addEventListener('click', async () => {
      if (workspaceSetupModal) workspaceSetupModal.style.display = 'none';
      await openFileDialog();
    });
  }
}
