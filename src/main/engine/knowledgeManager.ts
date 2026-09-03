import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { app } from 'electron';
import { getEngine, getVault } from './rustEngine';
import type { KnowledgeSlot } from '../../preload/types';

export interface KnowledgeSlotExt extends KnowledgeSlot {
  vencPassword?: string;
}

export const knowledgeSlots: KnowledgeSlotExt[] = [];
export const slotItemsCache: Map<string, any[]> = new Map();

let _activeProfile: any = null;
let _rustEngineReady = false;
let _rustEngineItemCount = 0;

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
      return data;
    }
  } catch (err) {
    console.warn(`[App] Failed to read profile at ${profilePath}:`, err);
  }
  return null;
}

export async function readStrippedKnowledgeItems(targetPath: string): Promise<any[]> {
  if (!targetPath || !fs.existsSync(targetPath)) return [];
  try {
    const content = await fsPromises.readFile(targetPath, 'utf-8');
    const list = JSON.parse(content);
    if (!Array.isArray(list)) return [];
    return list.map((item: any) => {
      const { vector, ...rest } = item;
      return rest;
    });
  } catch {
    return [];
  }
}

export async function reloadCombinedKnowledgeIndex(): Promise<number> {
  const engine = getEngine();
  if (!engine) return 0;

  if (knowledgeSlots.length === 0) {
    _rustEngineReady = false;
    _rustEngineItemCount = 0;
    return 0;
  }

  const allItems: any[] = [];
  const _vault = getVault();

  for (const slot of knowledgeSlots) {
    try {
      if (fs.existsSync(slot.filePath)) {
        let parsed: any[];

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
          parsed = await _vault.decryptKnowledgeBase(rawBuf, slot.vencPassword);
          if (!Array.isArray(parsed)) parsed = [];
        } else {
          const raw = await fsPromises.readFile(slot.filePath, 'utf-8');
          parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) parsed = [];
        }

        allItems.push(...parsed);
        slotItemsCache.set(slot.id, parsed.map((it: any) => {
          const { vector, ...rest } = it;
          return rest;
        }));
      }
    } catch (e: any) {
      console.warn(`[App] Error reading slot ${slot.id} (${slot.name}):`, e?.message || e);
    }
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
