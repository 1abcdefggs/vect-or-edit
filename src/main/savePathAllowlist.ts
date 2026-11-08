import path from 'node:path';

/**
 * The paths the main process may overwrite without a dialog. Each one came from a choice the user made in a dialog
 * (an opened file, a saved file, an opened or chosen folder) during this run. A path the renderer names on its own is not
 * in the list, so the save falls back to the save dialog. Kept in memory only: it starts empty at each launch.
 */
export interface SavePathAllowlist {
  approveFile(filePath: string): void;
  approveFolder(folderPath: string): void;
  isApproved(target: string): boolean;
}

export function createSavePathAllowlist(): SavePathAllowlist {
  const files = new Set<string>();
  const folders = new Set<string>();
  return {
    approveFile(filePath) {
      files.add(path.resolve(filePath));
    },
    approveFolder(folderPath) {
      folders.add(path.resolve(folderPath));
    },
    // A file in an approved folder is allowed too (autosave writes into the save folder). Only the direct folder counts,
    // so a path cannot reach an approved folder's parent through "..", because path.resolve removes those first.
    isApproved(target) {
      const resolved = path.resolve(target);
      return files.has(resolved) || folders.has(path.dirname(resolved));
    }
  };
}
