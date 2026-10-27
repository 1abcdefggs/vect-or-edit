// Extracts Monaco editor option definitions from the installed monaco-editor typings.
// Output: src/renderer/editor/options/monacoOptions.catalog.json (generated, do not edit by hand)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const root = path.resolve(import.meta.dirname, '..');
const monacoPkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/monaco-editor/package.json'), 'utf8'));
const dtsPath = path.join(root, 'node_modules/monaco-editor/esm/vs/editor/editor.api.d.ts');
const outPath = path.join(root, 'src/renderer/editor/options/monacoOptions.catalog.json');

const source = fs.readFileSync(dtsPath, 'utf8');
const sf = ts.createSourceFile(dtsPath, source, ts.ScriptTarget.Latest, true);

const interfaces = new Map();
const aliases = new Map();
(function collect(node) {
  if (ts.isInterfaceDeclaration(node)) interfaces.set(node.name.text, node);
  if (ts.isTypeAliasDeclaration(node)) aliases.set(node.name.text, node);
  ts.forEachChild(node, collect);
})(sf);

const SOURCE_INTERFACES = ['IEditorOptions', 'IGlobalEditorOptions'];

function docOf(member) {
  const jsDocs = member.jsDoc;
  if (!jsDocs || !jsDocs.length) return '';
  const raw = jsDocs[jsDocs.length - 1].comment;
  const text = typeof raw === 'string' ? raw : (raw || []).map((p) => p.text).join('');
  return text.replace(/\s*\n\s*/g, ' ').trim();
}

function literalValues(typeNode) {
  if (ts.isLiteralTypeNode(typeNode)) {
    const l = typeNode.literal;
    if (ts.isStringLiteral(l)) return [l.text];
    if (ts.isNumericLiteral(l)) return [Number(l.text)];
    if (l.kind === ts.SyntaxKind.TrueKeyword) return [true];
    if (l.kind === ts.SyntaxKind.FalseKeyword) return [false];
    return null;
  }
  if (ts.isUnionTypeNode(typeNode)) {
    const out = [];
    for (const t of typeNode.types) {
      const v = literalValues(t);
      if (!v) return null;
      out.push(...v);
    }
    return out;
  }
  if (ts.isParenthesizedTypeNode(typeNode)) return literalValues(typeNode.type);
  if (ts.isTypeReferenceNode(typeNode)) {
    const alias = aliases.get(typeNode.typeName.getText());
    if (alias) return literalValues(alias.type);
  }
  return null;
}

function classify(typeNode) {
  const text = typeNode.getText(sf).replace(/\s+/g, ' ');
  const kinds = new Set();
  const enumValues = [];
  const visit = (t) => {
    if (ts.isParenthesizedTypeNode(t)) return visit(t.type);
    if (ts.isUnionTypeNode(t)) return t.types.forEach(visit);
    if (t.kind === ts.SyntaxKind.BooleanKeyword) return kinds.add('boolean');
    if (t.kind === ts.SyntaxKind.NumberKeyword) return kinds.add('number');
    if (t.kind === ts.SyntaxKind.StringKeyword) return kinds.add('string');
    if (ts.isFunctionTypeNode(t)) return kinds.add('function');
    if (ts.isArrayTypeNode(t)) return kinds.add('array');
    if (ts.isTypeLiteralNode(t)) return kinds.add('object');
    if (ts.isLiteralTypeNode(t)) {
      const v = literalValues(t);
      if (v) {
        v.forEach((x) => {
          if (typeof x === 'boolean') kinds.add('boolean');
          else enumValues.push(x);
        });
        return;
      }
    }
    if (ts.isTypeReferenceNode(t)) {
      const name = t.typeName.getText();
      if (name === 'Array' || name === 'ReadonlyArray') return kinds.add('array');
      const alias = aliases.get(name);
      if (alias) {
        const v = literalValues(alias.type);
        if (v) {
          v.forEach((x) => (typeof x === 'boolean' ? kinds.add('boolean') : enumValues.push(x)));
          return;
        }
        return visit(alias.type);
      }
      if (interfaces.has(name)) return kinds.add('object');
    }
    kinds.add('other');
  };
  visit(typeNode);
  return { type: text, kinds: [...kinds], enumValues };
}

function defaultFromDoc(doc) {
  const m = doc.match(/Defaults? (?:to|is) ([^.]*?)(?:\.(?:\s|$)|$)/i);
  return m ? m[1].trim() : null;
}

function nestedOf(typeNode) {
  const out = [];
  const pick = (t) => {
    if (ts.isParenthesizedTypeNode(t)) return pick(t.type);
    if (ts.isUnionTypeNode(t)) return t.types.forEach(pick);
    if (ts.isTypeReferenceNode(t)) {
      const decl = interfaces.get(t.typeName.getText());
      if (decl) out.push({ name: decl.name.text, members: membersOf(decl) });
    }
  };
  pick(typeNode);
  return out;
}

function membersOf(decl, deep = false) {
  const members = [];
  for (const m of decl.members) {
    if (!ts.isPropertySignature(m) || !m.type) continue;
    const name = ts.isStringLiteral(m.name) ? m.name.text : m.name.getText(sf);
    const doc = docOf(m);
    const entry = { name, ...classify(m.type), doc, defaultText: defaultFromDoc(doc) };
    if (deep) {
      const nested = nestedOf(m.type);
      if (nested.length) entry.nested = nested;
    }
    members.push(entry);
  }
  return members;
}

const options = [];
const seen = new Set();
for (const ifaceName of SOURCE_INTERFACES) {
  const decl = interfaces.get(ifaceName);
  if (!decl) throw new Error(`Interface not found: ${ifaceName}`);
  for (const m of membersOf(decl, true)) {
    if (seen.has(m.name)) continue;
    seen.add(m.name);
    options.push({ ...m, source: ifaceName });
  }
}

const catalog = {
  generatedBy: 'scripts/extract-monaco-options.mjs',
  monacoVersion: monacoPkg.version,
  sourceInterfaces: SOURCE_INTERFACES,
  count: options.length,
  options,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + '\n');
console.log(`Wrote ${options.length} options (monaco-editor ${monacoPkg.version}) -> ${path.relative(root, outPath)}`);
