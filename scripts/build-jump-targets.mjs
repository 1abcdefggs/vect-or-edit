// Generates src/renderer/generated/jump_targets.json from the ui_blueprint jump table (SSOT: jump_targets.csv).
// Run: node scripts/build-jump-targets.mjs   Output is overwritten; do not edit the JSON by hand.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.resolve(here, '../../docs/PROJECT/04_VECT_OR_EDITOR/ui_blueprint/jump_targets.csv');
const OUT = path.resolve(here, '../src/renderer/generated/jump_targets.json');

export function parseCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((k, i) => [k, r[i] ?? ''])));
}

// part key -> { tab, card, control }; rows without a target tab are left out (no menu item)
export function buildJumpMap(csvText) {
  const map = {};
  for (const r of parseCsv(csvText.replace(/^﻿/, ''))) {
    if (!r.target_tab) continue;
    map[r.part_key] = { tab: r.target_tab, card: r.target_card_id, control: r.target_control_id };
  }
  return map;
}

export function renderJson(map) {
  return JSON.stringify(map, null, 2) + '\n';
}

// Run directly: write the file
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const json = renderJson(buildJumpMap(fs.readFileSync(CSV, 'utf8')));
  fs.writeFileSync(OUT, json, 'utf8');
  console.log(`wrote ${path.relative(process.cwd(), OUT)} (${Object.keys(JSON.parse(json)).length} entries)`);
}
