// Checks the right-click "open settings" jump table against the generated blueprint CSVs.
// Read-only: reports PROBLEM lines (exit 1) and NOTE lines (exit 0). Writes nothing.
// Input: ui_blueprint/{parts,jump_targets,settings,pairs}.csv in the docs folder of the workspace.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildJumpMap, renderJson } from './build-jump-targets.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BLUEPRINT = path.resolve(here, '../../docs/PROJECT/04_VECT_OR_EDITOR/ui_blueprint');
const VALID_BASIS = new Set(['pairs', 'manual', 'none']);
const VALID_TABS = new Set(['tabAppearance', 'tabEditor', 'tabAiSearch', 'tabSystem']);

function splitCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function load(file) {
  const text = fs.readFileSync(path.join(BLUEPRINT, file), 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = splitCsvLine(lines[0]);
  return lines.slice(1).map(l => Object.fromEntries(splitCsvLine(l).map((v, i) => [head[i], v])));
}

const parts = load('parts.csv');
const jump = load('jump_targets.csv');
const settings = load('settings.csv');
const pairs = load('pairs.csv');

const problems = [];
const notes = [];
const partKeys = new Set(parts.map(p => p.key));
const jumpByKey = new Map();
const ctrlIds = new Set(settings.map(s => s.control_id).filter(Boolean));
const tabs = new Set(settings.map(s => s.tab).filter(Boolean));
// Card keys: the heading data-key that scrollSettingsToCard matches (h4[data-key]) in the settings modal
const MODAL = path.resolve(here, '../src/renderer/components/settingsModal.html');
const cardKeys = new Set([...fs.readFileSync(MODAL, 'utf8').matchAll(/<h4[^>]*data-card-heading[^>]*data-key="([^"]+)"/g)].map(m => m[1]));

for (const r of jump) {
  if (jumpByKey.has(r.part_key)) problems.push(`duplicate jump row: ${r.part_key}`);
  jumpByKey.set(r.part_key, r);
  if (!VALID_BASIS.has(r.basis)) problems.push(`invalid basis "${r.basis}": ${r.part_key}`);
  if (r.target_tab && !tabs.has(r.target_tab) && !VALID_TABS.has(r.target_tab)) problems.push(`unknown tab "${r.target_tab}": ${r.part_key}`);
  if (r.target_control_id && !ctrlIds.has(r.target_control_id)) problems.push(`control id not in settings.csv "${r.target_control_id}": ${r.part_key}`);
  if (r.target_card_id && !cardKeys.has(r.target_card_id)) problems.push(`card key not a data-key in settingsModal.html "${r.target_card_id}": ${r.part_key}`);
}

// pairs.csv control ids that no longer exist in settings.csv (NOTE only: pairs also holds non-setting controls)
const pairsMissing = pairs.filter(p => p.control_id && !ctrlIds.has(p.control_id));
if (pairsMissing.length) notes.push(`pairs.csv points at control ids not in settings.csv: ${pairsMissing.length} row(s), e.g. ${pairsMissing.slice(0, 3).map(p => `${p.part_key}->${p.control_id}`).join(', ')}`);

// The renderer reads the generated JSON; it must match what the CSV produces now
const GENERATED = path.resolve(here, '../src/renderer/generated/jump_targets.json');
const expectedJson = renderJson(buildJumpMap(fs.readFileSync(path.join(BLUEPRINT, 'jump_targets.csv'), 'utf8')));
if (!fs.existsSync(GENERATED) || fs.readFileSync(GENERATED, 'utf8') !== expectedJson) {
  problems.push('generated jump_targets.json is stale: run node vect-or-edit/scripts/build-jump-targets.mjs');
}

// Parts with no jump row: a new part must get a row (or an explicit basis "none")
for (const p of parts) {
  if (p.key.startsWith('stp:') || p.key.startsWith('set:')) continue; // first-run window and settings page itself
  if (!jumpByKey.has(p.key)) {
    const linked = pairs.find(x => x.part_key === p.key && ctrlIds.has(x.control_id));
    if (linked) {
      notes.push(`no jump row: ${p.key} (${p.name_ja}); suggested: target_control_id=${linked.control_id}, basis=pairs`);
    } else {
      problems.push(`no jump row: ${p.key} (${p.name_ja}); add a row with basis=manual or basis=none`);
    }
  }
}

// Jump rows whose part no longer exists
for (const r of jump) {
  if (!partKeys.has(r.part_key)) problems.push(`orphan jump row (part removed or renamed): ${r.part_key}`);
}

for (const line of notes) console.log(`NOTE: ${line}`);
for (const line of problems) console.log(`PROBLEM: ${line}`);
console.log(`check-jump-targets: ${parts.length} parts, ${jump.length} rows, ${problems.length} problem(s), ${notes.length} note(s)`);
process.exit(problems.length ? 1 : 0);
