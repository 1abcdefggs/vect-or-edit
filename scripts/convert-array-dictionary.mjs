// Converts a header-less dictionary (a bare JSON array of items) into the header form.
// The source file is never changed. The result is written beside it under a new name, and an existing output is never overwritten.
// Usage: node scripts/convert-array-dictionary.mjs <source.json> [<source.json> ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Embedding settings the Generate recipes use (vect-or-generate/core/embedder.mjs: default model and "passage: " prefix).
export const EMBEDDING_DEFAULTS = {
  model: "Xenova/multilingual-e5-small",
  spaceId: "F.embedding.e5small",
  prefixes: { query: "query: ", passage: "passage: " },
};

export const OUTPUT_SUFFIX = ".v2.json";

/**
 * Pure conversion: array of items -> header form. Items are kept as they are.
 * Throws when the input is not an array, when an item has no vector, or when vector lengths differ.
 * @param {unknown} items
 * @param {{ domain?: string, schemaVersion?: string }} [opts]
 */
export function toHeaderForm(items, { domain, schemaVersion = "0.3.0" } = {}) {
  if (!Array.isArray(items)) throw new Error("Source is not a JSON array.");
  if (items.length === 0) throw new Error("Source array is empty.");
  const dimension = items[0]?.vector?.length;
  if (!Number.isInteger(dimension) || dimension <= 0) throw new Error("First item has no vector.");
  items.forEach((item, i) => {
    if (!Array.isArray(item?.vector)) throw new Error(`Item ${i} has no vector.`);
    if (item.vector.length !== dimension) throw new Error(`Item ${i} vector length ${item.vector.length} differs from ${dimension}.`);
  });
  return {
    domain,
    schemaVersion,
    dimension,
    metric: "cosine",
    model: EMBEDDING_DEFAULTS.model,
    spaceId: EMBEDDING_DEFAULTS.spaceId,
    prefixes: { ...EMBEDDING_DEFAULTS.prefixes },
    entities: items,
  };
}

/** Output path: same folder, same stem, suffix OUTPUT_SUFFIX (kb_x.json -> kb_x.v2.json). */
export function outputPathFor(sourcePath) {
  const dir = path.dirname(sourcePath);
  const stem = path.basename(sourcePath).replace(/\.json$/i, "");
  return path.join(dir, stem + OUTPUT_SUFFIX);
}

/** Converts one file. Returns the output path and the entity count. Refuses to overwrite. */
export function convertFile(sourcePath) {
  const outPath = outputPathFor(sourcePath);
  if (fs.existsSync(outPath)) throw new Error(`Output already exists, not overwritten: ${outPath}`);
  const items = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const stem = path.basename(sourcePath).replace(/\.json$/i, "").replace(/^kb_/, "");
  const doc = toHeaderForm(items, { domain: "medical_" + stem });
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n", { flag: "wx", encoding: "utf8" });
  return { outPath, count: doc.entities.length, dimension: doc.dimension };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node scripts/convert-array-dictionary.mjs <source.json> [...]");
    process.exit(2);
  }
  let failed = 0;
  for (const f of files) {
    try {
      const r = convertFile(f);
      console.log(`${f} -> ${r.outPath} (${r.count} entities, ${r.dimension} dims)`);
    } catch (err) {
      failed++;
      console.error(`${f}: ${err.message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
