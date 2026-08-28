import { tabs, activeTabId, renderTabs, switchTab, createNewTab } from '../tabs/tabManager.js';
import { triggerAdaptiveAutoSave } from '../ui/autoSaveManager.js';
import { updateStatusBar } from '../ui/statusBarManager.js';
import { getMonaco } from '../core/editorCore.js';

/**
 * Exports all active tabs, contents, and editor states into a .vectorspace bundle.
 */
export async function exportWorkspaceBundle() {
  const bundle = {
    format: 'vectorspace_bundle',
    version: '1.0',
    timestamp: new Date().toISOString(),
    activeTabId,
    tabs: tabs.map(t => ({
      id: t.id,
      title: t.title,
      content: t.model ? t.model.getValue() : '',
      filePath: t.filePath,
      isDirty: t.isDirty
    }))
  };

  const jsonStr = JSON.stringify(bundle, null, 2);
  const defaultName = `Workspace_${new Date().toISOString().slice(0, 10)}.vectorspace`;

  if (window.engineAPI?.saveFile) {
    const res = await window.engineAPI.saveFile(jsonStr, defaultName);
    return res;
  } else {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  }
}

/**
 * Imports and restores all tabs from a .vectorspace bundle file.
 */
export async function importWorkspaceBundle(rawJson) {
  try {
    const data = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    if (data.format !== 'vectorspace_bundle' || !Array.isArray(data.tabs)) {
      throw new Error('Invalid .vectorspace bundle format');
    }

    const monaco = getMonaco() || (typeof window !== 'undefined' ? window.monaco : null);
    if (!monaco?.editor) {
      throw new Error('Monaco editor is not initialized');
    }

    // Dispose existing tab models
    tabs.forEach(t => {
      if (t.model) t.model.dispose();
    });
    tabs.length = 0;

    // Restore tabs from bundle
    for (const item of data.tabs) {
      const model = monaco.editor.createModel(item.content || '', 'markdown');
      const tabObj = {
        id: item.id || `tab_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        title: item.title || 'Untitled.md',
        model,
        filePath: item.filePath || null,
        isDirty: Boolean(item.isDirty)
      };

      model.onDidChangeContent(() => {
        if (!tabObj.isDirty) {
          tabObj.isDirty = true;
          renderTabs();
        }
        triggerAdaptiveAutoSave(tabObj);
        if (activeTabId === tabObj.id) {
          updateStatusBar(tabObj.title);
        }
      });

      tabs.push(tabObj);
    }

    if (tabs.length > 0) {
      const targetId = data.activeTabId && tabs.some(t => t.id === data.activeTabId)
        ? data.activeTabId
        : tabs[0].id;
      renderTabs();
      switchTab(targetId);
    } else {
      createNewTab();
    }
    return { success: true, count: tabs.length };
  } catch (err) {
    console.error('[BundleManager] Failed to import workspace bundle:', err);
    return { success: false, error: err.message };
  }
}
