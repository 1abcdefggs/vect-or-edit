// Drag and drop for the sidebar cards (Guideline, Knowledge): dropping .json or .venc files adds them,
// the same as choosing them with the Add files button.

const ACCEPTED_EXT = /\.(json|venc)$/i;

function droppedPaths(event) {
  const files = Array.from(event.dataTransfer?.files || []);
  const api = window.engineAPI;
  if (!api || typeof api.getPathForFile !== 'function') return [];
  return files
    .map((file) => {
      try { return api.getPathForFile(file); } catch { return ''; }
    })
    .filter((p) => typeof p === 'string' && ACCEPTED_EXT.test(p));
}

/**
 * Makes `element` accept dropped knowledge files.
 * @param {HTMLElement} element  the card to drop onto
 * @param {(paths: string[]) => void} onDrop  receives only the accepted file paths
 */
export function enableFileDrop(element, onDrop) {
  if (!element) return;
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');

  element.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    element.classList.add('drop-target');
  });
  element.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); // without this the browser opens the file instead of dropping it
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  element.addEventListener('dragleave', (e) => {
    if (e.relatedTarget && element.contains(e.relatedTarget)) return;
    element.classList.remove('drop-target');
  });
  element.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    element.classList.remove('drop-target');
    const paths = droppedPaths(e);
    if (paths.length > 0) onDrop(paths);
  });
}
