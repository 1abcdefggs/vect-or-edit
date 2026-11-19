// Checks the @api-source tag at the top of every source file that imports from 'electron'.
//   node scripts/check_api_source.mjs          check only (exit 1 on an error)
//   node scripts/check_api_source.mjs --add    insert a missing tag at the top of a file, then check
//
// The tag is the single record of which Electron APIs a file uses (docs/electron_*_map.csv hold the facts about each API).
// Tag format (a JSDoc block at the very top of the file):
//   @api-source electron: app, BrowserWindow
//   @api-table  local: electron_main_modules_map.csv
//   @api-check  2026-11-19 (checked against the breaking-changes page; skill electron-api)
// Errors: a file imports Electron values but has no tag; the tag lists other names than the imports; a tag sits on a file with
// no Electron import. With the tables present: a name has no row in any table; @api-table does not list the table that holds the row.
// Warning (tables present): the row's where_used column does not name the file.
// The tables are working notes kept on the maintainer's machine (not in the public repository). Without them the table checks
// are skipped and only the tag and the imports are compared.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const add = process.argv.includes('--add');
const docsDir = path.join(root, 'docs');
const TABLES = fs.existsSync(docsDir) ? fs.readdirSync(docsDir).filter((f) => /^electron_.*_map\.csv$/.test(f)).sort() : [];
const haveTables = TABLES.length > 0;

function splitCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

// name (lower case) -> [{ table, whereUsed }]
const rows = new Map();
for (const table of TABLES) {
  const lines = fs.readFileSync(path.join(root, 'docs', table), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const head = splitCsvLine(lines[0]);
  const whereIdx = head.indexOf('where_used');
  for (const l of lines.slice(1)) {
    const f = splitCsvLine(l);
    const key = f[0].toLowerCase();
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ table: `docs/${table}`, whereUsed: whereIdx >= 0 ? f[whereIdx] || '' : '' });
  }
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out); }
    else if (/\.(ts|js|mjs)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function importedNames(text) {
  const names = new Set();
  for (const m of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]electron['"]/g)) {
    if (/^import\s+type\b/.test(m[0])) continue;
    for (const part of m[1].split(',')) {
      const p = part.trim();
      if (!p || p.startsWith('type ')) continue;
      names.add(p.split(/\s+as\s+/)[0].trim());
    }
  }
  return [...names].sort();
}

function tableFor(names) {
  const set = new Set();
  for (const n of names) for (const r of rows.get(n.toLowerCase()) || []) set.add(r.table);
  return [...set].sort();
}

function buildTag(names, eol) {
  const tables = tableFor(names);
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return ['/**',
    ` * @api-source electron: ${names.join(', ')}`,
    ` * @api-table  local: ${tables.length ? tables.map((t) => path.basename(t)).join(', ') : '(tables not present)'}`,
    ` * @api-check  ${date} (checked against the breaking-changes page; skill electron-api)`,
    ' */'].join(eol) + eol;
}

let errors = 0; let warnings = 0; let added = 0; let checked = 0;
const err = (f, m) => { errors++; console.log(`ERROR   ${f}: ${m}`); };
const warn = (f, m) => { warnings++; console.log(`WARNING ${f}: ${m}`); };

for (const file of walk(path.join(root, 'src')).sort()) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  let text = fs.readFileSync(file, 'utf8');
  const names = importedNames(text);
  const head = text.slice(0, 1200);
  const tag = head.match(/@api-source\s+electron:\s*([^\r\n*]*)/);
  if (names.length === 0) {
    if (tag) err(rel, 'has an @api-source tag but no Electron import');
    continue;
  }
  checked++;
  if (!tag && add) {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const bom = text.startsWith('﻿');
    text = (bom ? '﻿' : '') + buildTag(names, eol) + (bom ? text.slice(1) : text);
    fs.writeFileSync(file, text, 'utf8');
    added++;
    console.log(`ADDED   ${rel}`);
  } else if (!tag) { err(rel, `imports ${names.join(', ')} from electron but has no @api-source tag`); continue; }
  const full = fs.readFileSync(file, 'utf8').slice(0, 1200);
  const listed = (full.match(/@api-source\s+electron:\s*([^\r\n*]*)/)[1] || '').split(',').map((s) => s.trim()).filter(Boolean).sort();
  if (listed.join(',') !== names.join(',')) err(rel, `tag lists [${listed.join(', ')}] but the imports are [${names.join(', ')}]`);
  if (!haveTables) continue; // the table checks below need the local tables
  const tableTag = (full.match(/@api-table\s+([^\r\n*]*)/) || [])[1] || '';
  const listedTables = tableTag.replace(/^local:\s*/, '').split(',').map((s) => s.trim()).filter(Boolean).sort();
  for (const n of names) {
    const found = rows.get(n.toLowerCase());
    if (!found) { err(rel, `${n} has no row in any docs/electron_*_map.csv table`); continue; }
    if (!found.some((r) => listedTables.includes(path.basename(r.table)))) err(rel, `@api-table does not list a table that holds ${n} (${found.map((r) => path.basename(r.table)).join(', ')})`);
    const short = rel.replace(/^src\//, '');
    if (!found.some((r) => r.whereUsed.includes(short) || r.whereUsed.includes(path.basename(short)))) warn(rel, `where_used of ${n} does not name this file`);
  }
}
if (!haveTables) console.log('note: no docs/electron_*_map.csv tables here (kept local); table checks skipped');
console.log(`checked ${checked} files with Electron imports; ${errors} errors, ${warnings} warnings${add ? `; ${added} tags added` : ''}`);
process.exit(errors ? 1 : 0);
