import { setEditorContent, getCurrentContent, getActiveTab, markActiveTabSaved, focusEditor, tabs } from '../../editor/editorManager.js';
import { changeGoalProfile, resetGoalProfile, insertActiveTemplate, addKnowledgeSlot, clearAllKnowledgeSlots } from '../../search/dictionary.js';
import { setLedStatus } from '../../core/statusManager.js';
import { showToast } from '../notifications/toastManager.js';
import { t } from '../../core/i18n.js';
import { showWorkspaceModal } from '../layout/topBarRenderer.js';
import { commitTabToFile } from '../../editor/io/tabCommit.js';

export function bindAppActionEvents() {
  const btnSave = document.getElementById('btnSave');
  const btnResetGoal = document.getElementById('btnResetGoal');
  const btnInsertTemplate = document.getElementById('btnInsertTemplate');
  const btnAddSlot = document.getElementById('btnAddSlot');
  const btnClearAllSlots = document.getElementById('btnClearAllSlots');
  const btnImportPreset = document.getElementById('btnImportDictionary');
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

  // Sidebar section headers (Guidelines, Knowledge) collapse on click; their action buttons do not
  document.querySelectorAll('.semantic-module-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.semantic-module-actions')) return;
      header.parentElement.classList.toggle('collapsed');
    });
  });

  // Focus tracking
  window.addEventListener('focus', () => document.body.classList.add('window-active'));
  window.addEventListener('blur', () => document.body.classList.remove('window-active'));
  if (typeof document !== 'undefined' && document.hasFocus()) {
    document.body.classList.add('window-active');
  }

  // Sidebar header toggle & Collapsed Rail
  if (btnHeaderToggleSidebar && suggestionSidebar) {
    const updateSidebarState = (collapsed) => {
      if (collapsed) {
        suggestionSidebar.classList.add('collapsed');
        btnHeaderToggleSidebar.classList.remove('active');
      } else {
        suggestionSidebar.classList.remove('collapsed');
        btnHeaderToggleSidebar.classList.add('active');
      }
      btnHeaderToggleSidebar.style.background = '';
      btnHeaderToggleSidebar.style.color = '';
      setTimeout(() => {
        const ed = window.__monacoEditorInstance || null;
        if (ed?.layout) ed.layout();
      }, 210);
    };

    btnHeaderToggleSidebar.addEventListener('click', () => {
      const isCurrentlyCollapsed = suggestionSidebar.classList.contains('collapsed');
      updateSidebarState(!isCurrentlyCollapsed);
    });

    const btnRailExpand = document.getElementById('btnRailExpand');
    if (btnRailExpand) {
      btnRailExpand.addEventListener('click', () => updateSidebarState(false));
    }

    const btnRailGuideline = document.getElementById('btnRailGuideline');
    const btnRailKnowledge = document.getElementById('btnRailKnowledge');

    if (btnRailGuideline) {
      btnRailGuideline.addEventListener('click', () => {
        updateSidebarState(false);
        const card = document.getElementById('guidelineModuleCard');
        if (card) {
          card.classList.remove('collapsed');
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    if (btnRailKnowledge) {
      btnRailKnowledge.addEventListener('click', () => {
        updateSidebarState(false);
        const card = document.getElementById('knowledgeModuleCard');
        if (card) {
          card.classList.remove('collapsed');
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }

  if (btnResetGoal) {
    btnResetGoal.addEventListener('click', async () => {
      await resetGoalProfile();
      showToast(t('toast_guideline_reset'), 'info');
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
    const handleAddSlot = async () => {
      const res = await addKnowledgeSlot();
      if (res?.success) {
        showToast(t('toast_kb_updated', { count: res.totalCount, slots: res.slots?.length || 0 }), 'success');
        setLedStatus('kb', true, `7. HNSW: Indexed (${res.totalCount?.toLocaleString()} items)`);
      }
    };
    btnAddSlot.addEventListener('click', handleAddSlot);
  }

  if (btnClearAllSlots) {
    btnClearAllSlots.addEventListener('click', async () => {
      await clearAllKnowledgeSlots();
      showToast(t('toast_all_slots_unloaded'), 'info');
      setLedStatus('kb', 'standby', '7. HNSW: Unloaded');
    });
  }

  if (btnImportPreset) {
    const handleImportPreset = async () => {
      const res = await changeGoalProfile();
      if (res?.success) {
        const profileName = res.profile?.domain_name || res.fileName || 'Preset';
        showToast(t('toast_goal_set', { name: profileName }), 'success');
        setLedStatus('guideline', true, `Guideline / Preset: Loaded (${profileName})`);
      }
      setTimeout(() => focusEditor(), 50);
    };
    btnImportPreset.addEventListener('click', handleImportPreset);
  }

  const btnSaveAs = document.getElementById('btnSaveAs');
  const btnSaveAll = document.getElementById('btnSaveAll');

  // Save button split: the arrow toggles Save As / Save All; it closes on any outside click, Esc, or item pick.
  const saveMenuToggle = document.getElementById('btnSaveMenuToggle');
  const saveDropdown = document.querySelector('.save-dropdown-container');
  const saveDropdownMenu = saveDropdown?.querySelector('.save-dropdown-menu');
  const setSaveMenuOpen = (isOpen) => {
    if (isOpen && saveDropdown && saveDropdownMenu) {
      const rect = saveDropdown.getBoundingClientRect();
      saveDropdownMenu.style.top = `${rect.bottom + 4}px`;
      saveDropdownMenu.style.left = `${rect.left}px`;
    }
    saveDropdown?.classList.toggle('is-open', isOpen);
    saveMenuToggle?.setAttribute('aria-expanded', String(isOpen));
  };
  saveMenuToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    setSaveMenuOpen(!saveDropdown?.classList.contains('is-open'));
  });
  saveDropdown?.querySelectorAll('.save-dropdown-item').forEach((item) => {
    item.addEventListener('click', () => setSaveMenuOpen(false));
  });
  document.addEventListener('click', (e) => {
    if (saveDropdown && !saveDropdown.contains(e.target)) setSaveMenuOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setSaveMenuOpen(false);
  });

  // Save current active tab
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const currentTab = getActiveTab();
      if (!currentTab) return;
      const content = getCurrentContent();
      const defaultName = currentTab.filePath || currentTab.title || 'untitled.md';

      const executeSave = async (forceDialog = false) => {
        if (window.engineAPI?.saveFile) {
          const res = await window.engineAPI.saveFile(content, defaultName, forceDialog);
          if (res?.success && res.filePath) {
            markActiveTabSaved(res.filePath);
            showToast(t('alert_file_saved', { path: res.filePath }) || `Saved: ${res.filePath}`, 'success');
          }
          setTimeout(() => focusEditor(), 50);
        }
      };

      // Check if this is the first save (no file path)
      if (!currentTab.filePath) {
        let hasWorkspace = false;
        if (window.engineAPI?.getDefaultWorkspace) {
          const wsRes = await window.engineAPI.getDefaultWorkspace(false);
          hasWorkspace = Boolean(wsRes?.success && wsRes?.exists);
        }

        if (!hasWorkspace) {
          showWorkspaceModal('save', () => executeSave(true));
          return;
        }
        // If workspace exists, show save dialog for initial save
        await executeSave(true);
      } else {
        // Overwrite directly without dialog
        await executeSave(false);
      }
    });
  }

  // Save As (always force save dialog)
  if (btnSaveAs) {
    btnSaveAs.addEventListener('click', async () => {
      const currentTab = getActiveTab();
      if (!currentTab) return;
      const content = getCurrentContent();
      const defaultName = currentTab.title || 'untitled.md';

      if (window.engineAPI?.saveFile) {
        const res = await window.engineAPI.saveFile(content, defaultName, true);
        if (res?.success && res.filePath) {
          markActiveTabSaved(res.filePath);
          showToast(t('alert_file_saved', { path: res.filePath }) || `Saved as: ${res.filePath}`, 'success');
        }
        setTimeout(() => focusEditor(), 50);
      }
    });
  }

  // Save All
  if (btnSaveAll) {
    btnSaveAll.addEventListener('click', async () => {
      const currentTabs = tabs || [];
      let savedCount = 0;
      let failedCount = 0;
      for (const tab of currentTabs) {
        if (!tab.model) continue;
        const result = await commitTabToFile(tab);
        if (result.ok) savedCount++;
        else if (!result.canceled) failedCount++;
      }
      if (failedCount) showToast(t('save_failed'), 'error');
      showToast(`Saved ${savedCount} document(s)`, 'success');
      setTimeout(() => focusEditor(), 50);
    });
  }
}
