import { resetVectorSearchResults } from './vectorSearch.js';
import { refreshLinter } from './editorManager.js';

export const allKnowledgeItems = [];
export const allDictEntries = [];

export function setKnowledgeItems(kbItems) {
  allKnowledgeItems.length = 0;
  allDictEntries.length = 0;

  if (Array.isArray(kbItems)) {
    allKnowledgeItems.push(...kbItems);
    for (const item of kbItems) {
      const title = item.name || item.title || item.label || item.prefLabel || item.term || item.text || item.id || '';
      const code = item.icd10_code || item.metadata?.icd10_code || item.code || item.id || item.key || item['@id'] || '';
      const desc = item.description || item.comment || item.summary || item.definition || '';

      allDictEntries.push({
        item: {
          id: code || title,
          title: title,
          subtitle: desc || code,
          code: code,
          icd10_code: item.icd10_code || ''
        },
        note: desc,
        isQuick: true
      });
    }
  }
}

export async function updateSemanticStateDisplay() {
  const activeProfileEl = document.getElementById('activeProfileName');
  const activeRuleCountEl = document.getElementById('activeGoalRuleCount');
  const btnInsertTemplate = document.getElementById('btnInsertTemplate');
  const slotsListEl = document.getElementById('knowledgeSlotsList');

  if (!window.engineAPI?.getSemanticState) return;

  try {
    const state = await window.engineAPI.getSemanticState();
    
    // 1. Update Profile Display (Guideline vs Preset Adaptive View)
    if (state?.activeGoal) {
      const g = state.activeGoal;
      const ruleCount = Array.isArray(g.rules) ? g.rules.length : 0;
      const hasTemplate = Boolean(g.template?.default_text);
      const isGuideline = ruleCount > 0;

      const profileIconEl = document.getElementById('profileIcon');
      const profileHeaderLabelEl = document.getElementById('profileHeaderLabel');

      if (profileIconEl) {
        profileIconEl.textContent = '';
      }
      if (profileHeaderLabelEl) {
        profileHeaderLabelEl.textContent = isGuideline ? 'Guideline / Rule:' : 'Document Preset:';
      }

      if (activeProfileEl) {
        activeProfileEl.textContent = g.domain_name || g.profile_id || 'Custom Profile';
        activeProfileEl.title = `${g.domain_name || g.profile_id}\n${g.description || ''}`;
      }
      if (activeRuleCountEl) {
        activeRuleCountEl.textContent = `${ruleCount} rule${ruleCount === 1 ? '' : 's'}`;
      }
      if (btnInsertTemplate) {
        btnInsertTemplate.style.display = hasTemplate ? 'inline-flex' : 'none';
      }
    } else {
      if (activeProfileEl) activeProfileEl.textContent = 'Default Profile';
      if (activeRuleCountEl) activeRuleCountEl.textContent = '0 rules';
      if (btnInsertTemplate) btnInsertTemplate.style.display = 'none';
    }

    // 2. Render Knowledge Slots
    if (slotsListEl) {
      slotsListEl.innerHTML = '';
      if (!state?.slots || state.slots.length === 0) {
        slotsListEl.innerHTML = '<div style="font-size: 0.72rem; color: var(--text-muted); padding: 4px 2px;" data-i18n="no_slots_loaded">No slots loaded. Click [+ Add Slot] to load.</div>';
      } else {
        for (const slot of state.slots) {
          const itemEl = document.createElement('div');
          itemEl.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: var(--bg-secondary); padding: 3px 6px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.75rem; gap: 6px;';
          
          const infoSpan = document.createElement('span');
          infoSpan.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; color: var(--text-main); font-weight: 500;';
          infoSpan.textContent = slot.name;
          infoSpan.title = `${slot.filePath} (${slot.itemCount.toLocaleString()} items)`;

          const countBadge = document.createElement('span');
          countBadge.style.cssText = 'font-size: 0.65rem; color: var(--accent-color, #818cf8); font-weight: 600; flex-shrink: 0;';
          countBadge.textContent = `${slot.itemCount}`;

          const btnDel = document.createElement('button');
          btnDel.style.cssText = 'background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; font-size: 0.75rem; line-height: 1; display: flex; align-items: center; justify-content: center;';
          btnDel.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
          btnDel.title = `Unload ${slot.name}`;
          btnDel.addEventListener('click', async (e) => {
            e.stopPropagation();
            await removeKnowledgeSlot(slot.id);
          });

          itemEl.appendChild(infoSpan);
          itemEl.appendChild(countBadge);
          itemEl.appendChild(btnDel);
          slotsListEl.appendChild(itemEl);
        }
      }
    }
  } catch (err) {
    console.warn("Failed to get semantic state:", err);
  }
}

export async function addKnowledgeSlot() {
  if (window.engineAPI && window.engineAPI.addKnowledgeSlot) {
    try {
      const res = await window.engineAPI.addKnowledgeSlot();
      if (res && res.success) {
        if (res.data) setKnowledgeItems(res.data);
        await updateSemanticStateDisplay();
        resetVectorSearchResults();
        refreshLinter();
        return res;
      }
    } catch (err) {
      console.error("Failed to add knowledge slot:", err);
    }
  }
  return null;
}

export async function removeKnowledgeSlot(slotId) {
  if (window.engineAPI && window.engineAPI.removeKnowledgeSlot) {
    try {
      const res = await window.engineAPI.removeKnowledgeSlot(slotId);
      if (res && res.success) {
        if (res.data) setKnowledgeItems(res.data);
        await updateSemanticStateDisplay();
        resetVectorSearchResults();
        refreshLinter();
        return res;
      }
    } catch (err) {
      console.error("Failed to remove knowledge slot:", err);
    }
  }
  return null;
}

export async function changeGoalProfile() {
  if (window.engineAPI && window.engineAPI.setGoalProfile) {
    try {
      const res = await window.engineAPI.setGoalProfile();
      if (res && res.success) {
        await updateSemanticStateDisplay();
        refreshLinter();
        return res;
      }
    } catch (err) {
      console.error("Failed to change goal profile:", err);
    }
  }
  return null;
}

export async function insertActiveTemplate(setEditorTextCallback) {
  if (window.engineAPI && window.engineAPI.getActiveProfile) {
    try {
      const prof = await window.engineAPI.getActiveProfile();
      if (prof?.template?.default_text) {
        if (typeof setEditorTextCallback === 'function') {
          setEditorTextCallback(prof.template.default_text);
        }
      }
    } catch (err) {
      console.error("Failed to insert active template:", err);
    }
  }
}

export async function importDictionary() {
  if (window.engineAPI && window.engineAPI.importKnowledgeBase) {
    try {
      const res = await window.engineAPI.importKnowledgeBase();
      if (res && res.success) {
        setKnowledgeItems(res.data);
        await updateSemanticStateDisplay();
        resetVectorSearchResults();
        refreshLinter();
        return res;
      }
    } catch (err) {
      console.error("Failed to import dictionary:", err);
    }
  }
  return null;
}

export async function initQuickDictionary() {
  try {
    await updateSemanticStateDisplay();

    if (window.engineAPI && window.engineAPI.getKnowledgeBase) {
      const kbItems = await window.engineAPI.getKnowledgeBase();
      if (Array.isArray(kbItems) && kbItems.length > 0) {
        setKnowledgeItems(kbItems);
        return;
      }
    }
    
    if (window.engineAPI && window.engineAPI.loadImeDict) {
      const rawText = await window.engineAPI.loadImeDict();
      if (rawText) {
        allDictEntries.length = 0;
        const lines = rawText.split('\n');
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const subtitle = parts[0].trim();
            const title = parts[1] ? parts[1].trim() : subtitle;
            const note = parts[3] || '';
            const entry = {
              item: { id: title, title: title, subtitle: subtitle, code: 'UNKNOWN' },
              note: note,
              isQuick: true
            };
            allDictEntries.push(entry);
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to load quick dictionary:", err);
  }
}

export function getQuickMatches(query, limit = 5) {
  if (!allKnowledgeItems || allKnowledgeItems.length === 0) {
    if (allDictEntries && allDictEntries.length > 0) {
      return allDictEntries.slice(0, limit).map(e => ({
        id: e.item.id,
        name: e.item.title,
        score: 0.95,
        ...e.item
      }));
    }
    return [];
  }

  const q = (query || '').trim().toLowerCase();
  if (!q) {
    return allKnowledgeItems.slice(0, limit).map(item => ({ ...item, score: 1.0 }));
  }

  const matches = [];

  for (const item of allKnowledgeItems) {
    let combinedText = '';
    for (const v of Object.values(item)) {
      if (typeof v === 'string' || typeof v === 'number') {
        combinedText += ` ${v}`;
      } else if (typeof v === 'object' && v !== null) {
        for (const subV of Object.values(v)) {
          if (typeof subV === 'string' || typeof subV === 'number') {
            combinedText += ` ${subV}`;
          }
        }
      }
    }
    combinedText = combinedText.toLowerCase();

    if (combinedText.includes(q)) {
      let score = 0.90;
      const title = (item.name || item.title || item.label || '').toLowerCase();
      const code = (item.id || item.code || '').toLowerCase();
      if (title && title === q) {
        score = 1.0;
      } else if (title && title.startsWith(q)) {
        score = 0.98;
      } else if (code && code.startsWith(q)) {
        score = 0.95;
      }
      matches.push({ ...item, score });
    }
  }

  matches.sort((a, b) => b.score - a.score);

  if (matches.length > 0) {
    return matches.slice(0, limit);
  }

  return [];
}
