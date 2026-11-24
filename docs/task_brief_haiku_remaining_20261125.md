# Task brief for Haiku: remaining small tasks (2026-11-25)

Written for: a Haiku 5.5 session doing mechanical work. Design decisions stay with the owner.

## Rules (all tasks)

- Reply in Japanese. Code, comments, commit text: English.
- Do NOT commit or push. Do NOT touch `c:\vect\` root files. Do NOT run `npm run build`, `build:win`, `npm run clean`.
- Ports 5173 and 9222 belong to the owner. Use 9229 or 9223 only.
- Warn the owner before a request is expected to pass 100K tokens.
- If anything is unclear, ask with AskUserQuestion buttons. Do not guess.
- Report each task as: done / skipped / failed, with command output for failures.

## T1. Re-run the checks (no code change)

1. `cd C:\vect\vect-or-generate` then `npm test`. Expect all pass, including `tests/conceptModel.test.mjs`.
2. `cd C:\vect\vect-or-edit` then `npm run typecheck` and `npm test` (run from `C:\vect\vect-or-edit`, upper-case drive letter).
3. `cd C:\vect` then `npm run guard:all`.
4. Report the output of each. Do not fix anything; list failures only.

## T2. Audit diff summary (Generate)

Goal: the audit manifest says what changed against the previous version: added, removed, changed concept ids.

- Files: `core/packager/auditGenerator.mjs`, `core/packager/index.mjs`, header fields `previousVersion` and `contentHash` already exist (see `tests/versionHeader.test.mjs`).
- Add an optional `previousKb` option to `packageArtifactBundle`. When given, compare by concept/entity id and write `diffSummary: { added: n, removed: n, changed: n }` (counts only, plus up to 20 ids per list) into `audit_manifest.json`.
- "Changed" = same id, different content hash of the entry.
- Add a test `tests/auditDiff.test.mjs` and append it to the `test` script in `package.json`.
- Add one line under `[Unreleased]` → Added in `CHANGELOG.md`.
- Check: `npm test` in `vect-or-generate`.

## T3. Editor: show the loaded dictionary version (blueprint first)

Goal: the Editor shows `knowledgeVersion` of each loaded dictionary, and warns when two versions of the same-named dictionary are loaded.

1. Find the source: the `ui_blueprint` CSV in `vect-or-edit`. Add the rows first (key, area, label en/ja), regenerate outputs with the existing generator. Never hand-edit generated files.
2. Read the version from the header the Generate side writes (`knowledgeVersion`, `generatorVersion`, `contentHash`). Compatibility logic is in `src/shared/slotCompat.ts`; extend it, do not duplicate.
3. Labels go through the i18n JSON (`src/renderer/locales/en.json`, `ja.json`). No hard-coded Japanese in code.
4. Add Vitest cases beside `src/shared/__tests__/slotCompat.test.ts`.
5. Check: `npm run typecheck`, `npm test`. If a build check is needed, use `npx electron-vite build`, then delete the output and report the size freed.
6. If the placement of the display is not obvious, stop and ask the owner with buttons.

## Not for Haiku (owner or Opus)

Electron migration, moving Studio state to the concept model, source/licence storage, Back-Translation, Fidelity/Privacy measurement, sample dictionary decision, commits and pushes.
