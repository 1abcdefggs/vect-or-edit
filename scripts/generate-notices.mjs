// Generates build-dist/THIRD_PARTY_NOTICES.txt from the production dependency tree (node_modules is the source of truth).
// Run by build:win before electron-builder, which ships the file next to LICENSE (see build.extraResources).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWN_PACKAGES = new Set(['@1abcdefggs/vect-or-engine']);
const LICENSE_FILE = /^(licen[sc]e|copying|notice)(\..*)?$/i;

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Finds a package the way Node does: nearest node_modules walking up from the requiring package. */
function locate(name, fromDir) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return fs.realpathSync(candidate);
    if (dir === path.dirname(dir)) return null;
  }
}

const licenseOf = (pkg) =>
  typeof pkg.license === 'string' ? pkg.license
    : pkg.license?.type || pkg.licenses?.map((l) => l.type || l).join(' OR ') || 'UNKNOWN';

const found = new Map();
const missing = [];

function visit(name, fromDir) {
  if (isExcluded(name)) return;
  const dir = locate(name, fromDir);
  if (!dir) { missing.push(name); return; }
  const pkg = readJson(path.join(dir, 'package.json'));
  const key = `${pkg.name}@${pkg.version}`;
  if (found.has(key)) return;
  found.set(key, { pkg, dir });
  for (const dep of Object.keys(pkg.dependencies || {})) visit(dep, dir);
  for (const dep of Object.keys(pkg.optionalDependencies || {})) visit(dep, dir);
}

const rootPkg = readJson(path.join(root, 'package.json'));

// Packages that build.files leaves out of the installer ("!**/node_modules/<name>/**/*") are not shipped, so they get no notice
const EXCLUDED = (rootPkg.build?.files || [])
  .map((pattern) => pattern.match(/^!(?:\*\*\/)?node_modules\/(.+?)\/\*\*/)?.[1])
  .filter(Boolean);
const isExcluded = (name) => EXCLUDED.some((prefix) => name === prefix || name.startsWith(`${prefix}/`));
for (const dep of Object.keys(rootPkg.dependencies || {})) {
  if (!OWN_PACKAGES.has(dep)) visit(dep, root);
}

const entries = [...found.values()].sort((a, b) => a.pkg.name.localeCompare(b.pkg.name));
const parts = [
  `Third-party notices for ${rootPkg.name} ${rootPkg.version}`,
  'Generated from the production dependencies in node_modules. Do not edit by hand.',
  '',
  'Electron and Chromium notices ship separately as LICENSE.electron.txt and LICENSES.chromium.html.',
  ''
];

// Assets that are not npm packages. Only what is verified in this repository is listed.
const BUNDLED_ASSETS = [
  {
    name: 'Editor color themes Dracula, Monokai, Night Owl (src/renderer/themes)',
    license: 'MIT',
    source: 'https://github.com/brijeshb42/monaco-themes',
    note: 'Bundled themes match the monaco-themes collection; the light faces and Tukune are original to this project.'
  },
  {
    name: 'Material Symbols Outlined and the UI/editor fonts (Inter, Noto Sans JP, Noto Serif JP, Source Code Pro, Source Sans 3, Source Serif 4, Cascadia Code)',
    license: 'Apache-2.0 (Material Symbols); SIL OFL 1.1 (fonts)',
    source: 'https://fonts.google.com',
    note: 'Not bundled. Loaded at runtime from Google Fonts (see the CSP in src/renderer/index.html).'
  }
];

parts.push('='.repeat(78), 'Bundled and runtime-loaded assets', '');
for (const asset of BUNDLED_ASSETS) {
  parts.push(`- ${asset.name}`, `  License: ${asset.license}`, `  Source: ${asset.source}`, `  ${asset.note}`, '');
}

for (const { pkg, dir } of entries) {
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || pkg.homepage || '';
  parts.push('='.repeat(78), `${pkg.name} ${pkg.version}`, `License: ${licenseOf(pkg)}`);
  if (repo) parts.push(`Source: ${repo.replace(/^git\+/, '')}`);
  parts.push('');
  const files = fs.readdirSync(dir).filter((f) => LICENSE_FILE.test(f) && fs.statSync(path.join(dir, f)).isFile());
  if (files.length === 0) parts.push('(no license file in the package; the license is the SPDX identifier above)', '');
  for (const f of files) parts.push(fs.readFileSync(path.join(dir, f), 'utf8').trim(), '');
}

const outDir = path.join(root, 'build-dist');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'THIRD_PARTY_NOTICES.txt'), parts.join('\n'), 'utf8');

const unknown = entries.filter(({ pkg }) => licenseOf(pkg) === 'UNKNOWN').map(({ pkg }) => pkg.name);
console.log(`Notices: ${entries.length} packages written to build-dist/THIRD_PARTY_NOTICES.txt`);
if (missing.length) console.warn(`Not installed (skipped): ${[...new Set(missing)].join(', ')}`);
if (unknown.length) console.warn(`No license declared: ${unknown.join(', ')}`);
