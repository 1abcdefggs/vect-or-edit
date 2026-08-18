# VectOrEditOr (`vect-or-edit`)

> **Next-Generation Vector-based Semantic Knowledge Editor & Real-Time Linter**

<p align="center">
  <img src="docs/assets/repository-ui.png" alt="VectOrEditOr UI Preview" width="100%" style="border-radius: 8px;" />
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

- **⚡ Native Rust HNSW Engine**: Blazing-fast vector similarity search and validation via N-API native bindings.
- **🔒 100% Offline & Private (Local Mode)**: Zero external telemetry. Embeddings, vector search, and linting run entirely on your local machine using WebAssembly ONNX transformers upon user opt-in.
- **🤖 Dual AI Engine (Local & Claude API)**: Switch freely between 100% offline local embeddings and Anthropic Claude 3.5 (Sonnet / Haiku) for intelligent drafting and semantic suggestions.
- **🎨 Modern Dark UI & Native TitleBar Integration**: Pre-bundled with curated open-source themes (`Dracula`, `GitHub Dark`, `Monokai`, `Night Owl`) with seamless Windows `TitleBarOverlay` color synchronization.
- **🧩 Schema-Driven Multi-Slot Knowledge Base**: Dynamically load, combine, and inspect multiple domain JSON knowledge slots on-demand.
- **🌐 Full Dynamic Internationalization (i18n)**: Instant language switching (English / Japanese) without reloading.
- **📏 Real-Time Diagnostic Status Pipeline**: 7-stage runtime indicators monitoring Rust Binary, Knowledge Base, Config, Theme, Locale, Monaco Editor, and AI Model readiness.

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

> **Note on Local AI Embeddings**:
> On the first run, the lightweight multilingual embedding model (`multilingual-e5-small`, ~45MB) is automatically fetched in the background. After this one-time initial download, all vector search and linting operations run completely offline with zero network requests.

### Building for Production

```bash
# Build standalone bundle
npm run build
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
