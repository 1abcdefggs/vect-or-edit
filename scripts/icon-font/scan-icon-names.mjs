// Collects every Material Symbols ligature name the renderer uses, so the bundled icon font can be trimmed to them.
// Run with --write to regenerate scripts/icon-font/icon-names.txt (the single source of truth for the subset).
// The renderer test compares a fresh scan with that file, so a new icon name fails the test until the list is regenerated.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rendererDir = path.resolve(here, '..', '..', 'src', 'renderer');
const manifestFile = path.join(here, 'icon-names.txt');

const NAME = /^[a-z][a-z0-9_]*$/;
const SKIP_DIRS = new Set(['__tests__', 'generated', 'node_modules']);
// DOM and CSS words that share a line with an icon (classList.add('active'), setAttribute('class', ...)). Not icon names.
const DOM_WORDS = new Set(['active', 'class', 'span', 'undefined']);

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) sourceFiles(full, out);
    } else if (/\.(html|js|ts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Returns the sorted, unique icon names found in the renderer source. */
export function scanIconNames(dir = rendererDir) {
  const names = new Set();
  const add = (name) => { if (NAME.test(name)) names.add(name); };

  for (const file of sourceFiles(dir)) {
    const text = fs.readFileSync(file, 'utf8');

    // 1. Ligature text inside a material-symbols element: <span class="material-symbols-outlined ...">name</span>
    for (const m of text.matchAll(/material-symbols-outlined[^>]*>\s*([a-z][a-z0-9_]*)\s*</g)) add(m[1]);

    // 2. Card headings rendered from data-icon (settingsModal.html -> settingsStaticMarkup.js)
    for (const m of text.matchAll(/data-icon="([a-z][a-z0-9_]*)"/g)) add(m[1]);

    // 3. Plain literals assigned as text (e.g. check.textContent = 'check')
    for (const m of text.matchAll(/textContent\s*=\s*'([a-z][a-z0-9_]*)'/g)) add(m[1]);

    // 4. Names chosen in code: ternaries, option defaults, constants. Only lines that talk about icons.
    for (const line of text.split(/\r?\n/)) {
      if (!/\bicon|material-symbols|ICON_/i.test(line)) continue;
      // Translation keys (t('...'), i18n.x, data-i18n) are text, not icons.
      const code = line
        .replace(/(^|[^A-Za-z0-9_])t\(\s*'[^']*'/g, '$1')
        .replace(/i18n[^ ,;)]*/g, '')
        .replace(/data-i18n="[^"]*"/g, '');
      for (const m of code.matchAll(/'([a-z][a-z0-9_]*)'/g)) if (!DOM_WORDS.has(m[1])) add(m[1]);
    }
  }
  return [...names].sort();
}

function main() {
  const names = scanIconNames();
  if (process.argv.includes('--write')) {
    fs.writeFileSync(manifestFile, names.join('\n') + '\n', 'utf8');
    console.log(`wrote ${names.length} names to ${manifestFile}`);
  } else {
    console.log(names.join('\n'));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
