import { setEditorContent, focusEditor } from '../../editor/editorManager.js';
import { changeGoalProfile, resetGoalProfile, insertActiveTemplate, addKnowledgeSlot, clearAllKnowledgeSlots } from '../../search/dictionary.js';
import { setLedStatus } from '../../core/statusManager.js';
import { showToast } from '../notifications/toastManager.js';
import { showConfirmModal } from '../notifications/confirmModal.js';
import { t } from '../../core/i18n.js';
import { commandManager } from '../../core/commandManager';

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
      // Unload All always asks, whatever the close-confirmation setting says (ADR-11, review item R6)
      const count = Number(document.getElementById('knowledgeSlotsCountBadge')?.textContent?.match(/\d+/)?.[0] || 0);
      const confirmed = await showConfirmModal({
        title: t('confirm_unload_all_title'),
        message: t('confirm_unload_all_message', { count: String(count) }),
        confirmText: t('btn_unload_all_confirm'),
        cancelText: t('btn_keep_open'),
        type: 'warning'
      });
      if (!confirmed) return;
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

  // Save button: a press opens or closes the menu (AutoSave, Save As, Save All). It closes on any outside click, Esc, or item pick.
  const saveDropdown = document.querySelector('.save-dropdown-container');
  const saveDropdownMenu = saveDropdown?.querySelector('.save-dropdown-menu');
  const setSaveMenuOpen = (isOpen) => {
    if (isOpen && saveDropdown && saveDropdownMenu) {
      const rect = saveDropdown.getBoundingClientRect();
      saveDropdownMenu.style.top = `${rect.bottom + 4}px`;
      saveDropdownMenu.style.left = `${rect.left}px`;
    }
    saveDropdown?.classList.toggle('is-open', isOpen);
    document.getElementById('btnSaveMenu')?.setAttribute('aria-expanded', String(isOpen));
  };
  // Left part saves at once; while AutoSave is pending (no file yet) it asks for a location instead
  btnSave?.addEventListener('click', async () => {
    setSaveMenuOpen(false);
    await commandManager.executeCommand(btnSave.dataset.autosaveState === 'pending' ? 'file.saveAs' : 'file.save');
    setTimeout(() => focusEditor(), 50);
  });
  document.getElementById('btnSaveMenu')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setSaveMenuOpen(!saveDropdown?.classList.contains('is-open'));
  });
  // The AutoSave switch keeps the menu open so the state can be read and changed in one go
  saveDropdown?.querySelectorAll('.save-dropdown-item:not(.autosave-menu-item)').forEach((item) => {
    item.addEventListener('click', () => setSaveMenuOpen(false));
  });
  document.addEventListener('click', (e) => {
    if (saveDropdown && !saveDropdown.contains(e.target)) setSaveMenuOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setSaveMenuOpen(false);
  });

  // Save As and Save All run the same commands as File > Save As / Save All (menuBarController.ts)
  btnSaveAs?.addEventListener('click', async () => {
    await commandManager.executeCommand('file.saveAs');
    setTimeout(() => focusEditor(), 50);
  });

  btnSaveAll?.addEventListener('click', async () => {
    // Disabled below two tabs; the item stays hoverable so its tooltip can say why
    if (btnSaveAll.classList.contains('disabled')) return;
    await commandManager.executeCommand('file.saveAll');
    setTimeout(() => focusEditor(), 50);
  });
}
