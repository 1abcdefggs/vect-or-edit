import { setEditorContent, getCurrentContent, getActiveTab, markActiveTabSaved, focusEditor } from '../../editor/editorManager.js';
import { changeGoalProfile, resetGoalProfile, insertActiveTemplate, addKnowledgeSlot, clearAllKnowledgeSlots } from '../../search/dictionary.js';
import { setLedStatus } from '../../core/statusManager.js';
import { showToast } from '../notifications/toastManager.js';
import { t } from '../../core/i18n.js';

export function bindAppActionEvents() {
  const btnSave = document.getElementById('btnSave');
  const btnChangeGoal = document.getElementById('btnChangeGoal');
  const btnResetGoal = document.getElementById('btnResetGoal');
  const btnRestartApp = document.getElementById('btnRestartApp');
  const btnGitHub = document.getElementById('btnGitHub');
  const btnInsertTemplate = document.getElementById('btnInsertTemplate');
  const btnAddSlot = document.getElementById('btnAddSlot');
  const btnClearAllSlots = document.getElementById('btnClearAllSlots');
  const btnImportPreset = document.getElementById('btnImportDictionary') || document.getElementById('btnImportDict');
  const btnHeaderToggleSidebar = document.getElementById('btnHeaderToggleSidebar');
  const suggestionSidebar = document.getElementById('suggestionSidebar');

  // Drag & Drop
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.files?.length > 0) {
      const file = e.dataTransfer.files[0];
      const text = await file.text();
      setEditorContent(text, file.name);
    }
  });

  // Focus tracking
  window.addEventListener('focus', () => document.body.classList.add('window-active'));
  window.addEventListener('blur', () => document.body.classList.remove('window-active'));
  if (typeof document !== 'undefined' && document.hasFocus()) {
    document.body.classList.add('window-active');
  }

  // Sidebar header toggle
  if (btnHeaderToggleSidebar && suggestionSidebar) {
    btnHeaderToggleSidebar.addEventListener('click', () => {
      suggestionSidebar.classList.toggle('collapsed');
      const isCollapsed = suggestionSidebar.classList.contains('collapsed');
      btnHeaderToggleSidebar.style.background = isCollapsed ? 'transparent' : 'rgba(56, 189, 248, 0.15)';
      btnHeaderToggleSidebar.style.color = isCollapsed ? 'var(--text-main)' : 'var(--accent-color, #38bdf8)';
      setTimeout(() => {
        const ed = window.__monacoEditorInstance || null;
        if (ed?.layout) ed.layout();
      }, 210);
    });
  }

  if (btnChangeGoal) {
    btnChangeGoal.addEventListener('click', async () => {
      const res = await changeGoalProfile();
      if (res?.success) {
        const goalName = res.goal?.domain_name || res.goal?.profile_id || 'Custom';
        showToast(t('toast_goal_set', { name: goalName }), 'success');
      }
    });
  }

  if (btnResetGoal) {
    btnResetGoal.addEventListener('click', async () => {
      await resetGoalProfile();
      showToast(t('toast_guideline_reset'), 'info');
    });
  }

  if (btnRestartApp) {
    btnRestartApp.addEventListener('click', () => {
      if (window.engineAPI?.relaunchApp) window.engineAPI.relaunchApp();
      else window.location.reload();
    });
  }

  if (btnGitHub) {
    btnGitHub.addEventListener('click', () => {
      const url = 'https://github.com/1abcdefggs/vect-or-edit';
      if (window.engineAPI?.openExternal) window.engineAPI.openExternal(url);
      else window.open(url, '_blank');
    });
  }

  if (btnInsertTemplate) {
    btnInsertTemplate.addEventListener('click', async () => {
      await insertActiveTemplate((text) => {
        setEditorContent(text, 'template.md');
        showToast(t('toast_template_inserted'), 'info');
      });
    });
  }

  if (btnAddSlot) {
    btnAddSlot.addEventListener('click', async () => {
      const res = await addKnowledgeSlot();
      if (res?.success) {
        showToast(t('toast_kb_updated', { count: res.totalCount, slots: res.slots?.length || 0 }), 'success');
        setLedStatus('kb', true, `2. Knowledge Base & HNSW: Indexed (${res.totalCount?.toLocaleString()} items)`);
      }
    });
  }

  if (btnClearAllSlots) {
    btnClearAllSlots.addEventListener('click', async () => {
      await clearAllKnowledgeSlots();
      showToast(t('toast_all_slots_unloaded'), 'info');
      setLedStatus('kb', false, '2. Knowledge Base: Unloaded (Standard editor mode)');
    });
  }

  if (btnImportPreset) {
    btnImportPreset.addEventListener('click', async () => {
      const res = await changeGoalProfile();
      if (res?.success) {
        const profileName = res.profile?.domain_name || res.fileName || 'Preset';
        showToast(t('toast_goal_set', { name: profileName }), 'success');
        setLedStatus('guideline', true, `Guideline / Preset: Loaded (${profileName})`);
      }
      setTimeout(() => focusEditor(), 50);
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const content = getCurrentContent();
      const currentTab = getActiveTab();
      const defaultName = currentTab?.title || `vectoreditor_${Date.now()}.txt`;

      if (window.engineAPI?.saveFile) {
        const res = await window.engineAPI.saveFile(content, defaultName);
        if (res.success && res.filePath) {
          markActiveTabSaved(res.filePath);
          showToast(t('alert_file_saved', { path: res.filePath }), 'success');
        }
        setTimeout(() => focusEditor(), 50);
      }
    });
  }
}
