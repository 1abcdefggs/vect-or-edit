# VectOrEdit (`vect-or-edit`)
 **Next-Generation Vector-based Semantic Knowledge Editor & Real-Time Linter**

[![Release](https://img.shields.io/badge/Release-v0.3.14-2563eb?style=flat&logo=github)](https://github.com/1abcdefggs/vect-or-edit/releases)
[![Author](https://img.shields.io/badge/Author-1abcdefggs-1e293b?style=flat&logo=github)](https://github.com/1abcdefggs)
[![License: MIT](https://img.shields.io/badge/License-MIT-334155?style=flat)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows_10%2F11-0284c7?style=flat&logo=windows)](https://github.com/1abcdefggs/vect-or-edit)
[![Offline](https://img.shields.io/badge/Mode-100%25_Offline_Local-059669?style=flat)](https://github.com/1abcdefggs/vect-or-edit)
[![Electron](https://img.shields.io/badge/Electron-31.x-334155?style=flat&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-0.56-334155?style=flat&logo=visualstudiocode&logoColor=white)](https://microsoft.github.io/monaco-editor/)
[![Vite](https://img.shields.io/badge/Vite-5.x-334155?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-334155?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Rust N-API](https://img.shields.io/badge/Rust-N--API_Engine-334155?style=flat&logo=rust&logoColor=white)](https://napi.rs/)
[![ONNX Runtime Web](https://img.shields.io/badge/ONNX-WASM-334155?style=flat&logo=onnx&logoColor=white)](https://onnxruntime.ai/)
[![Transformers.js](https://img.shields.io/badge/Transformers.js-Embeddings-334155?style=flat)](https://huggingface.co/docs/transformers.js)
[![Google GenAI SDK](https://img.shields.io/badge/Google_GenAI_SDK-2.21-334155?style=flat&logo=google&logoColor=white)](https://github.com/googleapis/genai-js)
[![Vitest](https://img.shields.io/badge/Tested_with-Vitest-334155?style=flat&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-334155?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-1e293b?style=flat)](https://github.com/1abcdefggs/vect-or-edit/pulls)
<p align="center">
<p align="center"><b>v0.3.14</b><br/>
  <img src="docs/assets/repository-ui-v0312.gif" alt="VectOrEditOr v0.3.14 Demo" ... />
</p>

<p align="center"><b>v0.3.1</b><br/>
  <img src="docs/assets/repository-ui-v031.gif" alt="VectOrEditOr v0.3.1 Demo" ... />
</p>


**VectOrEdit** is a standalone, high-performance desktop editor designed for knowledge management, structured document drafting, and real-time semantic validation. It seamlessly integrates a native Rust-powered vector indexing engine (HNSW) with local transformer embeddings, multi-provider AI connectors, and Monaco Editor.

---

## User Guide & Core Workflows

### 1. Vector Search & Semantic Suggestions

- **Selection Auto-Popover**: Select any word or phrase in the editor; a popover automatically appears below the cursor showing cosine-similarity matches from the active knowledge base (`kb_*.json` / `.venc`).
- **Keyboard Trigger**: Press <kbd>Alt</kbd>+<kbd>S</kbd> (or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>) on the current word or selection to query the vector engine.
- **Insert Candidate**: Click any suggested term in the popover or sidebar to replace the selection with standard canonical terminology.

### 2. Knowledge Slots & Guideline Management (Right Sidebar)

- **Open / Collapse Sidebar**: Press <kbd>Ctrl</kbd>+<kbd>B</kbd> or click the blue sidebar toggle button on the top-left of the sidebar.
- **Embedding Toggle & Quick Settings**: Click **`[ ● EMBED OFF ]`** on the top-right of the sidebar to toggle real-time semantic vector assistance (synchronized with Master AI), or click the gear icon (**`⚙️`**) to open Vector and Knowledge settings.
- **Add Knowledge Slot**: Click **`＋ Add`** in the Knowledge section to dynamically load and merge domain JSON datasets (`medical/`, `drama/`, `postcard/`, etc.).
- **Load Presets / Guidelines**: Click **`＋ Preset`** to load drafting rules and linting schemas (`guideline_*.json`).
- **Filter Thresholds**: Adjust the **`Min: %`** score input and **`Limit`** selector in the sidebar to control suggestion precision and candidate volume.

### 3. Settings & UI Customization

- **Open Settings**: Press <kbd>Ctrl</kbd>+<kbd>,</kbd> or click the gear icon (`⚙️`) in the header or area toolbars.
- **Granular UI Visibility**: In the Settings modal, click the eye icon (**`👁️` / `🚫`**) next to any UI item to instantly show or hide that button/menu on the main interface.
- **Reset Layout**: If essential controls are hidden, right-click the bottom status bar or editor margin and select **`Reset Layout (UI Display)`** to restore all defaults.

### 4. File Operations & Multi-Tab Drafting

- **New / Open / Save**: Use standard shortcuts (<kbd>Ctrl</kbd>+<kbd>N</kbd>, <kbd>Ctrl</kbd>+<kbd>O</kbd>, <kbd>Ctrl</kbd>+<kbd>S</kbd>) or the top menu bar.
- **AutoSave**: Click the green/gray LED dot in the `[💾 AUTO ● ▾]` button to toggle AutoSave on or off.
- **Duplicate Tab**: Click the duplicate icon (`+`) on the tab bar to branch your current document into a new tab.
- **Rename Tab**: Double-click any tab title to rename it with an instant high-contrast overlay input.

---

## What's New

### v0.3.13　- **Master Settings & UI Visibility Architecture**

  - Implemented `data-ui="{area}:{element}"` binding schema across all 4 quadrants (`hdr:`, `edt:`, `sbr:`, `sys:`).
  - Added dynamic 👁️ / 🚫 element show/hide toggles with instant CSS-level reflection (`[hidden]`).
  - Added dual-sync persistence with `localStorage` and `.settings.json`.
  - Added dual safety rescue mechanism (<kbd>Ctrl</kbd>+<kbd>,</kbd> and status bar reset layout command).
  - Added quick settings gear buttons across all UI quadrants.

### v0.3.12

- **Header Extras & Menu Bar Refactoring**:
- Refactored menu bar operations to use a centralized command registration mechanism via `CommandManager`. 
- Consolidated and enhanced styling for header toolbar elements (theme selector, language switcher, zoom controls, version display, etc.) in `header-extras.css`.
- **IPC Security & Validation Hardening**:
- Implemented runtime argument validation for IPC handlers in the main process and ensured complete isolation via the Context Bridge.
- **Vector Search & Provider Enhancements**:
- Improved usability of the vector search UI and stabilized integration with the Google GenAI SDK (`@google/genai`).
- **Domain-Neutral Core**:
- Decoupled the core to function as a general-purpose, standalone vector knowledge editor that does not rely on domain-specific ontologies (e.g., medical).

See full release history in [CHANGELOG.md](CHANGELOG.md).

## Core Features & Capabilities

- **Registry-Driven Settings & UI Visibility Binding**: Fully synchronized preferences and layout visibility via `data-ui="{area}:{element}"` architecture, allowing granular element show/hide toggles with instant CSS-level reflection and zero-overhead state persistence (`.settings.json`).

- **Native Rust HNSW Engine**: Blazing-fast vector similarity search and semantic linting powered by native Rust N-API bindings (`@1abcdefggs/vect-or-engine`).
- **100% Offline & Private (Local Mode)**: Zero external telemetry required. Vector embeddings (`multilingual-e5-small`) run entirely locally on CPU with WebAssembly SIMD & ONNX Runtime.
- **Hybrid AI Provider Integration**: Seamless switching between Local Offline Embeddings, Google Gemini (`@google/genai`), OpenAI, and Anthropic Claude.
- **Monaco IntelliSense & Semantic Linter**: Multi-dimensional auto-completion matching Kanji, Hiragana, Katakana, and international terminology with instant documentation hover previews.
- **Command-Driven Navigation & Header Extras**: Centralized `CommandManager` architecture with streamlined header controls (theme selector, zoom, language switcher, window actions).
- **Streamlined Selection Popover & Widget**: Select any text to immediately trigger semantic vector matching or external queries with intelligent context-menu exclusion.
- **Dynamic Multi-Slot Knowledge & Presets**: Load, merge, and inspect multiple domain JSON slots (`kb_*.json`) or drafting templates dynamically.
- **Curated Modern Themes & Windows TitleBar Overlay**: Bundled with `Dracula`, `GitHub Dark`, `GitHub Light`, `Monokai`, `Night Owl`, syncing with Windows native control buttons.
- **Dynamic Bilingual UI (i18n)**: Seamless English & Japanese live switching without restart.
- **Real-Time Diagnostic Pipeline**: 7-stage LED status indicators monitoring Rust DLL, Knowledge Base, Config, Theme, Locale, Monaco, and AI Engine.


---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Rust](https://www.rust-lang.org/) & `cargo` (for compiling native N-API engine bindings)
- `npm` or `pnpm`

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/1abcdefggs/vect-or-edit.git
cd vect-or-edit

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Testing & Quality Assurance

```bash
# Run automated test suites (Vitest)
npm run test

# Type checking across main, preload, and renderer
npm run typecheck
```

### Building for Production & Windows `.exe`

```bash
# Compile and build standalone bundle
npm run build

# Package Windows Standalone Installer (.exe) & Portable Executable
npm run build:win
```

---

## Security Architecture & Dual-Lock Spec

`vect-or-edit` follows the official **Electron Security Guidelines**:
- **Context Isolation & Sandbox**: Renderer runs with complete process isolation.
- **Typed IPC Bridge**: Direct `ipcRenderer.invoke` is strictly prohibited. Only explicit, typed methods (`engineAPI.querySemantics`) are exposed via `contextBridge`.
- **Knowledge Vault & Decryption**: Complies with the system-wide [Security and Encryption Architecture Specification](file:///c:/VectOrEditOr-dev/docs/domain-and-pipeline-rules/SECURITY_AND_ENCRYPTION_ARCHITECTURE_SPEC.md).


---

## UI Architecture & Element Binding Standard

`vect-or-edit` employs a declarative, zero-UI-framework binding architecture to manage top-page controls and settings modal synchronization:

- **Strict Area Scoping (`data-ui`)**: Every customizable UI component is tagged with a standardized 4-quadrant area scope:
  - `hdr:` — **Header & TitleBar Area** (Logo, menus, theme/locale selectors, settings button)
  - `edt:` — **Editor & Toolbar Area** (Monaco typography, diff mode, inline AI toggles)
  - `sbr:` — **Knowledge Sidebar Area** (Vector search input, similarity thresholds, metadata views)
  - `sys:` — **System & Bottom Bar Area** (Status metadata, 7-stage LED pipeline, log console)
- **Zero-DOM-Destruction Toggling**: Elements are toggled using native `[hidden]` CSS enforcement (`display: none !important;`), preserving editor focus, undo history, and event listeners without re-rendering.
- **Dual-Sync Persistence**: Fast memory caching (`localStorage`) coupled with asynchronous IPC `.settings.json` disk persistence for seamless VS Code-compatible settings management.
- **Fail-Safe Rescue**: Permanent fallback access via global keybinding (<kbd>Ctrl</kbd>+<kbd>,</kbd>) and status bar context menus ("Reset Layout to Default").

---

## Project Architecture

```text
vect-or-edit/
├── electron.vite.config.ts      # Electron-Vite bundling configuration
├── vitest.config.ts             # Vitest test runner configuration
├── package.json                 # Project dependencies & scripts
├── scripts/                     # Build & maintenance scripts
├── public/                      # Static assets (icon.png, icon.ico, IME dicts)
├── docs/                        # Architecture & settings specifications
├── tests/                       # Automated test suites
└── src/
    ├── main/                    # Electron Main process (IPC handlers, Window management)
    ├── preload/                 # Secure Context-Isolated IPC bridge
    └── renderer/                # Front-end UI (TypeScript/CSS, Monaco, Web Workers)
        ├── renderer.ts          # Front-end main entry point
        ├── index.html           # Main HTML shell
        ├── style.css            # Root stylesheet imports
        ├── core/                # State managers (settingsStore, statusManager, i18n, icons)
        ├── components/          # Specialized UI templates & HTML modules
        ├── editor/              # Monaco editor core, tabs, themes, context menus
        ├── search/              # Vector search, local AI worker, dictionary pipeline
        ├── ui/                  # UI components, modals, topbar, settings facade
        ├── css/                 # Stylesheets (header.css, header-extras.css, etc.)
        ├── assets/              # App branding & static assets
        ├── locales/             # i18n dictionaries (en.json, ja.json)
        ├── themes/              # Monaco theme JSON definitions
        └── types/               # TypeScript type definitions (settings.ts, global.d.ts)

```
---

## Author & Maintainer

- **Author**: [@1abcdefggs](https://github.com/1abcdefggs)
- **Repository**: [https://github.com/1abcdefggs/vect-or-edit](https://github.com/1abcdefggs/vect-or-edit)
- **Issue Tracker**: [https://github.com/1abcdefggs/vect-or-edit/issues](https://github.com/1abcdefggs/vect-or-edit/issues)

---

## License

This project is licensed under the [MIT License](LICENSE) © 2026 1abcdefggs.
---
