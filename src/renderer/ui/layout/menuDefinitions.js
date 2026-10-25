/**
 * Menu bar dropdown items (File, Edit, View, Window, Help), one list per menu.
 * menuRenderer.js writes them into the menu's container at startup. The ids and commands are the ones the
 * menu bar controller and the command registry already use; a separator is { separator: true }.
 * `text` is the English fallback shown before the locale is applied; `hidden` starts the item hidden.
 */
export const MENU_DROPDOWNS = {
  menuDropdownFile: [
    { id: 'menuItemNewFile', command: 'file.new', tip: 'tip_menu_new_file', label: 'menu_file_new', text: 'New File', accelerator: 'Ctrl+N' },
    { id: 'menuItemOpenFile', command: 'file.open', tip: 'tip_menu_open_file', label: 'menu_file_open', text: 'Open File...', accelerator: 'Ctrl+O' },
    { id: 'menuItemOpenWorkspace', command: 'file.openWorkspace', tip: 'tip_menu_open_workspace', label: 'menu_file_open_workspace', text: 'Open Workspace...' },
    { separator: true },
    { id: 'menuItemSaveFile', command: 'file.save', tip: 'tip_menu_save', label: 'menu_file_save', text: 'Save' },
    { id: 'menuItemSaveAs', command: 'file.saveAs', tip: 'tip_menu_save_as', label: 'menu_file_save_as', text: 'Save As...' },
    { id: 'menuItemSaveAll', command: 'file.saveAll', tip: 'tip_menu_save_all', label: 'menu_file_save_all', text: 'Save All' },
    { separator: true },
    { id: 'menuItemCloseTab', command: 'file.closeTab', tip: 'tip_menu_close_tab', label: 'menu_file_close', text: 'Close Tab', accelerator: 'Ctrl+W' },
    { id: 'menuItemCloseAllTabs', command: 'file.closeAllTabs', tip: 'tip_menu_close_all_tabs', label: 'menu_file_close_all', text: 'Close All Tabs', hidden: true },
    { id: 'menuItemFileSettings', command: 'help.settings', tip: 'tip_menu_preferences', label: 'menu_help_settings', text: 'Preferences & Settings...' },
    { separator: true },
    { id: 'menuItemExit', command: 'file.exit', tip: 'tip_menu_exit', label: 'menu_file_exit', text: 'Exit' }
  ],
  menuDropdownEdit: [
    { id: 'menuItemUndo', command: 'edit.undo', tip: 'tip_menu_undo', label: 'menu_edit_undo', text: 'Undo' },
    { id: 'menuItemRedo', command: 'edit.redo', tip: 'tip_menu_redo', label: 'menu_edit_redo', text: 'Redo' },
    { separator: true },
    { id: 'menuItemCut', command: 'edit.cut', tip: 'tip_menu_cut', label: 'menu_edit_cut', text: 'Cut' },
    { id: 'menuItemCopy', command: 'edit.copy', tip: 'tip_menu_copy', label: 'menu_edit_copy', text: 'Copy' },
    { id: 'menuItemPaste', command: 'edit.paste', tip: 'tip_menu_paste', label: 'menu_edit_paste', text: 'Paste' },
    { separator: true },
    { id: 'menuItemSelectAll', command: 'edit.selectAll', tip: 'tip_menu_select_all', label: 'menu_edit_select_all', text: 'Select All' }
  ],
  menuDropdownView: [
    { id: 'menuItemToggleSidebar', command: 'view.toggleSidebar', tip: 'tip_menu_toggle_sidebar', label: 'menu_view_toggle_sidebar', text: 'Toggle Suggest Sidebar', accelerator: 'Ctrl+B' },
    { id: 'menuItemToggleLogs', command: 'view.toggleLogs', tip: 'tip_menu_toggle_logs', label: 'menu_view_toggle_logs', text: 'Toggle System Logs', accelerator: 'Ctrl+J' },
    { separator: true },
    { id: 'menuItemZoomIn', command: 'view.zoomIn', tip: 'tip_menu_zoom_in', label: 'menu_view_zoom_in', text: 'Zoom In' },
    { id: 'menuItemZoomOut', command: 'view.zoomOut', tip: 'tip_menu_zoom_out', label: 'menu_view_zoom_out', text: 'Zoom Out' },
    { id: 'menuItemResetZoom', command: 'view.resetZoom', tip: 'tip_menu_reset_zoom', label: 'menu_view_reset_zoom', text: 'Reset Zoom' },
    { separator: true },
    { id: 'menuItemToggleTheme', command: 'view.toggleTheme', tip: 'tip_menu_toggle_theme', label: 'menu_view_toggle_theme', text: 'Toggle Theme' },
    { id: 'menuItemToggleLang', command: 'view.toggleLang', tip: 'tip_menu_toggle_lang', label: 'menu_view_toggle_lang', text: 'Toggle Language' }
  ],
  menuDropdownWindow: [
    { id: 'menuItemMinimize', command: 'window.minimize', tip: 'tip_menu_minimize', label: 'menu_window_minimize', text: 'Minimize' },
    { id: 'menuItemMaximize', command: 'window.maximize', tip: 'tip_menu_maximize', label: 'menu_window_maximize', text: 'Toggle Maximize' },
    { separator: true },
    { id: 'menuItemCloseWindow', command: 'window.close', tip: 'tip_menu_close_window', label: 'menu_window_close', text: 'Close Window' }
  ],
  menuDropdownHelp: [
    { id: 'menuItemAiSetup', command: 'help.aiSetup', tip: 'tip_menu_ai_setup', label: 'menu_help_ai_setup', text: 'First-run Setup...' },
    { id: 'menuItemDocs', command: 'help.docs', tip: 'tip_menu_docs', label: 'menu_help_docs', text: 'Documentation' }
  ]
};
