/** Writes the local draft of a tab (one localStorage entry per tab id). A draft is not a save. */
export function writeDraft(tab) {
  try {
    localStorage.setItem(`autosave_${tab.id}`, JSON.stringify({
      title: tab.title,
      content: tab.model ? tab.model.getValue() : '',
      filePath: tab.filePath || null,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.warn('[AutoSave] Draft write failed:', err);
  }
}
