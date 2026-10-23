# Changelog

All notable changes to the **VectOrEdit** (`vect-or-edit`) desktop application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- The guide beside the settings is also shown in English (it follows the UI language)

## [0.3.30] - 2026-10-22

### Added
- Editor Options card in the right sidebar: every Monaco editor option (306 values; object options such as the minimap are expanded into their members) as a switch, choice list, number or text field. A change shows in the main editor at once and is kept for the next start. The card has a search box, groups, a reset button per option and one for all of them
- Options the settings page already owns (font, size, line height, word wrap, line numbers, line highlight, whitespace, sticky scroll), and options the app depends on, are shown read-only. Six scrollbar options that Monaco reads only when the editor is created are stored and apply at the next start
- Japanese and English texts for every option, a generated option catalog (`scripts/extract-monaco-options.mjs`, from the installed Monaco typings) and a test that fails when the catalog is older than the installed Monaco
- The card can be shown or hidden like every other part of the window (Settings > System)

## [0.3.29] - 2026-10-22

### Added
- The settings page is split in two: the settings on the left, and a guide for the open tab on the right (1000 px and wider, Japanese UI). The guide follows the setting that has focus, and a click on a guide row brings that setting into view
- Every part of the window can be shown or hidden from Settings > System: the editor toolbar parts, the chat dock and its buttons, the document tabs, the status bars, the sidebar cards and rail, the log buttons and more. Hiding a part other features lean on says what stops being available and how to get it back
- Settings that choose between a few options show the current choice as segmented buttons, and on/off settings as switches
- The header zoom badge shows a mouse-wheel icon

### Changed
- The settings tabs follow the four areas of the window: Header, Editor, Sidebar, System. The LLM provider and keys moved to the Editor tab; the embedding settings stay in the Sidebar tab
- Settings rows show the eye button and the heading on one line, with the description below as bullets
- Tooltips show the opposite of the mode: dark in light mode, light in dark mode
- The header zoom badge has a fixed width, and when the window narrows the menu bar gives way instead of the controls on the right
- Several settings labels and tooltips that were still English in the Japanese UI are translated

### Fixed
- Text on selected buttons and accent-coloured text on the settings page now reach a 4.5:1 contrast in light and dark modes
- Hiding the sidebar also hides its resize handle
- The tooltip of the editor AI button described the embedding model; it now describes the LLM button

### Removed
- Styles of the old master-AI pill and six unused strings

## [0.3.28] - 2026-10-22

### Added
- The SAVE button opens a menu when pressed, with AutoSave, Overwrite (Save), Save As and Save All
- AutoSave in the menu shows its state as an ON / OFF switch and stays open when pressed, so it can be switched in one go
- Save All is disabled with fewer than two tabs open, and its hover text says that two or more tabs are needed

### Changed
- The SAVE button no longer saves by itself and no longer has a split arrow; Ctrl+S and File > Save save the document, and the SAVE button opens the menu
- Save All and Save As keep their behaviour and move into the menu

## [0.3.27] - 2026-10-22

### Added
- The PIPELINE button carries a lamp for the worst subsystem state (error, warning, loading, standby, ready), so a problem is visible while the strip is closed
- A right-click menu on editor tabs with "Duplicate tab"
- The About dialog names the parts in use: the app, engine, Monaco and Electron versions, the chosen theme with its license and source, and every downloaded embedding model with a link to its Hugging Face page. Project links live in one file (`src/shared/projectLinks.ts`)
- Themes Solarized and Tomorrow, each with a light and a dark face. Theme credits (origin, license, source) are kept in one list (`src/shared/themeAttribution.json`) that About and the third-party notices both read
- First-run AI step shows how the editor, the dictionary and the embedding model work together, and says when the model is already installed

### Changed
- Header: About is a plain button beside Help (it was inside the Help menu), and the appearance-mode toggle sits before the theme selector
- First-run AI step is redesigned around the purpose of the embedding model; the cloud AI heading is gone
- One UI font stack (`--font-ui`) is set once on `body` and everything inherits it; form controls follow it, section headings no longer use Inter, and the status bar and welcome text use the same face as the rest
- Warning and error text colors are darker on light backgrounds
- The tab duplicate button uses the shared icon set
- Ctrl+S in the editor runs File > Save, the same command as the menu, instead of clicking the SAVE button (which follows the AutoSave split); the stray Ctrl+S binding on the Save as Text action is gone
- Internal cleanup: removed the duplicate `sidebarResizer.js` and functions with no callers, and stopped loading the unused Inter web font

### Fixed
- Ctrl+S in the editor runs the same command as File > Save, instead of clicking the SAVE button (which follows the AutoSave split); the duplicate Ctrl+S binding on "Save as Text File" is removed

## [0.3.26] - 2026-10-22

### Added
- Appearance modes System, Light and Dark in the header, in Settings and in first-run setup; every theme has a light and a dark face; the Tukune theme
- Confirmation before closing tabs, toasts, modals and slots (a setting); a tab with unsaved changes always offers a choice dialog
- Log panel: the backlog and live lines merge by id, a Save Logs button, and a mirrored log view in Settings > System
- About shows the bundled license and third-party notices; embedding model licenses are verified before a download
- A version badge on the startup loader and a Windows app icon
- Settings for window features, including collapsing the logs

### Changed
- The Settings modal is restructured; tooltips across the UI are translatable
- The Windows package is smaller: other-OS onnxruntime binaries and superseded engine builds are left out, and the packaging guard checks a built `app.asar` for them
- 32 strings that were still English in the Japanese dictionary are translated

## [0.3.25] - 2026-10-21

### Added
- First-run setup in three steps (language and theme, save location, AI), with the tool name and version in the window's top-left corner, one typeface (Source Serif 4) throughout, and an (i) tip beside each heading that explains it on hover or focus
- Shared parts: step tabs with an arrow connector and a progress line (`stepTabs.js`), a toggle switch with OFF on the left and ON on the right (`toggleSwitch.js`), and an info tip (`infoTip.js`)
- Language switch (English left, Japanese right) and theme cards that draw a small editor sample from each theme file
- File format choice, Markdown (.md) or Text (.txt), in first-run setup and in Settings. The Markdown card shows its title as "## heading" and a Preview button shows the rendered view (the same renderer as the editor preview). The status bar shows the format of the current document and a click switches it; the Preview button is hidden for Text documents
- Save folder can be changed, renamed in place or reset; settings follow the folder. A folder name with a problem is explained beside the field and blocks "Next"
- First-run AI step names the vector inference model, its purpose, source and install location, and warns that search cannot run without it
- Gemini, OpenAI and Claude API keys are encrypted with the OS key store in the main process
- AutoSave has two triggers, a pause in typing (0.5 to 10 seconds, 1.5 by default) and each new line, with one master switch; the two triggers are folded under "Adjust each" and set in first-run setup
- A "Custom" theme card in first-run setup: it overrides the editor background and text color, and choosing a theme returns them to the theme's own
- Embedding model picker in Settings: 50 models with language fit, license, dimension, language-count and task filters, five sort orders and search. The model data lives in one registry (`src/shared/embeddingRegistry.json`) and the rules in `src/shared/embeddingCatalog.ts`. Only models with verified query/passage prefixes can be downloaded or used; the others are listed for comparison. A chosen model whose files are not on the device is shown as "Selected, not installed" with a Download button

### Changed
- The default Gemini model is `gemini-3.1-flash-lite`, the chat model badge follows the chosen model, and the retired Claude models are replaced; only text blocks of a Claude reply are read
- The header app title uses a serif face
- The built-in save folder is now `Documents/VectOrEdit` (was `VectOrFoldEr`); the old folder is not looked at or moved
- "Change location" now picks the place for the save folder and keeps its name; the name is changed in its own field
- The embedding model starts switched on in first-run setup and is installed in the background after the last button is pressed. The setup installs the default model only (e5-small); Settings still lists the others. With the model off the last button reads "Start without the model"
- New documents, their file names, the save dialog and AutoSave file names follow the chosen format
- The step bar's Back and Next buttons name the step they lead to (a small caption over the step name)
- The setup dialog keeps one height on every step and in every language and sits clear of the title bar
- The Markdown format sample shows a heading 1 and a heading 2 above the list, so the preview shows what headings look like
- The welcome text now explains how to try the editor, what the first-run setup set, what the areas of the window do, the difference between the LLM and the embedding model, and what to do when something fails
- Renderer runs sandboxed; IPC accepts calls only from the app's own page; permissions other than clipboard are denied
- CSP no longer allows `unsafe-eval` or inline scripts
- Renderer console output appears in the log panel with its own source and level
- The "setup completed" flag is kept per installation and is no longer restored from `.settings.json`

### Fixed
- The AUTO button works again; AutoSave is switched from the save menu
- Plain-text API keys from older versions are moved into the encrypted store and removed from `.settings.json`
- Swapping the welcome text for another language no longer marks the tab dirty
- The worker build resolves `.js` imports of `.ts` files, so `worker.js` can import `embeddingModels.js` and the app builds again
- A language change swaps the welcome text only while it is an unedited copy, so text the user typed (or saved and reopened) is never replaced
- The welcome text describes the save button, the AutoSave menu, the menu bar and the pipeline lights as they work
- The page background and the log panel follow the light theme
- Settings, AI MODEL: the Embedding, LLM and Capability scope tabs are back, so the LLM keys and the capability table can be reached and left again
- Settings: the Claude model choice, the real-time validation switch, the minimum score and the result limit are saved and applied
- Model size is no longer written into labels (it said 45 MB; the file is about 118 MB)

### Removed
- The AI Direct command bar of the log panel
- The "Skip setup" button of first-run setup (every step already has defaults, so Next all the way is a valid setup)
- Gemini-specific key IPC channels (replaced by the provider-generic `saveApiKey`, `hasApiKey` and `clearApiKey`)

## [0.3.24] - 2026-10-19

### Added
- Rendered Markdown preview with a toggle in the status bar (`marked` + `DOMPurify`)
- Type scale tokens `--fs-9` to `--fs-28`; control height tokens; cursor roles; themed drop-down for native selects
- Save button split into a save part and a menu toggle; autosave indicator with reserved width
- Startup loader with a light-band animation and a hard timeout

### Changed
- Literal font sizes in CSS, HTML and renderer code now come from the type scale
- Guidelines and Knowledge sections each have one "Add files" button instead of two paired buttons
- Tabs are written through `tabCommit` and marked clean only after the write is confirmed

### Removed
- Diff view (`editorDiffMode.js`)
- Markdown copy and paste buttons, the LLM on/off button in the dock, and the embedder path input

### Fixed
- Main-process logger no longer keeps retrying sends after the renderer is gone
- The context menu opened by the first right click no longer disappears after about 350 ms
- Monaco text inherits the selected font family

## [0.3.23] - 2026-10-01

### Fixed
- KB slots accepted only a top-level JSON array; Generate's compiled payload (`{domain, entities}`, also inside `.venc`) and schema v2 (`{concepts}`) loaded as 0 items without error → `normalizeKbPayload()`
- Profile files were never passed to the Rust linter (`engine.loadProfile` unused) → `pushProfileToEngine()`
- Vector search with a mismatched embedder (LLM / cloud vs e5-small KB) returned meaningless scores → engine `DimensionMismatch` mapped to `{ code: DIMENSION_MISMATCH, fallback: 'P.scan' }`; renderer falls back to dictionary results

### Removed
- `resolveReferencePathForKb()` (contradicted ADR-0005: Reference = `labels[].provenance`, not a separate file)

## [0.3.22] - 2026-09-20

### Added
- Placeholder for new features.

## [0.3.21] - 2026-09-14

### Added
- **Deep Module About Modal (boutModalController.ts & ppHeader.html)**:
  - Implemented AboutModalController with a minimal public API (showAboutModal, hideAboutModal) and deep internal implementation (DOM caching, responsive layout, safe external link opening).
  - Made application logo and version pill in the top header clickable to display the About modal.
- **Multilingual Initial Document Setup (n.json, ja.json, 	abState.js)**:
  - Added localized initial document guidance text dynamically populated into new tabs on launch and responsive to language toggle.

### Changed
- **Branding & Packaging Alignment**:
  - Updated package.json build ppId to com.vectoredit.app and author to ect-organization.
  - Updated application user model ID in src/main/index.ts to com.vectoredit.app.
  - Updated documentation repository links in menuBarController.ts to https://github.com/vect-organization/vect-or-edit.
- **AutoSave & Save UX (Plan A - utoSaveManager.js)**:
  - Differentiated unsaved new files (Doc-1.md) with amber LED indicator and SAVE prompt guiding users to Ctrl+S / Save As.
  - Retained emerald LED and AUTO background saving for existing files with valid filesystem paths.
- **UI & Settings Feedback (header-extras.css)**:
  - Harmonized settings gear icons with muted slate appearance and interactive amber hover with smooth rotation.

## [0.3.20] - 2026-09-12

### Added

- **Dual-Model AI Setup Modal Architecture (`aiSetupModal.html` / `aiSetupController.js`)**:
  - Re-architected startup AI configuration dialog into two independent, unbundled sections:
    1. **Embedding Model Setup**: Local HNSW vector models (`multilingual-e5-small`, `bge-small-en`, `nomic-embed-text`), Cloud API, or exact-match only (no embedding).
    2. **LLM Model Setup**: Cloud LLM provider configuration (Gemini Flash, OpenAI GPT-4o mini, Anthropic Claude v3) with masked API key input and visibility toggle.
  - Scaled up dialog dimensions (`860px` width, `90vh` max-height, `42px` input heights) and enhanced typography/layout to adapt cleanly to standard desktop windows.
  - Aligned action buttons with intuitive flow: "Configure Later" (`btn_ai_setup_later`) and "Download" / "Save & Start" (`btn_download_start` / `btn_save_start`).

### Changed

- **Monaco Placeholder Guide Card (`editorPlaceholder.js`)**:
  - Transformed the plain inline placeholder text into a distinct, elevated floating guide card with subtle backdrop styling and left margin offset (`left: 62px`), eliminating confusion with line 1 editor text.
  - Pre-bound initial locale dictionary to `i18n` on module evaluation to eliminate unlocalized raw translation key flashes (`placeholder_hint`).
- **Tooltip Positioning Ergonomics (`header.css`)**:
  - Increased `[data-instant-tooltip]` hover offset to `calc(100% + 14px)` to avoid cursor pointer obstruction.

### Fixed

- **Strict English-based Coding & Fallback Invariant**:
  - Replaced all hardcoded Japanese string fallbacks across controller scripts and modal HTML templates with standard English literals, delegating all localization strictly to `ja.json` / `en.json` dictionaries.

## [0.3.19] - 2026-09-11

### Added

- **Portable & NSIS Package Engine Bundling (`5. RUST`)**:
  - Added `extraResources` in `package.json` to bundle `vect-or-engine` native `.node` binaries directly under `resources/vect-or-engine/`.
  - Added prioritized resolution paths (`process.resourcesPath + '/vect-or-engine/...'`) in `rustEngine.ts`, ensuring 100% reliable Rust N-API binding in both portable (`.exe`) and NSIS installer environments.
- **Deep Status & Diagnostic Architecture (`statusManager.ts`)**:
  - Redesigned subsystem status semantics into 4 strict states: `ready` (Emerald `#1b8`), `loading` (Amber `#fbbf24`), `standby` (Slate `#64748b`), and `error` (Red `#ef4444`).
  - Prevented error masking where failed or unconnected states were ambiguously displayed as pending yellow.
  - Required subsystems (`CONFIG`, `THEME`, `LOCALE`, `EDITOR`, `RUST`) immediately trigger Alert Red on failure or IPC disconnect.
- **Fast-Path Locale Bootstrap (`3. LOCALE`)**:
  - Moved `loadLocales()` to the very beginning of the `DOMContentLoaded` lifecycle, ensuring immediate locale dictionary application (`ja.json`) and instant green Ready status.
  - Added protection guards in `initAllLedTooltips()` to prevent overwriting active Ready states during initialization.

## [0.3.18] - 2026-09-11

### Added

- **Packaged Rust N-API Engine Binding Resolution**:
  - Expanded candidate engine path resolution in `rustEngine.ts` to include `vect-or-engine-v0.3.0.win32-x64-msvc.node` unpacked ASAR resources.
  - Enabled 100% offline Rust HNSW indexing and validation in both portable and NSIS installer packages.
- **Pipeline LED Meter Stability & Color Semantics**:
  - Re-mapped status colors: Amber (`#fbbf24`) for pending/loading standby and Red (`#ef4444`) exclusively for errors.
  - Resolved `3. LOCALE` status persistence during runtime language toggles by retaining exact subsystem states in `statusManager.ts`.
- **Streamlined Monaco Editor Placeholder UI**:
  - Redesigned new document guidance list to align directly with line numbers at the top of the canvas, removing oversized dashed borders.
  - Cleaned up bilingual hint strings in `ja.json` and `en.json` for concise localized guidance.

## [0.3.17] - 2026-09-11

### Added

- **AI Toolbar Toggle Logic & Multi-Provider Settings**:
  - Connected Sidebar Embedding Toggle with central AI Master Switch and ONNX/Transformers.js models.
  - Implemented secure API Key visibility toggles with password masking for Gemini, OpenAI, and Anthropic Claude keys.
  - Added dedicated Clear API Keys action with customizable confirmation modal dialogues.
- **Unified Custom Confirmation Modals**:
  - Added `confirmModal.ts` to replace browser default `confirm()` prompts with theme-integrated, non-blocking modal dialogs.
  - Provided full keyboard navigation (Enter to confirm, Escape to cancel) and focus-trap accessibility.
- **Localization & Style Refinements**:
  - Added complete bilingual (en / ja) i18n keys for confirmation dialogs, modal tooltips, and API key management.
  - Refined modal animation curves, backdrop blur, toast alerts, and ticker styles.

## [0.3.16] - 2026-09-11

### Added

- **Sidebar Embedding Toggle & Settings Gear (Unified UI/UX)**:
  - Aligned the top action group to the right in the Suggestion Sidebar: `[ ● 🧠 EMBED OFF ] | [ ⚙️ ]`.
  - Matched Editor AI button UI/UX with identical `.ai-chip-pill` style, LED state dot (emerald green/red), and auto-master activation logic.
  - Added dedicated Settings Gear icon on sidebar for direct navigation to Knowledge & Vector settings.
  - Added comprehensive hover tooltips to all sidebar modules, slot loaders, preset buttons, and search filters.
- **Improved Knowledge Base Count Display**:
  - Sanitized i18n label fallback for items count in slot display.

## [0.3.15] - 2026-09-11

### Added

- **Streamlined Editor Toolbar & Integrated Typography**:
  - Slimmed save action into `[💾 AUTO ● ▾]` with decoupled instant-save button and LED-dot click toggle for AutoSave.
  - Unified editor styling into `[BG/FG | FONT | SIZE]` grouping, replacing legacy TONE terminology with intuitive Background/Foreground color themes.
  - Added dedicated duplicate document tab button (`+`) and inline new tab action.
- **Enhanced Multi-Document Tab Renaming & Persistence**:
  - Improved tab double-click rename input with high-contrast, glowing overlay ensuring no text truncation.
  - Automatically persists renamed document titles to local autosave cache.

## [0.3.14] - 2026-09-11

### Added

- **Interactive Header Zoom Badge & Wheel Scaling**:
  - Replaced legacy separate zoom buttons with an integrated `🔍 100%` badge in the header toolbar.
  - Added vertical mouse wheel scroll listener for smooth scaling between 50% and 200%.
  - Added single-click trigger to immediately reset UI scale to 100%.
  - Added global <kbd>Ctrl</kbd> + Mouse Wheel scaling support.
- **Header Navigation & Control Hover Tooltips**:
  - Added informative hover tooltips across the App Header (Logo, Menus, Theme Selector, Language Toggle, Settings, and Zoom Badge).

## [0.3.13] - 2026-09-11

### Added

- **Master Settings & UI Visibility Architecture**:
  - Implemented `data-ui="{area}:{element}"` binding schema across all 4 quadrants (`hdr:`, `edt:`, `sbr:`, `sys:`).
  - Added dynamic 👁️ / 🚫 element show/hide toggles with instant CSS-level reflection (`[hidden]`).
  - Added dual-sync persistence with `localStorage` and `.settings.json`.
  - Added dual safety rescue mechanism (<kbd>Ctrl</kbd>+<kbd>,</kbd> and status bar reset layout command).
  - Added quick settings gear buttons across all UI quadrants.

## [0.3.12] - 2026-09-10

feat: Add header extras styles and refactor menu bar controller

- Introduced a new CSS file for header extras, consolidating styles for header toolbar components, action buttons, theme selector, language toggle, and zoom controls.
- Enhanced header.css with additional styles for branding, window controls, and improved version text display.
- Updated style.css to import the new header-extras.css.
- Refactored menuBarController.ts to register application commands with a centralized CommandManager, simplifying the handling of menu actions and improving code maintainability.
- Removed old event listeners and replaced them with command registration for better scalability and organization.
-

---

## [0.3.11] - 2026-09-10

### Added

- (TODO: describe changes for v0.3.11)

---

## [0.3.10] - 2026-09-09

### Added

- (TODO: describe changes for v0.3.10)

---

## [0.3.9] - 2026-09-09

### Added

- (TODO: describe changes for v0.3.9)

---

## [0.3.8] - 2026-09-10

### Security

- Hardened IPC channel validation (placeholder).
- Updated Electron to 28.0.0 with security patches (placeholder).

---

## [0.3.7] - 2026-09-08

### Added

- Added multilingual i18n support for toolbar tooltips (placeholder).
- New shortcut for duplicating tabs (placeholder).

---
## [0.3.6] - 2026-09-08

### Fixed

- Resolved occasional UI flicker on tab duplication (placeholder).
- Patched memory leak in renderer process (placeholder).

### Added

- (TODO: describe changes for v0.3.9)

---

## [0.3.10] - 2026-09-09

### Added

- (TODO: describe changes for v0.3.10)

---

## [0.3.7] - 2026-09-08

### Added

- Added multilingual i18n support for toolbar tooltips (placeholder).
- New shortcut for duplicating tabs (placeholder).

---

## [0.3.6] - 2026-09-08

### Fixed

- Resolved occasional UI flicker on tab duplication (placeholder).
- Patched memory leak in renderer process (placeholder).

---

## [0.3.5] - 2026-09-08

### Changed

- Refactored settings modal interaction flow (placeholder).
- Improved performance of background indexing (placeholder).

---

## [0.3.4] - 2026-09-08

### Added

- Implemented new vector search UI enhancements (placeholder).
- Integrated updated Gemini generation provider (placeholder).

---

## [0.3.3] - 2026-09-07

### Security & Electron Hardening

- **Context Bridge IPC Encapsulation**: Removed raw `ipcRenderer.invoke` exposure (`electronAPI`) in preload script to prevent arbitrary IPC invocation from renderer. Introduced strongly-typed, channel-safe `engineAPI.querySemantics` bridge matching official Electron security guidelines.
- **IPC Handler Validation**: Added input argument type checks (`isRecord`) and structured error boundaries in main process `engine:query-semantics` handler.
- **macOS Window Recreation**: Implemented `app.on('activate')` window lifecycle event handler to restore BrowserWindow when clicking dock icon with zero open windows.

### Architecture & Domain Boundary Separation

- **100% Generic Desktop Editor**: Decoupled domain-specific medical ontologies and psychiatric EHR drafting presets from core editor. Transferred clinical seam adapters (`clinicalDocumentSeam`, `clinicalDocumentAdapter`, test suites) to external domain repository (`sangen/dev/vect-or-edit/`).
- **Generic Icon System**: Reverted hardcoded medical/clinical SVG glyphs in `icons.ts` back to clean, domain-neutral editor iconography.
- **Search Pipeline Neutrality**: Cleaned up hardcoded medical keyword heuristics in `searchUi.js` and `dictionary.js` to support arbitrary multi-domain vector knowledge bases.

### UI & Styling Fixes

- **Modal & Toast Layout Fix**: Removed unconstrained `100%` width/height expansion rules in `buttons.css` and `utilities.css` that caused UI inflation in dynamic modal dialogs and notification toasts.

---

## [0.3.2] - 2026-09-03

### Added & Changed

- **Deep Module Architecture**: Refactored `searchLocalAi.js` with idempotent worker management and `requestId`-based message routing to eliminate request collision, listener accumulation, and infinite event loops.
- **Project Structure Optimization**: Consolidated test suites under `tests/`, removed legacy duplicate `.js` files, and streamlined TypeScript renderer imports.
- **SDK & Dependency Updates**: Upgraded `@google/genai` to `2.21.0` with full type verification.

---

## [0.3.1] - 2026-08-30

### Added & Changed

- **Unified AI Toggles**: Seamless styling and state synchronization for `SUGGEST AI` toggles between the Editor Header and Sidebar.
- **Smart Suggestion Layout**: Auto-collapsing "Guideline" and "Knowledge" modules during Vector Search to maximize suggestion visibility.
- **Refined Settings & UI**: Removed legacy positioning settings, unified English fallbacks (e.g., `OFFLINE`, `CLOUD`), and added missing translation keys.
