# Changelog

All notable changes to the **VectOrEditOr** (`vect-or-edit`) desktop application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
