/**
 * The one place that asks where the workspace root (the save folder) is. Save, Open, AutoSave and the settings page
 * all go through here, so a later change of the root (an opened folder, per-folder settings) is made once.
 * Returns null where there is no desktop shell (the browser build) or the main process refused.
 */
export interface WorkspaceRoot {
  path: string;
  /** false until the folder has been created */
  exists: boolean;
  /** true when it is the built-in Documents/VectOrEdit */
  isBuiltIn: boolean;
}

export async function getWorkspaceRoot(options: { create?: boolean } = {}): Promise<WorkspaceRoot | null> {
  const api = window.engineAPI;
  if (!api?.getDefaultWorkspace) return null;
  const res = await api.getDefaultWorkspace(Boolean(options.create));
  if (!res?.success || !res.path) return null;
  return { path: res.path, exists: Boolean(res.exists), isBuiltIn: res.isBuiltIn !== false };
}
