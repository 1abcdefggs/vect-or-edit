# Changelog

All notable changes to the **VectOrEdit** (`vect-or-edit`) desktop application will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.111] - 2026-11-27

### Fixed

- Right-click menu: Select All now runs the Monaco action `editor.action.selectAll` (the command `selectAll` does not exist and raised "command 'selectAll' not found")
- Markdown preview: bulleted and numbered lists get a left padding, so the markers no longer sit outside the preview's left edge

## [0.3.110] - 2026-11-27

### Fixed

- Editor toolbar: the font size select no longer spills over the Editor Options button (3px at a toolbar width of 648px)
- Editor toolbar: the editor keeps at least 416px (was 400px, `EDITOR_MIN_WIDTH`), so Editor Options and the AI chat switch no longer overlap in the icons-only state (measured need: 412px)

## [0.3.109] - 2026-11-27

### Fixed

- The right-click menu test no longer strips tags with a regular expression (CodeQL "incomplete multi-character sanitization"; test code only, no effect on the app)

## [0.3.108] - 2026-11-27

### Changed

- Editor right-click: with no selection, the word under the pointer is selected first, so Copy, Cut and Google act on it and Cut deletes it (`contextMenuText.js`)
- Right panel: "How it works" (the embedding description), Embedding model and Collection each have a minus at the right of their heading to fold them; the three headings share the same side padding
- Bottom bar: the log gear is the last item and sits under the right panel gear
- Editor toolbar: the tone, font and size selects below 570px are hidden even though their wrappers carry an inline display
- `docs/pointer_rules.csv`: rows for a word (monaco, word, left and right)

### Added

- Tests for the right-click menu structure, the Google search setting and the word right-click

### Fixed

- Windows caption buttons are given the start colours again before the window is shown (attempt to stop a white flash in dark mode; not verified in the app)

## [0.3.107] - 2026-11-26

### Added

- A left press on blank space clears the keyboard focus (`blankPressFocus.js`); controls, text fields and the editor keep their own focus
- Right-click on the editor toolbar background opens the jump menu to the Editor toolbar settings card

### Changed

- Editor right-click menu is rebuilt in one component with a provisional order: Copy | Cut | Paste on one line with a selection (Copy All | Paste | Select All without one), then the search entries, Undo | Redo, Show right panel | Hide right panel on one line, and Settings
- Undo and Redo (right-click menu and tab bar) are inactive while there is nothing to undo or redo, with the reason in the tooltip
- "Search with Google" in the editor right-click menu shows an external link icon on its right; a new Editor toolbar setting "Google search" (default On) hides the entry and turns Alt+G off
- Right-click menu: icons share one size, inactive entries are easier to see, AI Chat | Vector share one line, the right panel is one Show/Hide toggle, Settings is a gear at the bottom right, and dictionary candidates come first for a selected word
- Right panel: the Vector features and Embedding model headings lose their chip icon and divider, the embedding description moves under Vector features with thin rules between the blocks, and the Model label is capitalised and larger
- Editor toolbar: below 620px the Save word goes, and below 570px the tone, font and size values go so that only their icons remain (stops the overlap; the full shrink order is still open)
- `docs/pointer_rules.csv`: the editor blank right-click menu is the accepted standard; the setup screen and the settings page stay out of scope for the jump menu, with notes

## [0.3.106] - 2026-11-26

### Added

- Undo and Redo buttons in the editor tab bar (`edt:undo`, `edt:redo`)
- Undo and Redo at the top of the editor right-click menu, with or without a selection
- Right-click menu in text fields (Cut, Copy, Paste, Select All) and on read-only text (Copy, Select All) in the AI chat history, the log and any selected text
- Select All in the editor right-click menu
- `docs/pointer_rules.csv`: table of left and right click behaviour (standard vs current) with a Vitest check for omissions and contradictions

### Changed

- Editor right-click menu: Undo and Redo share the first row; Paste is inactive while the clipboard holds no text; the Settings entry opens the Editor tab; the menu opens below the clicked line, at the lower right of a selected word
- Editor right-click menu: "Reset Layout" is replaced by "Maximize editor width" (the right panel folds to its compact rail) and "Default editor width" (the panel opens at the default width)
- "AI Chat & Rewrite" is inactive, with the reason in text, while the AI chat switch is OFF or no provider key is set (editor right-click menu and the suggestion pill)
- "AI Suggest" is now "Search Knowledge" (ja: "ナレッジを検索") in the editor right-click menu, the pill label, the model-unset tip and the welcome document: it searches your own dictionary and does not use an LLM
- The suggestion pill no longer appears when a selection is released: the trigger mode default is now Right-click (`contextmenu`); a mode the user chose before is kept
- The other places of the word at the caret get an underline (`--same-word-underline-color`) instead of a background tint; only when the word appears more than once and nothing is selected

### Removed

- The `app:resetUIVisibility` event and its listener, and the `ctx_reset_layout` text: nothing else sent the event

### Fixed

- The editor right-click menu closes on Esc
- A text field no longer gets the settings jump menu in place of its edit menu
- Toast close button: solid fill with a contrasting mark, so the × stays visible on the toast

## [0.3.105] - 2026-11-26

### Added
- Document list button at the right end of the tab row; it lists every open document and switches to the one chosen
- Settings: "Open on selection" in the Sidebar tab; when the panel is closed, selecting text in the editor opens it (default off)

### Changed
- Other matches of the selected text no longer get a background fill; the selection and its outline are kept
- Word occurrence highlight (occurrencesHighlight) is off by default

## [0.3.104] - 2026-11-26

### Changed
- Renamed the settings card "Text tools" to "Editor toolbar" (ja: エディタツールバー) in the settings page and the help text.

## [0.3.103] - 2026-11-26

### Changed

- Settings gear hover tints the whole area it controls (background tint from `--settings-key-fg`), in addition to the outline
- Zoom hint popover uses a new `--bg-popover` token instead of the card surface, so it stands apart from the page
- BG/FG custom colour pickers sit inside the BG/FG control, next to its select, instead of beside the toolbar
- Settings: the HELP label uses the same bold weight as BACK
- Settings: the active top tab shows the active colour on its left edge; the label colour is unchanged
- Settings: the contents list uses the size, weight and capitals of the main card headings
- Settings: the card fold button uses the active colour
- Settings: the Tooltips on/off switch comes before the tooltip width in the theme card
- Settings: the text tools card links to Editor view (Monaco)
- Settings: the sidebar tab lists the embedding model before the collection
- Settings: the system log startup choice lists Closed before Open (Open stays the default)
- Settings: the log time format is a segmented control like the time zone
- Settings: the area sentence is its own description box at the card description size
- Settings: the heading icon uses the active colour; the heading text keeps the text colour
- Settings: the "Save logs" heading is renamed "Log file" (ja: ログファイル)
- Settings: the File, View and Help menu descriptions list the items the menus contain
- Settings: the Menu bar rows show the menu descriptions (tip_menu_*), and the App name row has its own description (new key tip_menu_app_name)
- Settings: the menu descriptions keep the menu name on its own line (pre-line, Menu bar rows only)
- Editor: the first document tab's left edge lines up with the editor body's left edge (tab bar left padding removed)
- Settings: every segmented control is pushed to the row's right side, so its last button ends at the same x on each row (shared rule in settings-ui.css)
- Editor: the active document tab opens into the writing area: no bottom border, the sides use the shared border token, and the writing area has left, right and bottom borders
- Editor: the status row uses the editor background and the editor text colour, so it reads as part of the writing area

## [0.3.102] - 2026-11-26

### Changed

- Editor minimum width raised from 320px to 400px (`paneLimits.ts` and `editor.css`), so the icon-only toolbar fits without overlap (measured natural width 394px)
- Toolbar AI chat toggle icon changed from cloud to smart_toy

### Fixed

- Sidebar width is clamped when the window is resized, so the editor keeps its minimum (the cap now also reserves the splitter and the row padding)

## [0.3.101] - 2026-11-26

### Changed

- Startup loader: the version now sits to the right of the app name on the same line, larger (24px), in the shared brand font
- Startup loader: version uses the accent text colour (`--accent-text`)
- Neural glow line colours moved to tokens in `variables.css` (`--glow-*`); values unchanged

## [0.3.100] - 2026-11-26

### Removed

- The hidden 'Managed by the app' group from Editor Options; its 13 locked options stay marked `managed` in the review sheet

## [0.3.99] - 2026-11-26

### Removed

- Locale keys left from the removed update dialog: update_available_title, tip_update_close, tip_update_later, tip_update_open_release

## [0.3.98] - 2026-11-26

### Changed
- Japanese UI text: labels, tooltips and descriptions end as noun phrases (14 entries)

## [0.3.97] - 2026-11-26

### Fixed
- Locale files: add the 34 keys used by the scrollbar settings, slot compatibility, dictionary version and sidebar texts, which v0.3.96 shipped without

### Changed
- Locale files: update the current wording of 4 English and 51 Japanese values, including the welcome document text

### Removed
- Locale files: remove 119 locale keys that no source file references

## [0.3.96] - 2026-11-25

### Added
- Scrollbars: two settings on the Appearance tab of the settings page, size (3x default, 2x, 1x, 0.5x of 6px) and active colour (accent colour by default, neutral when off); the bar is 18px by default so hidden content is easy to see (`src/renderer/ui/appearance/scrollbarStyle.js`)
- Knowledge slots: each row shows the `knowledgeVersion` its file header states (or "version not stated"); two loaded versions of the same dictionary name are flagged in the row (`versionConflicts` in `src/shared/slotCompat.ts`, labels in `en.json` and `ja.json`)
- Knowledge slots: the compatibility state of every file is decided in one function (`src/shared/slotCompat.ts`, with a table test and a check that the files in use share one length); a file with no vectors now says so (`no-vectors`) instead of giving a length reason
- Knowledge slots: the info view of a file shows the model it names, the selected model and its state; a file left out at the moment it is added raises a warning toast with the reason; the HNSW lamp shows how many files are in use and how many are left out; the search error names the file's model and the selected model
- Embedding registry: every model has an explicit `spaceId` (the model id when it had none), so "same space" no longer depends on a default

### Removed
- The sidebar sentence "A dictionary can be searched only when it was built in the same embedding space as this model" and its key `sidebar_model_dict_desc`
- 117 unused keys from `en.json` and `ja.json` (no reference in the source, tests, docs, blueprint or tools; the `settings.*` keys, which the settings and Monaco option pages build from names, and keys named in docs or tests were kept)

### Changed
- Welcome document: replaced with the new how-to text in English and Japanese; when the language changes, an untouched welcome tab now also changes its file name (it kept the old language before)
- Active editor tab: it takes the editor background and text colour, with a frame of the opposite tone (light on dark, dark on light) on the top and both sides
- Right sidebar: the "Vector features" heading sits between the collapse button and the EMBED switch; the embedding model is chosen from a dropdown of downloaded models; the pane sweeps open at startup; the dimensions show the number only
- Toast close button is 28px with a clearer border
- Guideline naming: the screen text now says Guideline where it said Goal or Profile for the same file (the toast after loading, the lamp text, the file dialog title, the unload tooltip in Japanese); the unused key `btn_change_profile` is removed. Internal names (`activeGoal`, `profile_id`) stay
- Vault: new .venc files start with `VEN2` and give the password to Argon2id as it is, with the app secret as Argon2id's secret input, instead of hashing the password with HMAC-SHA256 first (the code scanning alert `js/insufficient-password-hash`). Files that start with `VENC` still open; an older app cannot open a `VEN2` file

### Added
- Knowledge slots: a file that cannot be read (missing, encrypted without a password, damaged) now shows its own "not in use" note on the slot row instead of nothing
- Engine status: when the engine refuses to build the index, the HNSW lamp says so ("Index failed") instead of "Unloaded"

### Fixed
- Knowledge index: one knowledge file whose own entries differ in vector length no longer stops vector search for all files; only that file is left out, with its reason. Without an announced model, a file of another vector length than the first one is left out the same way
- Knowledge import and Add: a lint profile is now recognised by its content (an object with a rules list, and no entries with vectors), not by the word "profile" in the path; a knowledge file kept in a folder named like that is no longer taken for a profile, and `guideline_*.json` files are recognised; an explicit top-level `kind` ("guideline" or "knowledge") decides first; without it a Guideline is recognised by a top-level `rules` array, so a file with nested rules and no `kind` is still taken for a knowledge file
- Knowledge import: encrypted (.venc) files chosen in the import dialog are refused with a message to use Add; the current slots are no longer cleared first
- Knowledge index: when the engine fails to load the combined index, the status now says not ready instead of leaving the previous index answering searches
- Knowledge import: the status after importing knowledge files follows the engine, so it no longer says ready when every file was left out of the index
- Knowledge slots: a file that cannot be read on a reload no longer keeps the compatibility note or the text-search items of an earlier load

## [0.3.95] - 2026-11-24

### Added
- Sidebar: a Change button on the row of the embedding model in use; it opens the model list of the settings page

### Changed
- Settings page: BACK and the guide button take the accent colour for text and frame; a pressed guide button also gets a tinted background; a gap and a thin rule separate BACK from the title
- AI chat card: the API key setup now follows "Use AI chat", and "Chat position" comes after the model rows
- "Confirm before closing" moved from the System tab (Closing card, removed) to the Theme card of the Title Bar tab, below the tooltip rows

## [0.3.94] - 2026-11-23

### Changed
- Minimap: on by default, as in Monaco, so the "Default: true" shown in Editor Options and the value a reset returns to agree; saved values are kept
- Editor colour list in the toolbar: each entry reads in English in every language and shows the text-on-background contrast ratio ("Dark  BG soft  FG soft  8.9:1")

### Fixed
- Editor colour pairs now apply: the Monaco theme name no longer contains underscores, which Monaco rejects ("Illegal theme name")
- A failed colour pair is logged to the console instead of being swallowed

## [0.3.93] - 2026-11-23

### Changed
- Editor Options: only the top count line names its numbers ("Options 293  Changed 7"); each heading shows the bare numbers, right aligned in the same two columns

## [0.3.92] - 2026-11-23

### Added
- Editor Options: a "Show changed only" toggle with a filter icon beside the search, which lists only the options that were changed
- Editor Options: semanticHighlighting.enabled is editable again as a three-way choice (a flat dotted option name is no longer split into a nested path)

### Changed
- Editor Options: the header is its own area (left aligned, tinted, framed down both sides and along the bottom), and the intro text is shorter
- Editor Options: names, descriptions, the search box, the count line and the controls use 16px text; the search box takes the settings page style
- Editor Options: each row shows what the option does first, then its name, with the default under the value column; values sit in one fixed-width column
- Editor Options: counts read name first ("Options 80", "Changed 5"); "shown / all" appears only while a filter hides options
- Editor Options: rows are indented under the heading text, and a value equal to its default is no longer stored as a change

### Removed
- Editor Options: the options the app fixes and the ones one input cannot express (14 entries, the "Managed by the app" group) are no longer listed

## [0.3.91] - 2026-11-23

### Added
- Select menu: a select can ask for a larger list through data-menu-class (ui-select-menu--lg, 16px text)

### Fixed
- Select menu: the selected item keeps its own surface when it is also the active item, so its light text is no longer shown on a pale background

## [0.3.90] - 2026-11-23

### Changed
- Source comments and test names no longer point to documents that are not in the repository; the reasons stay in the comments

## [0.3.89] - 2026-11-23

### Added
- npm script `jump:build` regenerates the settings jump table (generated/jump_targets.json) from the ui_blueprint CSV

## [0.3.88] - 2026-11-23

### Added
- About dialog: rebuilt on a language change and kept open, so the new language shows at once

### Changed
- Tooltip text: each sentence after the first starts a new bulleted line (split at the Japanese full stop); commas stay inside their sentence
- Close guard: the chat is no longer a close target
- Styling: sidebar, popups, modals, buttons, selection and layout rules adjusted (see the commit diff)

### Removed
- The update dialog markup and script (updateModal.html, updateModal.js)

## [0.3.87] - 2026-11-23

### Added
- Log language setting (Logs card): English (default) or follow the app language; the system log is written in English unless set
- Log panel: a Models tab lists the models and chooses the model, the same choice as the settings page

### Changed
- Pipeline lamp texts are dictionary keys: the tooltip is redrawn in the UI language when the language changes and the log line stays in English

## [0.3.86] - 2026-11-23

### Fixed
- Settings page layout tokens (nav width, page padding, card gap, label and icon size) are defined in the shared token file, so the settings CSS no longer uses undefined variables

## [0.3.85] - 2026-11-23

### Added
- Settings: a search box at the top of the page; the text is left-aligned, the hint right-aligned
- Right-click on a window part offers "Open settings for this item", which opens the settings card that controls it (jump table: ui_blueprint jump_targets)

### Changed
- The choice controls of the settings page (switch, segmented buttons) follow the disabled state of their select, so a disabled one cannot be clicked or reached by keyboard

## [0.3.84] - 2026-11-23

### Added
- Editor options: each option has a weight and a generated panel layout (monacoOptions.layout.json)
- Document language: the language of the open document is detected on open, paste and tab switch; the language-dependent options follow it
- Status bar: the document language control shows the language and whether it is automatic (for example JA, auto)

### Changed
- Editor options panel: the sub-headings and the weight-0 options are folded at the end of each group

## [0.3.83] - 2026-11-23

### Added
- Chat: the model button opens a quick menu of the model in use (OpenAI and Claude: their fixed lists; Gemini: the fetched list)
- Chat placement: below the editor (default) or as a sidebar tab, set in Settings, by the chat header move button, or from the AI button menu
- Chat: the Send button becomes Stop while a reply is awaited; a line under the input names the service and model
- Chat: a save button writes the conversation to a Markdown file
- Chat: the fixed model lists show the date they were last checked, as an English date

### Changed
- The AI chat switch in Settings is locked while no provider or key is set, with the missing step named in the text

## [0.3.82] - 2026-11-23

### Added
- Instant tooltip: an on/off switch, the gap to the pointer (near, standard, far) and the line length (short, long)
- The zoom hint has 10% step buttons for zooming in and out

### Changed
- The zoom popup stays in place while the page zooms: it is anchored where the gesture starts
- The header collapse button uses the chevrons icon and the title "Collapse title bar"

## [0.3.81] - 2026-11-23

### Changed
- Success colour (log OK, status) follows the theme through `terminal.ansiGreen`; it is used only when its contrast on the editor background is at least 4.5:1, otherwise the default stays

### Fixed
- Markdown headings in the Solarized light, Monokai dark, GitHub dark and Tukune light themes reach 4.5:1 on the editor background (keyword.md rules added)
- Tukune light accent colour is #255393, 3.24:1 against the title bar, up from a lower contrast

## [0.3.80] - 2026-11-23

### Added
- Icon definitions for the editor options, the chat and the panel toggles (eye, chevrons, stop, panel layouts, arrow up) in the icon set

### Changed
- Module card icons share one size token (`--icon-size-ui`, 18px) instead of three separate font sizes

## [0.3.79] - 2026-11-23

### Added
- A cloud chat send can be stopped: each send carries a request id, and the main process aborts it on `app:cancelAiSend`; Gemini uses the SDK abort signal, OpenAI and Claude abort their request
- Model lists for OpenAI and Claude can be fetched with the saved key (`app:listOpenAIModels`, `app:listClaudeModels`); only the list parsing is covered by tests, the live APIs are not

### Changed
- API keys are read and written with the asynchronous safeStorage methods; a key stored in the old synchronous format is read once and stored again in the new format
- The settings file is written to a temporary file and renamed over the old one, and saves run one after another

### Fixed
- On Windows a relative import whose drive letter differed in case could load the main-process IPC module twice, so the app could hang on the splash screen; relative imports now resolve to one id

## [0.3.78] - 2026-11-23

### Changed
- UI text in the English and Japanese locale files: new strings for the settings page, the AI chat and the logs, and reworded strings; keys still used by the current code are kept

## [0.3.77] - 2026-11-19

### Added
- Every source file that imports from `electron` starts with an `@api-source` tag (the Electron APIs it uses, the check date); `npm run check:api-source` fails when a tag and the imports disagree, so future work (people, agents, the `electron-api` skill) sees which Electron APIs a file touches
- The right panel's open/close button has its own part key (`sbr:panel-toggle`), so it can be shown or hidden like the other parts
- A setting chooses whether the right panel is open or closed when the app starts (Sidebar tab, "Panel top" card)
- The embedding row in the settings has a link to the "LLM assistant" card of the Editor tab
- A "Collection" card in the Sidebar tab of the settings names what the right panel loads (Guidelines and Knowledge), above the Local / Cloud tabs

### Changed
- When no LLM is set up, pressing the editor's LLM switch and choosing to open the settings now starts the Editor tab at the "LLM assistant" card instead of the top of the page
- In the left nav of the settings (Sidebar tab), "Guidelines" and "Knowledge" are shown indented under "Collection" instead of repeating as two rows of the Collection card next to their own entries; `settings-layout.json` has an optional `nested` entry for this
- The Sidebar tab of the settings follows the right panel from top to bottom: "Panel top" (open/close button, embedding switch, gear), "Collection", the embedding model catalog, "Guidelines" (real-time validation), "Knowledge" (dictionary import and suggestion results), and "Advanced"
- The embedding card's heading and its first row no longer share one name: the heading belongs to the "Panel top" card and the row is called "Embedding model"; the catalog heading is "Embedding model catalog"
- The right panel's embedding switch hides its name when the panel is narrower than 360 px, so that the top row (open/close button, switch, JSON copy button, gear) keeps fitting with the longer Japanese name
- The title bar's collapse button is now described as "Collapse Title Bar" (it was "Minimize or expand the header"), so that it is not mixed up with the window's own minimize button
- The Japanese text writes the verb as "切替え" and "切替わ" (it was "切り替え" and "切り替わ") in the UI strings; the welcome document is left as it is
- The Japanese text now says "エンベディング" for the embedding everywhere (it was a mix of "埋め込み", "埋め込みモデル", "エンベディング" and "埋め込みMODEL")
- "Shorten vectors to fit" moved to the "Advanced" card at the bottom of the Sidebar tab, because it matters only for a dictionary whose vectors differ in length from the model's
- The AI control center and the "What can each model do?" table moved from the Sidebar tab to the top of the System tab, because they cover the LLM and the embedding together

## [0.3.76] - 2026-11-19

### Changed
- The custom colours card in the settings shows its WCAG level (AA, AAA or below the standard) next to the contrast ratio, like the eight pair cards
- The rows of colour cards in the settings are at most 44rem wide, so each card is about 169px instead of 348px in a 1920px window

## [0.3.75] - 2026-11-19

### Added
- The line height in the settings is a row of four cards, each showing a few lines of sample text at its own ratio, so the spacing can be judged before choosing
- The "Editor view (Monaco)" card in the settings has a description: it holds the basic display settings of Monaco, and the finer ones are in Editor Options in the right panel
- A "Using the tabs" row in the settings' New documents card: how to close, rename, duplicate and create tabs, with a still picture of the tab row drawn from its own classes
- The Gemini model table shows the output token limit next to the input limit ("1M / 64K") in a column named "IN / OUT" (its tooltip says IN is the input and OUT the output)
- The Gemini model table has a Video purpose and a Gemini Omni series: the gemini-omni models were listed as text models under Other
- The Gemini model table has a Music purpose for the Lyria models, which were listed as text models
- The headings of the Gemini Omni, Lyria, Nano Banana and Deep Research series say what the models make, in one line under the name
- Each column header of the Gemini model table has a tooltip that says what the column means (for example, that input / output are token limits)
- A Latest mark in the notes column of the Gemini model table for the -latest aliases, and a filter on the notes column (NEW, Thinking, Latest)
- The Deep Research models form a Deep Research series in the Gemini model table, instead of a series named after the first word "Deep"; its heading and the Gemini Omni heading do not say "(other)"

### Fixed
- The current line highlight "Underline only" no longer fills the line with the theme's line background; "Full line" keeps it
- Three literal font sizes (the icon font, the settings tab icon and the settings nav icon) use the type-scale tokens, so the type-scale guard passes
- A test of the Markdown preview line break and of the editor defaults no longer holds Japanese literals (written as escapes), so the English-invariants guard passes
- Nano Banana models whose id has no "image" word are listed as image models, not text models, and their heading does not say "(other)"
- Gemini models without a generation number (gemini-omni-1.1-flash, gemini-pro-latest) show their cost guide from the tier word in their id

### Changed
- The settings card "Writing view" (ja: 執筆画面) is named "Editor view (Monaco)" (ja: エディタ表示 (Monaco)) in the card, the Editor tab description and the tab tooltip, because its options are Monaco's
- The settings' format of new documents says that a Markdown document can be previewed with the eye button in the tab row
- The settings' new document name has one row of parts instead of a chip row and an order row: the row is the file name itself (each part shows its value, joined by - and followed by the extension) and replaces the example box; parts have a remove button and are moved by dragging (or Left/Right on a focused part), and the other parts have + buttons
- The new-tab button in the editor tab row is labelled "New" (ja: 新規作成), and its tooltip says it creates a new document in a new tab
- The settings' new document name explains that the name is used for the tab and the file name of documents made with + New
- The Markdown preview button in the editor tab row shows only its icon and has no frame at rest, like + New in the same row; the label stays for screen readers
- The Gemini model table's search field sits in the Model name column header, and the Model name column is about twice as wide
- The Gemini model table's Tier column is renamed Cost and shows only High, Standard or Low (the tier name is already in the model name)
- The model in use shows one In use button (使用中) in the place of Use; pressing it takes the choice back, so the action column keeps the width of one button
- The model in use shows a check left of its name, where the eye reads first; the Use and In use button is narrower
- The row of the model in use is tinted with the accent color and has an accent bar at the left, instead of the inverted (dark) surface that read as a group heading
- GitHub light theme: the accent and button color is the darker green #1a7f37 (was #2ea44f), so a selected button shows white text at a contrast of 5.08 instead of black text on a bright green
- Favorites only in the model table is a star button with the count in the header of the action column, above the stars of the rows, instead of a chip above the table
- A model's own description from the Gemini API (English, as given) is the tooltip of its name in the model table
- The cost column of the model table moves to the right end, next to the star and Use, so the cost is in sight when a model is chosen; the notes column comes before it
- The expand button of the model table shows a diagonal double arrow (to the top right and the bottom left) instead of four corner brackets; the collapse mark points the arrows in
- The Show model ID button moves from above the model table to the right of the search field in the name header, labelled "ID" (its tooltip gives the full name); the search placeholder reads "モデル名検索" / "Search model name"
- The model ID is a smaller second line under the model name instead of a column of its own, so showing it adds no column; the list can no longer be sorted by ID (the name order is nearly the same)
- The expand button fills the top right corner of the model table (the full height of the header row, flush with its right edge) instead of a small chip inside the cell padding
- Group headings of the model table stick right under the header row at its measured height; the fixed 38px let a heading slide a few pixels under the taller header with the search field
- The sort chip and the count line of the model table share one line above the table; the Use button reads "使う" in Japanese
- Group headings in the model table start closer to the left edge (10px instead of 18px); the title and the note line up with the model names
- The family headings of the model table use a light tint instead of a dark grey, so they are not mistaken for the inverted row in use
- The model table text is larger in the same 46px rows: cells 16px, model ids and column labels 15px, buttons and the header search 14px, marks 13px, family titles 16px
- The Purpose, limits and Cost columns of the model table are exactly as wide as their longest text, so their words do not wrap and the spare room goes to the name and notes
- A model name in the model table breaks between words with even lines, and a bracketed part such as "(Apr-21-2026)" or "[Rerouted]" is never broken inside
- The column header of the model table has bold labels in the text color and a 2px dark rule under it, so it reads apart from the family headings

### Removed
- The Remove button beside the In use mark in the model table (pressing In use does the same)
- The Preview mark in the notes column of the Gemini model table ("preview" is already in the model id and name)

## [0.3.74] - 2026-11-18

### Added
- Choose the name of a new document in Settings: date, time, sequence number, fixed text, or a mix, with the order of the parts and an example
- A labelled New Tab button in the tab bar opens a new tab and creates a new file

### Changed
- The eye switch in Settings shows an eye icon and the state in words (shown or hidden)
- The settings gear icons use the inverse of the accent colour by default; Settings > Theme > Settings icon colour switches them back to the accent colour
- The tab bar buttons (close, duplicate, new tab) share one style with a border and a transparent background
- The first document of a new install is titled "How to use"
- The editor status bar shows the line count before the character count
- Each settings gear's tooltip names the settings it opens: Header, Editor, Right panel or System
- Hovering a settings gear outlines the part whose settings it opens, in the gear colour
- The right panel sections (Guidelines, Knowledge, Editor Options) open and close from a minus icon at the right end of their header; the chevron on the left is removed
- The header minimize button, the editor chat dock collapse button and the section toggles use a minus icon while open and an unfold icon while closed
- The Editor Options section header is no longer a button containing another button; its toggle is the only button and reports its open state
- The minus and unfold icons are drawn as inline SVG, so they do not depend on the icon font subset
- The system log panel fades out for a moment before it closes automatically, 5 seconds after start (not for a close by the user; reduced motion skips the fade)
- The System log section in Settings explains that it is the same log as the log panel at the bottom of the window, and that its lines are real recorded events
- The Settings left nav lights the setting row at the top of the page as well as its card, and an entry with its settings listed below has square bottom corners
- The entries under a Settings left nav card line up with the card's right edge (no inset on the right)
- The Settings left nav is one step darker than the page body, so the index and the content read as separate areas
- The card headings of the Settings page use the same tone as the left nav, as a band across the top of each card
- The logo, app name and version block at the top of the Settings page is removed, since the window already shows them
- The Menu bar card lists the logo and version first, then the menus
- The Settings icon colour setting has a gear icon before its title, and its description says why each area has a gear (it opens that area's settings)
- The Settings icon colour choice shows a gear in each option's colour, and the gears of the header, editor, sidebar and log panel as they are applied now
- The Appearance settings follow the header order: Appearance, Theme, zoom, then the settings icon colour
- The Popup colour setting says when its popups appear: text selection, the right-click menu and button tooltips
- The Settings guide button moves from the bottom of the left list to the top tab row, and a back-to-top button stays at the bottom right of the page
- The current line is marked in the line-number gutter by default, not by a background band
- The edges between the Settings tab bar, its list and its body use the selected-state colour
- The header zoom can be set by pressing and dragging left or right on it; a click still resets it to 100%
- The zoom popup stays open while the pointer moves down to its slider, and a drag keeps going when the pointer leaves the badge
- The Preview button uses the shared toolbar button look and active state, like the other editor toolbar buttons
- The Preview icon uses the shared icon size, and its icon and label are centred on one line

### Fixed
- The menu bar rows in Settings no longer show "undefined" as their description

## [0.3.73] - 2026-11-18

### Added
- Add an embedding model by its ID (owner/model-name) in the embedding model list; the model's facts come from Hugging Face. An added model is listed for comparison and cannot be used until its query and passage prefixes are verified
- Remove a model added by ID from the list

### Changed
- The zoom control in Settings is a slider from 50% to 300%, the same control as in the header
- The Parts of the window list is a closed section; each row's eye switch sits in a fixed-width column
- The developer reset is a closed section inside a red Danger Zone frame
- The embedding model catalogue is a table with five columns (model, dimensions, size, license, status); each model's languages, downloads, use and description open in a row below it

### Fixed
- The log panel closes 5 seconds after the window is first shown, instead of staying open; the start is counted when the first-run setup is done and the editor is on screen
- The tab bar close and duplicate buttons have a visible border and background at rest

### Removed
- The unused zoom option labels (100%, 110%, 125%, 140%, 150%) in the dictionaries


## [0.3.72] - 2026-11-17

### Changed
- The Open panel button on the settings page goes to the Editor Options panel without the close confirmation; the confirmation stays on × and Back

## [0.3.71] - 2026-11-17

### Changed
- The right panel calls its guideline section "Guidelines" everywhere: the heading in English, the section tooltip, the Editor Options button tooltip and the part name in the settings

## [0.3.70] - 2026-11-17

### Changed
- Claude and OpenAI can be chosen in first-run setup; every place lists the cloud providers as Google Gemini, OpenAI and Claude
- The LLM card of the AI Control Center shows the chosen cloud LLM provider by name, or "Not configured", instead of an upper-case value from the search generator setting
- Texts that named only Gemini (setup prompt, Sidebar tab description, LLM switch, embedding assistant, restart) name the three providers or "API keys"

### Removed
- Seven dictionary entries for provider options that are no longer shown

## [0.3.69] - 2026-11-17

### Changed
- An embedding model download is written to the system log as normal lines with a time stamp (start, then one line per file), so Copy and Save include it; the percentage stays on the status lamp and the settings bar
- The Japanese dictionary shows the download progress label in Japanese

### Removed
- The separate download progress row in the log panel, which had no time stamp, always named the same model and was left out of Copy and Save

## [0.3.68] - 2026-11-17

### Added
- The Editor options row on the settings page has an Open panel button: it closes the settings and shows the Editor Options panel on the right, and the row's description says where those options are

## [0.3.67] - 2026-11-17

### Changed
- The AI Control Center replaces its "Local-first" badge with a sentence below the heading: search with a local embedding model runs on this device, and text goes to the cloud when the LLM or a cloud embedding is used

## [0.3.66] - 2026-11-17

### Changed
- Settings help text is regenerated from the current settings page (labels, descriptions and order)

### Removed
- The "AI role / inference scope" select on the settings page, its stored key and its dictionary entries: the value was saved but never read, so every choice behaved the same

## [0.3.65] - 2026-11-13

### Added
- The settings page header shows the app version
- LLM chat panel with provider unification and shared API key input component
- Outbound requests are checked against one allowlist in the main process and blocked by default
- Cloud AI hosts are reachable only from the main process, and only while an AI request is being sent

### Changed
- User data is organized into config/, secrets/ and data/ subfolders under userData
- First-run setup STEP 3 asks the embedding model question as a Y/N choice
- Back to editor moved to the right end of the settings title row, where the other windows keep their close control
- Colour mode is named Appearance, and its system option reads Match system (Japanese: 外観, システムに合わせる)
- Gemini requests go through Electron's network stack, so the allowlist also applies to them
- The ONNX runtime loads the WebAssembly file bundled with the app instead of fetching it from a CDN
- All LLM chat UI labels and messages now support both Japanese and English

### Fixed
- Embedding model Y/N buttons in first-run setup are bound to their radio inputs
- Embedding model Y/N buttons are wide enough that their text does not wrap
- Workspace setup Cancel button now reads Open a file in open mode and Cancel in save mode, matching its actual action
- First-run setup Cancel button renamed to Quit because it exits the app
- Cloud AI requests stop after 10 minutes without a reply, so a stalled request no longer keeps its host open

### Removed
- api.github.com from the renderer content security policy (nothing calls it any more)
- Hide notice key of the menu bar setting in the settings registry (the menu bar row has no control to hide)

## [0.3.61] - 2026-11-09

### Added
- Menu bar card in the Header tab with a visibility switch for each menu
- Popup colour setting shown as sample cards in the real popup colours
- Current section highlight in the settings navigation

### Changed
- Display language and Display are one card in the Header tab
- Editor text card named Text; font size row explained in pixels
- Visibility switch shows Shown and Hidden states and names its part
- Back to editor is the only close control and asks before discarding changes


## [0.3.60] - 2026-11-09

### Added
- Shared model list arrangement used by the main process and the renderer

### Changed
- Gemini model list is fetched and shown through one picker


## [0.3.59] - 2026-11-09

### Changed
- Cyberpink and Monochrome themes, each with a light and a dark face
- Theme colour files generated from one skeleton, with derived editor colours


## [0.3.58] - 2026-11-08

### Added

- Session logs can be saved, with a three-mode setting.
- The trimmed Material Symbols icon font is bundled, so the icons work offline.
- The Markdown preview uses the editor's font and line height, and shows a single line break as a line break.
- The editor options have a restore-defaults row, and Monaco's first-run defaults are set (tab size 2, no quick suggestions, no format on paste or type).

### Changed

- The log list shows a capped number of rows and renders them in batches. The log panel shrinks, so long logs scroll inside it.
- Monaco option descriptions are read from the dictionary.
- Duplicate labels are merged and unused label fields are removed.
- The dictionary step of the first-run setup is renamed.

### Fixed

- Saving overwrites a file without asking only when the user chose that path in a dialog during this run. Any other path goes through the save dialog.
- The model name in an AI response is escaped before it is shown.
- The first-run setup restores the save folder and the choices when Cancel is pressed.

### Removed

- The unused `_archive/rust-napi` copy.
- The empty completion provider stub in the editor extensions.

## [0.3.57] - 2026-11-07

### Added

- The first-run setup has a Cancel button. It quits the app without storing the setup choices, so the setup opens again on the next start. Language and theme, which are stored when chosen, stay.

### Changed

- Selected items (first-run choices, theme and provider cards, settings areas, the embedding model card, dropdown items, settings and editor tabs) share one selected style from `css/selection.css`, the same in every theme and mode.
- First-run steps 1 and 2 keep a 12px minimum gap between their groups.

### Removed

- The unused `.ai-setup-card` rules.

## [0.3.56] - 2026-11-02

### Changed

- Tooltip bullet separators are written as Unicode escapes, so no Japanese literal stays in the source; the tests use English fixtures.
- The AI switch "OFF" label and the first-run disclosure icons take their sizes from the type scale (`--fs-9`, `--fs-18`, `--fs-20`) instead of literal pixel values.


## [0.3.55] - 2026-10-27

### Added

- Each knowledge slot has an Info button. It shows the dictionary header (domain, version, dimension, metric, items, fidelity, sanitized). An encrypted slot shows its header only while its password is loaded.
- A loaded dictionary shows its domain as the slot title.

### Changed

- With EMBED off, the results say they are text matches only.
- The guideline card's empty-state text is inside the card body, so it collapses with the card.

## [0.3.54] - 2026-10-27

### Added

- Closing the window with the × button asks first, the same confirmation as File > Exit.
- Empty search results say why: the dictionary-search model is off or not ready (with an Open Settings button), or nothing matched.
- The guideline and knowledge cards explain what they are for, as a short list, while nothing is loaded.

### Changed

- The toolbar font name fills the free width (70 to 115 px) instead of a fixed number.
- Icon-only buttons share one box (28 px) and one icon size (24 px). Icons beside text share one size (18 px).
- The "Save As" button label is in English (SAVE AS). The "pending save" text beside it is removed; the LED and the tooltip show the state.
- The search wait shows a spinner instead of the word "Computing".
- The welcome text of a new document is revised.

### Removed

- Outlines around the sidebar collapse button and the duplicate and new tab buttons.

## [0.3.53] - 2026-10-26

### Added

- The minimum score and the auto-save delay fields have − and + buttons, in Settings and in the first-run setup. The field keeps its value and its limits; the buttons stop at the limits.
- Fifteen tooltips that list several items are shown one item per line. The wording is unchanged.

### Changed

- Reloading the editor, restarting the app, clearing the cache, installing an update and the auto-save location question all use the same confirmation dialog as the other actions.
- The cache-clear confirmation uses the locale files; before, its text was in English in the code.

## [0.3.52] - 2026-10-26

### Added

- The Save dialog opens in the folder of the last save; before the first save it opens in the save folder from Settings. The last folder is kept in userData (last-save-dir.json) and survives a restart.
- While no save location is set, the Save button shows a short word beside the LED, not only the LED colour (autosave_pending_label).

### Changed

- 17 English tooltips are reworded: three or more parallel items are split into lines, the rest stay on one line. The Japanese tooltips follow, mostly as noun phrases (operation sentences keep the dictionary form).
- The Japanese labels of the two add buttons in the sidebar (Guidelines and Knowledge) are "追加" instead of the English "Add files". The unload confirmation text refers to the same label.

## [0.3.51] - 2026-10-26

### Added

- The tab close question has a "Don't show this again" checkbox. Ticking it and confirming skips the question for clean tabs only; unsaved tabs are still asked. Turning the global "Confirm before closing" switch back on brings the question back.
- The save menu has a Save item, which does what the Save button does.
- The Knowledge section shows a second line under each slot: the file name and the item count. When no slot is loaded, it shows a short hint on what Knowledge is for.

### Changed

- The LLM and Embedding switches show the state on the knob (OFF or ON), with the other word beside the track. The knob is a square with rounded corners.
- The header appearance control is a three-position switch: Light, Auto (the middle, with the auto icon), and Dark. The settings page and the first-run setup keep their three-option selects.
- The save menu is moved to the document body when the app starts, so the toolbar cannot clip or offset it.

### Removed

- The mouse icon in the header zoom display. The mouse wheel still zooms.

## [0.3.50] - 2026-10-26

### Changed

- The LLM and Embedding header switches are role="switch" buttons: aria-checked sits on the whole button, not on the inner track, and the redundant state on the track is removed. The look is unchanged.
- The header button (.editor-header-btn) is defined once in editor.css. The duplicate rule in buttons.css is removed, and the one hover rule is merged; the rendered values do not change.

## [0.3.49] - 2026-10-26

### Removed

- Unused .tab-btn and .setting-tab-btn selectors from the cursor rule in utilities.css. The rule itself stays for the other selectors.

## [0.3.48] - 2026-10-26

### Changed

- The settings row rule is defined once. The two definitions of .setting-item in modals.css are merged; the rendered values do not change.

## [0.3.47] - 2026-10-26

### Changed

- Menu item hover and focus styles are defined once in dropdown-menu.css, shared by the menus and the save menu.
- Search results, the menu renderer and the about dialog were tidied in the same pass.

## [0.3.46] - 2026-10-26

### Fixed

- The header minimize button is registered as a window part, so the settings coverage check passes.
- The toolbar keeps the font size readable (16px) before the labels give way. The editor options name shortens earlier.

### Removed

- Unused AI label strings (LLM and EMBED ON/OFF) from the locale files.

## [0.3.45] - 2026-10-26

### Changed

- LLM and Embedding header buttons show an ON/OFF switch with the state in words. The button stays an active control in both states.

## [0.3.44] - 2026-10-25

### Changed
- Sidebar module cards: the title size rules live in the card stylesheet; the Editor Options header uses the shared classes
- Bottom bar close controls and LOGS action buttons: the resting tint comes from the shared log tokens
- LOGS chip labels use the title colour in the closed and open states (contrast 4.5:1 or more on each face)

### Fixed
- A downloaded embedding model loads at startup, so the Embedding shows as configured after a restart

## [0.3.43] - 2026-10-25

### Changed
- Pipeline status LEDs have one base and one rule per state; the error LED is lit and static (no blinking)

## [0.3.42] - 2026-10-25

### Changed
- Toggle switches in the first-run setup are built from one shared markup function

## [0.3.41] - 2026-10-25

### Added
- The guide beside the settings is also shown in English (it follows the UI language)
- Log clear asks for confirmation when the log has entries; the log action buttons and close controls show a tint at rest
- The LOGS panel opens with a short slide and fade (off for reduced motion)
- Renaming a tab with an extension that changes the format asks first and then switches the format
- Zoom slider in the zoom hint
- Downloaded embedding model: EMBED turns on by itself after the first-run download; the settings page no longer offers to download it again

### Changed
- Header: colour mode, theme and zoom form one frame; the settings button sits at the right end; the language switch is in the settings page only
- Sidebar module cards share one definition; Knowledge opens after files are added; card padding is 4px
- Toolbar selects use the free space before they shorten the text; the sidebar header top padding aligns with the editor toolbar
- The menu bar and Save menu items come from one definition; the settings card headings and row text come from shared markup
- A new tab is empty; only the first document of a session shows the welcome text

### Fixed
- Toolbar overflow at narrow widths (the right group no longer pushes past the edge)
- Header and log controls no longer carry outlines

## [0.3.40] - 2026-10-25

### Changed
- Button padding uses the exact golden-ratio values (sqrt 5 forms); the unused --phi token is removed
- The toolbar shrinks by width: selects cut their text, the LLM label and the BG/FG word hide at narrow widths

## [0.3.39] - 2026-10-25

### Changed
- Help for the log time and Editor Options settings is regenerated

## [0.3.38] - 2026-10-25

### Changed
- Editor Options opens from the toolbar, stays open in that mode, and its label shrinks with the toolbar width

## [0.3.37] - 2026-10-25

### Changed
- Bottom bar LOGS and PIPELINE are tinted buttons without an outline; the log actions are tinted too

## [0.3.36] - 2026-10-25

### Added
- Log time format (24 hours, 12 hours, follow OS, ISO 8601) and time zone (local, UTC) settings; stored times are ISO 8601 (UTC)
- Column header in the log panel (Time, Level, Source, Message), with the log actions at its right end

### Changed
- Log buttons are ghost buttons with accent icons; labels hide when the header is narrow
- Log badges have no border and do not set the row height; the row gap is 2px
- Bottom bar LOGS and PIPELINE are tinted buttons without an outline; the closed LOGS state is a tint too
- Editor Options opens the right panel's card; the card is hidden by default and stays open while the mode is on
- The toolbar button shows a pressed state (accent frame, accent icon)
- The Editor Options label shrinks in steps with the toolbar width: full name, short name, last word, icon only
- The right panel's inner inset is one token (--sidebar-inset); the options card lines up with the other cards
- Corner radius and spacing steps are defined once in design-tokens.css

## [0.3.35] - 2026-10-24

### Changed
- Button size follows the font size: height and padding from one rule, compact buttons for the menu bar, log panel and sidebar card
- Buttons under 24px get a transparent hit area

### Added
- Editor Options button sits in the editor style group, with its label

### Fixed
- Long titles in the confirm dialog wrap instead of overflowing

## [0.3.34] - 2026-10-24

### Changed
- Editor bars, lamps and borders follow the style rules: one font for labels, no forced uppercase, the lamp color and border rules
- The editor status bar and the style group keep the agreed order and widths
- Editor Options card styles follow the same rules
- Japanese and English text for the window and settings changes

## [0.3.33] - 2026-10-24

### Changed
- Save is a split button: the left part saves at once, and the arrow opens AutoSave, Save As and Save All
- Save As and Save All run the same commands as the File menu
- The workspace root is read in one place, so Save, Open, AutoSave and the settings page agree
- Closing the settings, the tabs and the app asks first; Exit and Close Window ask the same way
- The window RAM figure sits on the left of the bottom bar, next to LOGS

## [0.3.32] - 2026-10-24

### Changed
- The settings page is grouped by window area (Header, Editor, Sidebar, System), with a map of the window at the top
- The guide beside the settings lists the parts of the window and their settings in the order they sit in the window
- Choice buttons mark the default option with (Default)
- Panel sizes and the Editor Options mode are remembered between starts

## [0.3.31] - 2026-10-24

### Changed
- The LLM and Embedding switches are independent: turning one on does not turn the other on
- Status lamps: an off switch shows a grey lamp while its label and button stay usable
- Dictionary search keeps working with both switches off; the LLM and Gemini help only when they are on
- The cloud LLM provider is stored apart from the search generator, and Gemini is no longer shown when it is not selected

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
