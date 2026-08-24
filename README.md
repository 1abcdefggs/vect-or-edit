# VectOrEditOr (`vect-or-edit`)

> **Next-Generation Vector-based Semantic Knowledge Editor & Real-Time Linter**

<p align="center">
  <img src="docs/assets/repository-ui-v020.gif" alt="VectOrEditOr v0.2.0 Demo" width="100%" style="border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);" />
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-31.x-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-0.56.0-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white)](https://microsoft.github.io/monaco-editor/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Rust N-API](https://img.shields.io/badge/Rust-N--API_Engine-DEA584?style=flat-square&logo=rust&logoColor=black)](https://napi.rs/)
[![ONNX Runtime Web](https://img.shields.io/badge/ONNX-WebAssembly_WASM-005CED?style=flat-square&logo=onnx&logoColor=white)](https://onnxruntime.ai/)
[![HuggingFace Transformers](https://img.shields.io/badge/%F0%9F%A4%97_Transformers.js-Local_Embeddings-FFD21E?style=flat-square)](https://huggingface.co/docs/transformers.js)
[![100% Offline](https://img.shields.io/badge/Privacy-100%25_Offline_Local-success?style=flat-square&logo=privateinternetaccess&logoColor=white)](https://github.com/1abcdefggs/vect-or-edit)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=flat-square)](https://github.com/1abcdefggs/vect-or-edit/pulls)

**VectOrEditOr** is a standalone, high-performance desktop editor designed for knowledge management, structured document drafting, and real-time semantic validation. It seamlessly integrates a native Rust-powered vector indexing engine (HNSW) with local transformer embeddings and Monaco Editor.

---

## ✨ Features

- **⚡ Native Rust HNSW Engine**: Blazing-fast vector similarity search and semantic linting via N-API native bindings.
- **🔒 100% Offline & Private (Local Mode)**: Zero external telemetry. Vector embeddings (`multilingual-e5-small`) run entirely locally on CPU with WebAssembly SIMD & ONNX Runtime.
- **⌨️ Monaco IntelliSense Integration**: Multi-dimensional auto-completion matching Kanji, Hiragana, Katakana, and classification codes (e.g., ICD-10) with instant docs preview.
- **🔍 Streamlined Selection Mini-Bar**: Select any text to immediately trigger semantic vector matching or external search with mutual context-menu exclusion.
- **🧩 Dynamic Multi-Slot Knowledge & Clinical Presets**: Load, merge, and inspect multiple domain JSON slots (`kb_*.json`) or clinical drafting templates (`preset_*.json`) dynamically.
- **🎨 Curated Modern Themes & Windows TitleBar Overlay**: Bundled with `Dracula`, `GitHub Dark`, `GitHub Light`, `Monokai`, `Night Owl`, syncing with Windows native control buttons.
- **🌐 Dynamic Bilingual UI (i18n)**: Seamless English & Japanese live switching without restart.
- **📏 Real-Time Diagnostic Pipeline**: 7-stage LED status indicators monitoring Rust DLL, Knowledge Base, Config, Theme, Locale, Monaco, and AI Engine.

---

## 🚀 Getting Started

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

### Building for Production & Windows `.exe`

```bash
# Compile and build standalone bundle
npm run build

# Package Windows Standalone Installer (.exe) & Portable Executable
npm run build:win
```

---

## 🛠️ Project Architecture

```
vect-or-edit/
├── Cargo.toml / lib.rs          # Rust N-API engine bindings
├── electron.vite.config.ts      # Electron-Vite bundling configuration
├── package.json                 # Project dependencies & scripts
├── public/                      # Static assets (icon.png, IME dicts)
├── docs/                        # Architecture & settings specifications
└── src/
    ├── main/                    # Electron Main process (IPC handlers, Window management)
    ├── preload/                 # Secure Context-Isolated IPC bridge
    └── renderer/                # Front-end UI (Vanilla JS/CSS, Monaco Editor, Web Workers)
        ├── assets/              # App branding & icons
        ├── locales/             # i18n dictionaries (en.json, ja.json)
        ├── themes/              # Monaco theme JSON definitions
        └── *.js / style.css     # Core UI managers (vectorSearch, statusManager, etc.)
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
