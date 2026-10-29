import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { app } from 'electron';
import { getEngine, getVault } from './rustEngine';
import type { KnowledgeSlot } from '../../preload/types';
import { REGISTRY } from '../../shared/embeddingCatalog';
import { decideSpace, truncateAndNormalize } from '../../shared/embeddingSpace';

export interface KnowledgeSlotExt extends KnowledgeSlot {
  vencPassword?: string;
}

export const knowledgeSlots: KnowledgeSlotExt[] = [];
export const slotItemsCache: Map<string, any[]> = new Map();

let _activeProfile: any = null;
let _rustEngineReady = false;
let _rustEngineItemCount = 0;

// The embedding model the renderer has selected. Null until it says so: slots are then loaded as before, unchecked.
let _activeModel: { id: string; dimensions: number } | null = null;
// Set when the index holds shorter vectors than the model makes: a query is cut to this length before the search.
let _queryTruncateTo: number | null = null;
// The owner's switch (settings page): false means a dictionary that needs cutting is left out instead
let _allowTruncation = true;

export function getQueryTruncateTo() {
  return _queryTruncateTo;
}

/** Returns true when the model changed (the index must then be rebuilt) */
export function setActiveEmbeddingModel(modelId: string, allowTruncation = true): boolean {
  const entry = REGISTRY.models.find((m) => m.id === modelId);
  const next = entry?.dimensions ? { id: modelId, dimensions: entry.dimensions } : null;
  const changed = _activeModel?.id !== next?.id || _allowTruncation !== allowTruncation;
  _activeModel = next;
  _allowTruncation = allowTruncation;
  return changed;
}

export function getActiveProfile() {
  return _activeProfile;
}

export function isRustEngineReady() {
  return _rustEngineReady;
}

export function getRustEngineItemCount() {
  return _rustEngineItemCount;
}

export function resolveProfilePathForKb(kbPath: string): string | null {
  const dir = path.dirname(kbPath);
  const baseName = path.basename(kbPath);

  const core = baseName
    .replace(/^kb_/, '')
    .replace(/_knowledge_base\.json$/i, '')
    .replace(/\.json$/i, '');

  const candidateNames = [
    `guideline_${core}.json`,
    `preset_${core}.json`,
    `${core}_guideline.json`,
    `${core}_preset.json`,
    `${core}_profile.json`,
    'guideline.json',
    'preset.json',
    'profile.json'
  ];

  for (const name of candidateNames) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Hand the profile file to the Rust linter (validateSync / validate). Previously Edit only
 * kept the profile in TS (substring checks in semantics:query), so the engine ran with an
 * empty Profile. Engine >= this change adapts guideline_*.json (ADR-0005 Q5) and keeps the
 * loaded KB; failure is non-fatal (TS-side checks still run).
 */
async function pushProfileToEngine(profilePath: string, data: any): Promise<void> {
  const engine: any = getEngine();
  if (!engine || typeof engine.loadProfile !== 'function') return;
  if (Array.isArray(data?.rules) && data.rules.length === 0) return; // preset/template-only file: nothing for the linter
  try {
    await engine.loadProfile(profilePath);
    console.log(`[App] Rust linter profile loaded: ${path.basename(profilePath)}`);
  } catch (err: any) {
    console.warn(`[App] Rust linter did not accept ${path.basename(profilePath)}: ${err?.message || err}`);
  }
}

export async function loadProfileFile(profilePath: string): Promise<any> {
  try {
    if (fs.existsSync(profilePath)) {
      const text = await fsPromises.readFile(profilePath, 'utf-8');
      let data = JSON.parse(text);
      if (Array.isArray(data)) {
        const firstItem = data[0];
        const defaultDoc = firstItem?.formal_medical_output?.clinical_history_and_findings
          || firstItem?.template?.default_text
          || firstItem?.description
          || '';
        data = {
          profile_id: path.basename(profilePath, '.json'),
          domain_name: `${path.basename(profilePath, '.json')} (${data.length} models)`,
          description: `Loaded ${data.length} clinical templates`,
          template: {
            default_text: defaultDoc
          },
          rules: []
        };
      }
      console.log(`[App] Loaded Lint Profile from ${path.basename(profilePath)}: ${data.domain_name || data.profile_id || 'OK'}`);
      await pushProfileToEngine(profilePath, data);
      return data;
    }
  } catch (err) {
    console.warn(`[App] Failed to read profile at ${profilePath}:`, err);
  }
  return null;
}

/**
 * Mirror of vect-or-generate/core/compiler/projectV2.mjs#normalizeKbPayload (keep in sync;
 * shared fixture: vect-or-generate/tests/migrate.test.mjs Test 6).
 * Accepts every KB shape Generate emits and returns the flat item array that
 * vect-or-engine's load_knowledge_base expects ({ id, vector, ...metadata }).
 * Previously only a top-level array was accepted, so Generate's compiled payload
 * ({ domain, entities[] }) and schema v2 ({ concepts[] }) loaded as 0 items without an error.
 */
export function normalizeKbPayload(payload: any): { items: any[]; format: string; skipped: number } {
  if (Array.isArray(payload)) return { items: payload, format: 'array', skipped: 0 };
  if (payload && Array.isArray(payload.concepts)) {
    const concepts: any[] = payload.concepts;
    let facet: string | null = null;
    for (const c of concepts) {
      const e = (c.embeddings || []).find((x: any) => Array.isArray(x.vector) && x.vector.length > 0);
      if (e) { facet = e.facet; break; }
    }
    const readingBySense = new Map<string, string>();
    for (const f of Array.isArray(payload.forms) ? payload.forms : []) {
      const r = Array.isArray(f.reading) && f.reading[0] ? f.reading[0].value : undefined;
      if (r) for (const sid of f.senses || []) readingBySense.set(sid, r);
    }
    const items: any[] = [];
    let skipped = 0;
    for (const c of concepts) {
      const emb = (c.embeddings || []).find((e: any) => e.facet === facet && Array.isArray(e.vector) && e.vector.length > 0);
      if (!emb) { skipped++; continue; }
      const labels: any[] = c.labels || [];
      const pref = labels.find((l) => l.kind === 'pref') || labels[0];
      const sense = (c.senses || [])[0];
      const code = (c.notations || []).find((n: any) => n.scheme && n.scheme !== 'legacy-id');
      items.push({
        id: c.id,
        name: pref ? pref.text : c.id,
        reading: (sense && readingBySense.get(sense.id)) || '',
        definition: sense ? sense.definition : '',
        code: code ? `${code.scheme}: ${code.value}` : '',
        synonyms: labels.filter((l) => l.kind === 'alt').map((l) => l.text),
        category: c.category || '',
        facet: c.facet || 'F.concept',
        embeddingFacet: facet,
        ...(pref && pref.provenance ? { provenance: pref.provenance } : {}),
        vector: emb.vector
      });
    }
    return { items, format: 'concepts', skipped };
  }
  if (payload && Array.isArray(payload.entities)) return { items: payload.entities, format: 'entities', skipped: 0 };
  return { items: [], format: 'unknown', skipped: 0 };
}

export async function readStrippedKnowledgeItems(targetPath: string): Promise<any[]> {
  if (!targetPath || !fs.existsSync(targetPath)) return [];
  try {
    const content = await fsPromises.readFile(targetPath, 'utf-8');
    const list = normalizeKbPayload(JSON.parse(content)).items;
    return list.map((item: any) => {
      const { vector, ...rest } = item;
      return rest;
    });
  } catch {
    return [];
  }
}

/** The header fields that say which embedding space the vectors are in (absent in old dictionaries) */
function readSpaceHeader(payload: any): { spaceId?: string; model?: string } {
  if (!payload || Array.isArray(payload)) return {};
  return {
    ...(typeof payload.spaceId === 'string' ? { spaceId: payload.spaceId } : {}),
    ...(typeof payload.model === 'string' ? { model: payload.model } : {})
  };
}

function logNormalized(slotName: string, payload: any): any[] {
  const n = normalizeKbPayload(payload);
  if (n.format === 'unknown') console.warn(`[App] ${slotName}: unrecognized KB shape, 0 items loaded`);
  if (n.skipped > 0) console.warn(`[App] ${slotName}: ${n.skipped} concept(s) without a usable embedding were skipped`);
  return n.items;
}

/**
 * Decides, per slot, whether its vectors can enter the one combined index of the selected model, and cuts the ones
 * that need it. Sets slot.compat for the UI. A slot of another embedding space is left out (its entries still serve
 * the dictionary text search); the others stay in use.
 */
function selectSlotsForIndex(
  loaded: { slot: KnowledgeSlotExt; items: any[]; header: { spaceId?: string; model?: string }; dimension: number }[]
): any[] {
  _queryTruncateTo = null;
  const model = _activeModel;
  if (!model) {
    // Model not announced yet: the old behaviour, every slot goes in unchecked
    for (const l of loaded) l.slot.compat = { state: 'unchecked' };
    return loaded.flatMap((l) => l.items);
  }

  const decided = loaded.map((l) => ({ l, d: decideSpace({ ...l.header, dimension: l.dimension }, model, undefined, _allowTruncation) }));

  // Slots made for a shorter vector than the model gives (same space): the whole index follows the shortest one
  const queryCut = decided.filter((x) => x.d.action === 'truncate-query').map((x) => (x.d as { to: number }).to);
  const keepsModelLength = decided.some((x) => x.d.action === 'use' || x.d.action === 'truncate-kb');
  const target = !keepsModelLength && queryCut.length > 0 ? Math.min(...queryCut) : model.dimensions;
  if (target < model.dimensions) _queryTruncateTo = target;

  const items: any[] = [];
  for (const { l, d } of decided) {
    if (d.action === 'exclude') {
      l.slot.compat = { state: 'excluded', reason: d.reason };
      console.warn(`[App] ${l.slot.name} left out of the vector index (${d.reason})`);
      continue;
    }
    if (d.action === 'truncate-query' && target === model.dimensions) {
      // A shorter slot beside slots at the model's length cannot share one index
      l.slot.compat = { state: 'excluded', reason: 'dim-mismatch-mixed' };
      continue;
    }
    if (l.dimension !== target) {
      l.slot.compat = { state: 'approximate' };
      items.push(...l.items.map((it: any) => ({ ...it, vector: truncateAndNormalize(it.vector, target) })));
    } else {
      l.slot.compat = l.header.spaceId || l.header.model ? { state: target < model.dimensions ? 'approximate' : 'ok' } : { state: 'unverified' };
      items.push(...l.items);
    }
  }
  return items;
}

export async function reloadCombinedKnowledgeIndex(): Promise<number> {
  const engine = getEngine();
  if (!engine) return 0;

  if (knowledgeSlots.length === 0) {
    _rustEngineReady = false;
    _rustEngineItemCount = 0;
    return 0;
  }

  const _vault = getVault();
  // One entry per readable slot; the decision on which of them enter the index comes after all are read
  const loaded: { slot: KnowledgeSlotExt; items: any[]; header: { spaceId?: string; model?: string }; dimension: number }[] = [];

  for (const slot of knowledgeSlots) {
    try {
      if (fs.existsSync(slot.filePath)) {
        let payload: any;

        if (slot.filePath.endsWith('.venc')) {
          if (!_vault) {
            console.warn(`[App] Vault not ready, cannot decrypt ${slot.name}`);
            continue;
          }
          if (!slot.vencPassword) {
            console.warn(`[App] No password stored for encrypted slot ${slot.name}`);
            continue;
          }
          const rawBuf = await fsPromises.readFile(slot.filePath);
          payload = await _vault.decryptKnowledgeBase(rawBuf, slot.vencPassword);
        } else {
          payload = JSON.parse(await fsPromises.readFile(slot.filePath, 'utf-8'));
        }
        const parsed = logNormalized(slot.name, payload);

        slotItemsCache.set(slot.id, parsed.map((it: any) => {
          const { vector, ...rest } = it;
          return rest;
        }));
        const first = parsed[0]?.vector;
        loaded.push({ slot, items: parsed, header: readSpaceHeader(payload), dimension: Array.isArray(first) ? first.length : 0 });
      }
    } catch (e: any) {
      console.warn(`[App] Error reading slot ${slot.id} (${slot.name}):`, e?.message || e);
    }
  }

  const allItems = selectSlotsForIndex(loaded);
  if (allItems.length === 0) {
    // Every slot was left out. The engine keeps its previous index when given an empty file, so say not-ready instead.
    _rustEngineReady = false;
    _rustEngineItemCount = 0;
    return 0;
  }

  const tempCombinedPath = path.join(app.getPath('userData'), 'combined_knowledge_base.json');
  await fsPromises.writeFile(tempCombinedPath, JSON.stringify(allItems), 'utf-8');

  try {
    const count = await engine.loadKnowledgeBase(tempCombinedPath);
    await engine.buildIndex();
    _rustEngineReady = true;
    _rustEngineItemCount = count;
    console.log(`[App] Successfully rebuilt combined HNSW index across ${knowledgeSlots.length} slot(s) with ${count} total items`);
    return count;
  } catch (err) {
    console.error("[App] Failed to rebuild combined HNSW index:", err);
    return 0;
  }
}

export function setActiveProfile(profile: any) {
  _activeProfile = profile;
}

export function resetActiveProfile() {
  _activeProfile = null;
}

export function clearKnowledgeSlots() {
  knowledgeSlots.length = 0;
  slotItemsCache.clear();
}
