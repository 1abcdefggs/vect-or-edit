/**
 * Writes one tab to its file. The tab is marked clean only after the main process confirms the write,
 * and only when the text did not change while the write was in flight.
 * Writes to the same tab run one after another, so an older save cannot land after a newer one.
 *
 * @returns {Promise<{ ok: true, filePath: string } | { ok: false, canceled?: true, error?: string }>}
 */
const pendingWrites = new Map();

export function commitTabToFile(tab, api = typeof window !== 'undefined' ? window.engineAPI : undefined) {
  const previous = pendingWrites.get(tab.id) || Promise.resolve();
  const next = previous.then(() => writeTab(tab, api));
  pendingWrites.set(tab.id, next);
  next.finally(() => {
    if (pendingWrites.get(tab.id) === next) pendingWrites.delete(tab.id);
  });
  return next;
}

async function writeTab(tab, api) {
  if (!tab || !tab.model) return { ok: false, error: 'No editor model' };
  if (!api || typeof api.saveFile !== 'function') return { ok: false, error: 'Save API unavailable' };

  const content = tab.model.getValue();
  const hasPath = !!tab.filePath;

  let res;
  try {
    // An absolute path writes directly; without one, the main process shows a save dialog.
    res = await api.saveFile(content, tab.filePath || tab.title || 'untitled.md', !hasPath);
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }

  if (res?.canceled) return { ok: false, canceled: true };

  const savedPath = res?.filePath || res?.path;
  if (!res?.success || !savedPath) {
    return { ok: false, error: res?.error || 'Write failed' };
  }

  tab.filePath = savedPath;
  if (tab.model.getValue() === content) {
    tab.isDirty = false;
  }
  return { ok: true, filePath: savedPath };
}
