import { i18n } from '../../core/i18n.js';

export async function saveTextToFile(text, defaultFileName = 'document.txt', defaultExtension = 'txt') {
  const isTxt = defaultExtension === 'txt';
  const filterName = isTxt ? (i18n.filter_text || 'Text Document (*.txt)') : (i18n.filter_markdown || 'Markdown Document (*.md)');
  const filterExt = isTxt ? ['txt'] : ['md', 'markdown'];

  if (window.engineAPI && window.engineAPI.saveFile) {
    try {
      const result = await window.engineAPI.saveFile(text, defaultFileName, [{ name: filterName, extensions: filterExt }]);
      return result;
    } catch (err) {
      console.error(i18n.save_failed || "Save failed:", err);
      return { success: false, error: err.message };
    }
  } else {
    // Browser fallback
    const mimeType = isTxt ? 'text/plain;charset=utf-8' : 'text/markdown;charset=utf-8';
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    return { success: true };
  }
}
