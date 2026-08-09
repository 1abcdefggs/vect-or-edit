import { icons } from './icons.js';
import { loadLocales, i18n } from './i18n.js';
import { initSettings } from './settings.js';
import { initQuickDictionary } from './dictionary.js';
import { toggleEditor, toggleDiffMode, updateEditorOptions, getCurrentContent } from './editorManager.js';
import { initVectorSearchForBasicEditor } from './vectorSearch.js';

window.__icons__ = icons;

document.addEventListener('DOMContentLoaded', async () => {
  // Inject SVG Icons
  document.getElementById('btnSave').insertAdjacentHTML('afterbegin', icons.save);
  document.getElementById('btnDiff').insertAdjacentHTML('afterbegin', icons.diff);
  document.getElementById('btnToggleEditor').insertAdjacentHTML('afterbegin', icons.editor);
  document.getElementById('btnTheme').insertAdjacentHTML('afterbegin', icons.theme);
  document.getElementById('iconNeuroContainer').innerHTML = icons.neuro;

  // Initialize Modules
  await loadLocales();
  initSettings(updateEditorOptions);
  
  // Background load dictionary (non-blocking)
  initQuickDictionary();
  
  const editorInput = document.getElementById('editorInput');
  initVectorSearchForBasicEditor(editorInput);

  // Bind Top-level UI Events
  const btnSave = document.getElementById('btnSave');
  const btnDiff = document.getElementById('btnDiff');
  const btnToggleEditor = document.getElementById('btnToggleEditor');

  btnSave.addEventListener('click', async () => {
    const content = getCurrentContent();
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const defaultName = `vectoreditor_${yyyy}${mm}${dd}_${hh}${min}.txt`;

    if (window.engineAPI && window.engineAPI.saveFile) {
      const res = await window.engineAPI.saveFile(content, defaultName);
      if (res.success) {
        alert((i18n.alert_file_saved || "Saved: {path}").replace("{path}", res.filePath));
      }
    }
  });

  btnDiff.addEventListener('click', () => {
    toggleDiffMode();
  });

  btnToggleEditor.addEventListener('click', () => {
    toggleEditor(icons);
  });
});
