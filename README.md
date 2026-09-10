# VectOrEdit (`vect-or-edit`)

> **Next-Generation Vector-based Semantic Knowledge Editor & Real-Time Linter**

<p align="center"><b>v0.3.12</b><br/>
  <img src="docs/assets/repository-ui-v031.gif" alt="VectOrEditOr v0.3.12 Demo" ... />
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-31.x-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-0.56.0-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)](https://microsoft.github.io/monaco-editor/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Rust N-API](https://img.shields.io/badge/Rust-N--API_Engine-DEA584?style=flat-square&logo=rust&logoColor=black)](https://napi.rs/)
[![ONNX Runtime Web](https://img.shields.io/badge/ONNX-WebAssembly_WASM-005CED?style=flat-square&logo=onnx&logoColor=white)](https://onnxruntime.ai/)
[![HuggingFace Transformers](https://img.shields.io/badge/Transformers.js-Local_Embeddings-FFD21E?style=flat-square)](https://huggingface.co/docs/transformers.js)
[![Google GenAI SDK](https://img.shields.io/badge/Google_GenAI_SDK-2.21.0-4285F4?style=flat-square&logo=google&logoColor=white)](https://github.com/googleapis/genai-js)
[![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows_10%2F11-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/1abcdefggs/vect-or-edit)
[![100% Offline](https://img.shields.io/badge/Privacy-100%25_Offline_Local-success?style=flat-square&logo=privateinternetaccess&logoColor=white)](https://github.com/1abcdefggs/vect-or-edit)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=flat-square)](https://github.com/1abcdefggs/vect-or-edit/pulls)

**VectOrEdit** is a standalone, high-performance desktop editor designed for knowledge management, structured document drafting, and real-time semantic validation. It seamlessly integrates a native Rust-powered vector indexing engine (HNSW) with local transformer embeddings, multi-provider AI connectors, and Monaco Editor.

---

## Core Features & Capabilities

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

## What's New in v0.3.12

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

## Project Architecture

vect-or-edit/
├── electron.vite.config.ts # Electron-Vite bundling configuration
├── vitest.config.ts # Vitest test runner configuration
├── package.json # Project dependencies & scripts
├── scripts/ # Build & maintenance scripts
├── public/ # Static assets (icon.png, IME dicts)
├── docs/ # Architecture & settings specifications
├── tests/ # Automated test suites
└── src/
├── main/ # Electron Main process (IPC handlers, Window management)
├── preload/ # Secure Context-Isolated IPC bridge
└── renderer/ # Front-end UI (TypeScript/CSS, Monaco, Web Workers)
├── renderer.ts # Front-end main entry point
├── core/ # State managers (aiStateManager, statusManager, i18n, icons)
├── components/ # Specialized UI components & widgets
├── editor/ # Monaco editor core, tabs, themes, context menus
├── search/ # Vector search, local AI worker, dictionary pipeline
├── ui/ # UI components, modals, topbar, settings facade
├── css/ # Stylesheets (header.css, header-extras.css, etc.)
├── assets/ # App branding & static assets
├── locales/ # i18n dictionaries (en.json, ja.json)
├── themes/ # Monaco theme JSON definitions
└── types/ # TypeScript type definitions

---

## License

This project is licensed under the [MIT License](LICENSE).
