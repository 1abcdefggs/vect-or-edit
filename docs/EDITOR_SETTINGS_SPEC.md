# VectOrEditOr (Editt) 完全設定・機能・アーキテクチャ仕様書

本書は、`VectOrEditOr (vect-or-edit)` に実装されているすべてのエディタ設定、UI/UX設計、Monaco/Rust連携、AI埋め込みモデル、i18n多言語化、テーマエンジン、IPCプロトコル、およびビルドツールチェーンを網羅した詳細仕様書です。

---

## 1. UI・エディタ外観設定

| 設定項目 | 選択肢 / 設定値 | 保存先 / 挙動 |
| :--- | :--- | :--- |
| **フォント（Font Family）** | ・`Serif` (明朝系: `Georgia, 'Times New Roman', Times, serif`)<br>・`Sans-serif` (ゴシック系: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`)<br>・`Monospace` (`monospace`) | Monaco Editor に即時反映 |
| **フォントサイズ（Font Size）** | ・`14px` (Small)<br>・`16px` (Normal・デフォルト)<br>・`18px` (Large)<br>・`20px` (XLarge) | Monaco Editor に即時反映 |
| **カラーテーマ（Theme）** | ・`Dracula`<br>・`GitHub Dark`<br>・`Monokai`<br>・`Night Owl` | `localStorage ('themeName')` 保存（次回起動時自動復元）<br>CSSカスタムプロパティ（`--bg-primary`, `--text-main` 等）とWindows タイトルバーへ動的反映 |
| **表示言語（Language）** | ・`JA` (日本語)<br>・`EN` (英語) | `localStorage ('app_lang')` 保存<br>`data-i18n` 属性によるDOMテキストおよびプレースホルダーの即時置換 |
| **設定モーダル（Application Settings）** | `⚙️` ボタン (`#btnSettings`) / モーダル (`#settingsModal`) | システム全体の環境設定をダイアログ形式で集約管理 |
| **ログ表示位置（Log Display Position）** | ・`Top (Header Bar)` (デフォルト)<br>・`Bottom (Console Panel)` | `localStorage ('logDisplayPosition')` 保存（次回起動時自動復元）<br>上部ティッカーバーと下部コンソールパネルの表示位置を排他・統合制御 |
| **リアルタイム実行ログティッカー** | 上部ストリームバー (`#liveLogTicker`) | **3段階開閉トグル**: 3行フル表示 ➔ 1行コンパクト表示 ➔ 完全折りたたみ<br>**自動縮小機能**: 起動時に3行で展開し、全7サブシステム初期化完了（全点灯）時に1.5秒で自動的に1行へコンパクト化（エラー時は開いたまま維持） |
| **7段階パイプラインステータスメーター** | 上部ティッカーバーヘッダー内 (`.system-status-panel`) | 処理フロー順序（左から右へ）を明示：<br>`1.RUST ▶ 2.HNSW ▶ 3.CONFIG ▶ 4.THEME ▶ 5.LOCALE ▶ 6.EDITOR ▶ 7.AI-MODEL`<br>・枠線のないクリーンなボーダーレスデザイン<br>・各ステージの待機（シアンパルス点滅）/ 完了（シアン・エメラルド点灯）を表示 |
| **ツールバー / エディタ操作ボタン** | ・開く (`#btnOpen` / <kbd>Ctrl</kbd>+<kbd>O</kbd> / Drag&Drop)<br>・保存 (`#btnSave` / <kbd>Ctrl</kbd>+<kbd>S</kbd>)<br>・辞書インポート (`#btnImportDict`)<br>・言語切替 (`#btnLangToggle`)<br>・ログコンソール開閉 (`#btnToggleConsole`)<br>・設定モーダル (`#btnSettings`) | ツールバー及びエディタヘッダーから直接ワンクリック操作可能 |
| **エディタステータスバー** | 下部情報バー (`#editorStatusBar`) | ファイル名、リアルタイム文字数（`chars`）、行数（`lines`）、エンコーディング（`UTF-8`）、言語（`Markdown`）を表示 |
| **類似度・件数フィルター** | 最小類似度 (`#numMinScore`: 50%〜99%)<br>上限件数 (`#selSearchLimit`: 5 / 10 / 20) | ノイズを排除するスコアしきい値フィルタリングおよび取得件数の動的指定 |
| **全メタデータ表示切替** | `☑ 全メタデータ/属性を展開表示` (`#chkShowFullMetadata`) | `localStorage ('vect_show_full_metadata')` 保存<br>国際標準スキーマ（`metadata` 内の全属性）のキーバリュー自動展開・一覧表示の切替 |
| **下部システムログコンソール** | 下部スライドアップ式パネル (`#systemLogPanel`) | 設定で `Bottom` を選択時または `Logs` ボタンクリック時に下部に展開 (`Clear` / `Copy` 機能完備) |
| **ウィンドウ安全マージン** | `padding: 0 145px 0 16px;` | Windows ネイティブの閉じる・最小化ボタンとの干渉を防止する安全領域 |

---

## 2. テーマエンジン & タイトルバー動的連動 (`themeLoader.js` / `themes/*.json`)

* **テーマ一覧と配色スタイル**:
  * `Night Owl`: `vs-dark` / 背景 `#011627` / 前景 `#d6deeb`
  * `Dracula`: `vs-dark` / 背景 `#282a36` / 前景 `#f8f8f2`
  * `GitHub Dark`: `vs-dark` / 背景 `#24292e` / 前景 `#e1e4e8`
  * `Monokai`: `vs-dark` / 背景 `#272822` / 前景 `#f8f8f2`
* **自動検出・ロード**: Vite の `import.meta.glob('./themes/*.json', { eager: true })` により、テーマ JSON ファイルを自動スキャン・登録。
* **CSS 変数マッピング**: テーマ JSON の `colors` プロパティ（`editor.background`, `sideBar.background`, `editor.foreground`, `titleBar.activeBackground` 等）をルートの CSS 変数（`--bg-secondary`, `--text-main`, `--accent-color` 等）へ即時注入。
* **Windows タイトルバー連動 (TitleBarOverlay)**:
  * テーマの背景色から輝度（Luminance: `0.299*R + 0.587*G + 0.114*B`）を自動計算。
  * 背景が明るい場合はシンボル色を `#111111`、暗い場合は `#ffffff` に自動設定し、OS ネイティブの閉じる・最小化ボタン色を更新。
  * メモ化（キャッシュ）により、重複する IPC 呼び出しを抑止。

---

## 3. 国際化・多言語化システム (`i18n.js` / `locales/*.json`)

* **ロケール判定優先順位**:
  1. `localStorage.getItem('app_lang')`
  2. ブラウザ / システム言語 (`navigator.language`)
  3. フォールバック: `en` (英語)
* **テンプレート置換 (`t(key, params)`)**: `{{ param }}` 形式のプレースホルダーを動的展開（例: `loadMoreLabel: "さらに {{hiddenCount}} 件表示..."`）。
* **DOM 反映 (`applyI18n`)**: `[data-i18n]` 属性を持つ要素の `textContent` および `<input>`/`<textarea>` の `placeholder` を一括更新。

---

## 4. Monaco Editor 内部エンジン設定 & 機能一覧 (`editorManager.js`)

### 4.1 現在有効化・実装されている機能

| パラメータ / 機能 | 設定値 / 状態 | 説明 / 操作 |
| :--- | :--- | :--- |
| **言語モード (`language`)** | `'markdown'` | マークダウン記法のシンタックスハイライト |
| **自動折り返し (`wordWrap`)** | `'on'` | エディタ幅に応じたテキストの自動折り返し |
| **ミニマップ (`minimap`)** | `{ enabled: false }` | ミニマップ非表示でテキスト編集領域を最大化 |
| **行番号幅 (`lineNumbersMinChars`)** | `3` | 行番号エリアの表示幅（3桁） |
| **カーソル行強調 (`renderLineHighlight`)** | `'line'` | 現在カーソルが存在する行のハイライト表示 |
| **自動リサイズ (`automaticLayout`)** | `true` | ウィンドウやサイドバー開閉時に自動リサイズ追従 |
| **専門用語インライン補完** | `registerCompletionItemProvider` | ナレッジベースの病名・標準用語を文字入力中に候補一覧としてポップアップ補完 |
| **差分比較エディタ (`Diff Editor`)** | Monaco Diff Editor 連携 | 原本と修正版の2画面比較および変更箇所のカラーハイライト |
| **コンテキストメニューアクション** | `registerMonacoSuggestAction` | 右クリックまたは <kbd>Alt</kbd>+<kbd>S</kbd> で選択テキストに対するAIベクトル検索を実行 |
| **インラインサジェストウィジェット** | `ContentWidget` (独自実装) | 類似語の類似度スコアメーター付き候補リストをカーソル直下に展開 |
| **リアルタイムエラー波線** | `monaco.editor.setModelMarkers` | Rust Linter の検証結果を波線（Error / Warning）としてエディタ行内に描画 |

### 4.2 標準で利用可能（ビルトインで動作する）操作機能

| 機能 | ショートカット / 操作 | 説明 |
| :--- | :--- | :--- |
| **検索・置換 (Find & Replace)** | <kbd>Ctrl</kbd> + <kbd>F</kbd> / <kbd>Ctrl</kbd> + <kbd>H</kbd> | 正規表現、大文字小文字区別、単語単位での高度な検索・一括置換 |
| **コマンドパレット** | <kbd>F1</kbd> または <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | エディタの全コマンド検索・実行 |
| **マルチカーソル (複数選択)** | <kbd>Alt</kbd> + クリック / <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> | 複数箇所にカーソルを配置して同時一括編集 |
| **行の移動 / 複製** | <kbd>Alt</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> / <kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> | 現在行の上下移動や行複製 |
| **元に戻す / やり直し (Undo/Redo)** | <kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd> | 編集履歴の復元・再実行 |

### 4.3 今後有効化・拡張可能な未利用機能（ポテンシャル機能）

| 未利用機能 | Monaco API / オプション | 想定ユースケース / 拡張価値 |
| :--- | :--- | :--- |
| **見出し固定表示 (`Sticky Scroll`)** | `stickyScroll: { enabled: true }` | スクロール時、現在所属している上位見出し（`# 第1章` 等）をエディタ上部に固定表示 |
| **ホバー情報 (`Hover Provider`)** | `monaco.languages.registerHoverProvider` | 単語上にマウスを乗せた際、ナレッジベースの詳細説明やICD-10コードをポップアップ表示 |
| **クイック修正 (`Code Action / Quick Fix`)** | `monaco.languages.registerCodeActionProvider` | Linterエラー箇所に💡電球マークを表示し、ワンクリックで推奨用語に自動修正 |
| **セクション折りたたみ (`Folding`)** | `folding: true` | マークダウンの見出し（`#`, `##`）やリスト単位での文章折りたたみ |
| **不可視文字の可視化** | `renderWhitespace: 'boundary'` | 全角スペースやタブ、行末スペースの誤混入を可視化 |
| **定型文スニペット (`Snippets`)** | `registerCompletionItemProvider` (Snippet) | `shindan` と打って <kbd>Tab</kbd> を押すと、診断書の定型フォームを一括挿入 |

---

## 5. ショートカットキー & 操作体系

| 操作 / ショートカット | 動作内容 |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | ファイル保存ダイアログを表示（デフォルト名: `vectoreditor_YYYYMMDD_HHmm.txt`） |
| <kbd>Alt</kbd> + <kbd>S</kbd><br><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> | **AI ベクトル検索 / サジェスト**<br>・選択テキスト（未選択時はカーソル位置単語）を解析<br>・カーソル直下にインラインウィジェット（ポップアップ）を表示<br>・右サイドバーの検索結果パネルを更新 |
| **右クリックメニュー** | 選択テキスト上で右クリック ➔ **`AI Suggest (Vector Search)`** を実行 |
| **ウィジェット選択** | ポップアップ内の候補をクリックすると、選択範囲が標準病名に即時置換される |
| **もっと見る (Load More)** | ポップアップ下部のボタンで、追加の類似候補（5件超）を展開 |
| **全検索結果コピー** | サイドバー右上のコピーボタンで、検索結果を JSON 形式でクリップボードへコピー |
| **個別カード JSON コピー** | 各検索結果カード右上のコピーアイコンで、単体エントリーの JSON をクリップボードへコピー |

---

## 6. AI & ベクトル検索エンジン設定 (`worker.js` / `vectorSearch.js` / `dictionary.js`)

| 項目 | 仕様 / 設定内容 |
| :--- | :--- |
| **埋め込みモデル** | `Xenova/multilingual-e5-small` (日本語対応多言語モデル) |
| **モデル最適化** | `quantized: true` (int8 量子化で軽量・高速化) |
| **モデルキャッシュ** | ブラウザ内 CacheStorage / IndexedDB に永続化 (`useBrowserCache: true`) |
| **プロンプト形式** | E5 モデル仕様に準拠し、入力クエリ先頭に `query: ` を自動付与 |
| **起動時先行ウォームアップ** | アプリ起動時にバックグラウンドで AI モデルを展開し、初回検索時から 0ms レスポンスを実現 |
| **WebWorker 構成** | `@huggingface/transformers` をバックグラウンド Worker で非同期実行（UIスレッドをブロックしない） |
| **モデルロード進捗表示** | 初回ダウンロード時、サイドバーに `Downloading AI Model... (0%〜100%)` のプログレスバーを動的表示 |
| **スキーマ非依存（国際規格）** | W3C JSON-LD / Vector DB Standard 準拠。<br>・主名称: `name` / `title` / `label` / `prefLabel` / `term` / `text`<br>・コード: `id` / `code` / `key` / `@id`<br>・説明文: `description` / `comment` / `summary` / `definition`<br>・メタデータ: `metadata` 内の全属性または未知のカスタム属性を動的キーバリュー展開 |
| **検索パイプライン** | **1. 即時部分一致 (0ms)**: 辞書から全属性テキストを対象に高速一致抽出（重み `0.90〜1.0`、フォールバック `0.85`）<br>**2. セマンティック検索 (200〜300ms デバウンス / 1500ms タイムアウトガード)**: Rust エンジン（N-API）によるコサイン類似度上位検索 |
| **Monaco インラインウィジェット** | `ContentWidget` を使用し、テキスト選択直下に類似度スコアゲージ（背景バー幅連動）付きポップアップを展開（初期件数 `topN = 3`） |
| **アクティブ辞書管理** | サイドバーの `Import` ボタンから外部の `*.json` 辞書（ナレッジベース）を動的ホットリロード |

---

## 7. リアルタイム静的解析 (Linter / Validation)

* **トリガー**: 入力停止後 800ms のデバウンスで自動実行（`onDidChangeModelContent` 監視）
* **エンジン連携**: Rust 製 N-API エンジンの `validate_sync` / `validate` を呼び出し
* **検証ルール例**:
  * **初診日6ヶ月ルール (Clinical Timeline Check)**: 初診日と現症評価日が180日未満の場合に警告
  * **ICD-10 コード整合性**: 精神障害者保健福祉手帳等の要件に合致する形式かを自動判定
  * **不整合マーカー**: Monaco Editor 上に波線マーカー（Error / Warning）として描画
* **リフレッシュ機構 (`refreshLinter`)**: 辞書インポート時やエディタモード切替時に即座に再バリデーションを実施

---

## 8. OS & Electron ネイティブ連携設定 (`main/index.ts`)

| 項目 | 設定内容 |
| :--- | :--- |
| **ウィンドウサイズ** | 初期サイズ `1200 x 800` |
| **タイトルバー** | `titleBarStyle: 'hidden'`（カスタムタイトルバー構成） |
| **Windows 連動** | テーマ切り替えに合わせて、閉じる・最小化ボタンの背景色・シンボル色を動的更新 (`TitleBarOverlay`) |
| **開発時キャッシュ分離** | 開発時のみ一時ディレクトリ (`temp/vectoreditor-dev-user-data`) を使用し、ファイルロックを防止 |
| **Windows パフォーマンス対策** | ファイルロック防止のため `disable-gpu-shader-disk-cache` および `disable-http-cache` を有効化 |
| **CSP セキュリティポリシー** | `<meta http-equiv="Content-Security-Policy">` による厳格なリソース制限（HuggingFace、Vite、WebWorker安全許可） |
| **AI モデル精度設定** | `dtype: 'q8'`（int8量子化）の明示指定により WebAssembly で最小メモリ・最高速推論を実現 |
| **プロセス分離** | `contextIsolation: true`, `sandbox: true`, IPC Preload 経由のセキュア通信 |

---

## 9. IPC 通信インターフェース (`preload/index.ts` - `window.engineAPI`)

レンダラープロセスから呼び出し可能な IPC API 一覧：

| メソッド | 引数 | 戻り値 | 説明 |
| :--- | :--- | :--- | :--- |
| `searchVector(vector, limit?)` | `vector: number[], limit?: number` | `Promise<SearchVectorResponse>` | Rust エンジンによるベクトル類似度検索（動的件数指定対応） |
| `saveFile(content, defaultName)` | `string, string` | `Promise<SaveFileResponse>` | Electron ネイティブ保存ダイアログ経由のファイル保存 |
| `validateDocument(text)` | `text: string` | `Promise<ValidationResponse>` | Rust エンジンによるドキュメント静的検証 (Linter) |
| `loadImeDict()` | なし | `Promise<string>` | カスタム IME 辞書（タブ区切りテキスト）の読み込み |
| `getKnowledgeBase()` | なし | `Promise<any[]>` | 現在メモリ/ファイルにロードされているナレッジベース一覧取得 |
| `getActiveDictName()` | なし | `Promise<string>` | 現在アクティブなナレッジベースファイル名の取得 |
| `getEngineStatus()` | なし | `Promise<EngineStatus>` | RustバイナリおよびHNSWインデックスの初期状態取得 |
| `onEngineStatus(callback)` | `callback: (status: EngineStatus) => void` | `() => void` (Unsubscribe) | Rust/HNSW 構築完了イベントのリアルタイム購読 |
| `onSystemLog(callback)` | `callback: (log: SystemLogEntry) => void` | `() => void` (Unsubscribe) | メイン/レンダラーの全システムログのリアルタイムストリーミング購読 |
| `importKnowledgeBase()` | なし | `Promise<ImportKnowledgeBaseResponse>` | 外部 JSON 辞書ファイルのロード & インデックス再構築 |
| `setTitleBarOverlay(options)` | `TitleBarOverlayOptions` | `Promise<{ success: boolean; error?: string }>` | Windows ネイティブタイトルバー配色の動的変更 |

---

## 10. Rust N-API ネイティブ拡張層 (`lib.rs` / `Cargo.toml`)

`vect-or-edit` 直下でビルドされる N-API ネイティブモジュール（`napi-rs`）が提供するネイティブ関数一覧：

| Rust関数 | N-API公開名 | シグネチャ | 説明 |
| :--- | :--- | :--- | :--- |
| `validate_sync` | `validateSync` | `(text: String) -> JsValidationResult` | ドキュメントの同期高速検証 (Linter) |
| `load_knowledge_base` | `loadKnowledgeBase` | `async (path: String) -> u32` | JSON ナレッジベースを Rust メモリにロード |
| `load_kb_cache` | `loadKbCache` | `async (path: String) -> u32` | SQLite キャッシュファイルからの高速読み込み |
| `save_kb_cache` | `saveKbCache` | `async (path: String) -> ()` | 現在のナレッジベースを SQLite へ永続キャッシュ化 |
| `build_index` | `buildIndex` | `async () -> u32` | HNSW ベクトルインデックスの非同期再構築 (`spawn_blocking`) |
| `search` | `search` | `async (query: Float32Array, top_k: u32) -> Vec<JsSearchResult>` | コサイン類似度によるベクトル近傍探索 |
| `kb_info` | `kbInfo` | `async () -> JsKbInfo` | 辞書登録件数・ベクトル次元数・HNSW構築状態を取得 |
| `ping` | `ping` | `(name: String) -> String` | N-API 結合テスト用 ping-pong |

---

## 11. ビルド・ツールチェーン & プロジェクト設定

* **パッケージマネージャー**: `pnpm` (ワークスペース構成 `pnpm-workspace.yaml`)
* **バンドラー / ビルドツール**: `electron-vite` (Vite 5.3 + Rollup)
  * **チャンク最適化 (`electron.vite.config.ts`)**: `monaco-editor` を独立チャンクとして分割（チャンク警告リミット 3000KB）
  * **最適化除外**: `@huggingface/transformers` を `optimizeDeps.exclude` に指定（WebWorker内ロード対応）
* **言語 / ランタイム**:
  * **TypeScript**: 5.4 (`target: "ESNext"`, `moduleResolution: "Node"`, `strict: true`)
  * **Electron**: 31.7.7
  * **Rust / N-API**: `napi-rs` (Edition 2021, `crate-type = ["cdylib"]`, Releaseビルド時 LTO有効化)
* **テストランナー**: `vitest` (`npm run test`)
