# Changelog

All notable changes to the **VectOrEditOr** (`vect-or-edit`) desktop application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
