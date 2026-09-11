# Changelog

All notable changes to the **VectOrEditOr** (`vect-or-edit`) desktop application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
