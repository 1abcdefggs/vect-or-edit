import { resetVectorSearchResults } from './vectorSearch.js';
import { refreshLinter } from '../editor/editorManager.js';
import { icons } from '../core/icons.js';
import { i18n, t } from '../core/i18n.js';

export const allKnowledgeItems = [];
export const allDictEntries = [];

function katakanaToHiragana(src) {
  return typeof src === 'string' ? src.replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60)) : '';
}
function hiraganaToKatakana(src) {
  return typeof src === 'string' ? src.replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60)) : '';
}

export function setKnowledgeItems(kbItems) {
  allKnowledgeItems.length = 0;
  allDictEntries.length = 0;

  if (Array.isArray(kbItems)) {
    allKnowledgeItems.push(...kbItems);
    for (const item of kbItems) {
      const title = item.title || item.name || item.label || item.prefLabel || item.term || item.text || item.id || '';
      const code = item.code || item.id || item.key || item['@id'] || '';
      const desc = item.description || item.comment || item.summary || item.definition || '';
      const kana = item.name_kana || item.metadata?.name_kana || '';
      const hira = katakanaToHiragana(kana || title);
      const kata = hiraganaToKatakana(kana || title);

      allDictEntries.push({
        item: {
          id: code || title,
          title: title,
          subtitle: desc || code,
          code: code,
          kana: kana,
          hira: hira,
          kata: kata
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
        profileHeaderLabelEl.textContent = isGuideline ? (t('active_guideline_preset_label') || 'Guideline') : 'Preset';
      }

      const btnResetGoal = document.getElementById('btnResetGoal');
      if (btnResetGoal) {
        btnResetGoal.style.display = 'inline-flex';
      }
      if (activeProfileEl) {
        activeProfileEl.textContent = g.domain_name || g.profile_id || 'Custom Profile';
        activeProfileEl.title = `${g.domain_name || g.profile_id}\n${g.description || ''}`;
      }
      if (activeRuleCountEl) {
        activeRuleCountEl.textContent = `${ruleCount} ${t('label_rules') || 'rules'}`;
      }
      if (btnInsertTemplate) {
        btnInsertTemplate.style.display = hasTemplate ? 'inline-flex' : 'none';
      }
    } else {
      const btnResetGoal = document.getElementById('btnResetGoal');
      if (btnResetGoal) btnResetGoal.style.display = 'none';
      if (activeProfileEl) activeProfileEl.textContent = t('default_profile') || 'Default Profile (Unrestricted)';
      if (activeRuleCountEl) activeRuleCountEl.textContent = t('rule_count_zero') || '0 rules';
      if (btnInsertTemplate) btnInsertTemplate.style.display = 'none';
    }

    // Toggle Clear All Slots button & Search Filters Container
    const btnClearAllSlots = document.getElementById('btnClearAllSlots');
    const searchFiltersContainer = document.getElementById('searchFiltersContainer');
    const hasSlots = (state?.slots && state.slots.length > 0);

    if (btnClearAllSlots) {
      btnClearAllSlots.style.display = hasSlots ? 'inline-flex' : 'none';
    }
    if (searchFiltersContainer) {
      searchFiltersContainer.style.display = hasSlots ? 'flex' : 'none';
    }

    // 2. Render Knowledge Slots (Matching Guideline UI/UX)
    const countBadgeEl = document.getElementById('knowledgeSlotsCountBadge');
    if (countBadgeEl) {
      const slotCount = state?.slots?.length || 0;
      countBadgeEl.textContent = `${slotCount} ${t('label_slots') || 'Slots'}`;
    }

    if (slotsListEl) {
      slotsListEl.innerHTML = '';
      if (!state?.slots || state.slots.length === 0) {
        const itemLabel = t('label_items') === 'label_items' ? 'items' : t('label_items');
        slotsListEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; overflow: hidden; padding: 2px 0;">
            <span style="font-size: 0.8rem;  color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" data-i18n="slots_empty_placeholder">
              ${t('slots_empty_placeholder') || 'No Knowledge Base'}
            </span>
            <span style="font-size: 0.65rem; color: var(--text-muted); flex-shrink: 0;">0 ${itemLabel}</span>
          </div>
        `;
      } else {
        state.slots.forEach((slot, idx) => {
          const itemEl = document.createElement('div');
          itemEl.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.75rem; gap: 6px;';
          
          const leftContainer = document.createElement('div');
          leftContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;';

          const slotIndexBadge = document.createElement('span');
          slotIndexBadge.style.cssText = 'font-size: 0.62rem;  font-family: var(--font-mono, monospace); color: var(--accent-color, #38bdf8); background: rgba(56, 189, 248, 0.12); padding: 1px 4px; border-radius: 3px; flex-shrink: 0;';
          slotIndexBadge.textContent = `SLOT ${idx + 1}`;

          const infoSpan = document.createElement('span');
          infoSpan.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--success-color, #10b981);  font-size: 0.76rem;';
          infoSpan.textContent = slot.name;
          infoSpan.title = `[SLOT ${idx + 1}] ${slot.filePath}\nItems: ${slot.itemCount.toLocaleString()}\nMulti-slot indexing active.`;

          leftContainer.appendChild(slotIndexBadge);
          leftContainer.appendChild(infoSpan);

          const rightContainer = document.createElement('div');
          rightContainer.style.cssText = 'display: flex; align-items: center; gap: 4px; flex-shrink: 0;';

          const countBadge = document.createElement('span');
          countBadge.style.cssText = 'font-size: 0.65rem; color: var(--text-muted); ';
          const itemLabel = t('label_items') === 'label_items' ? 'items' : t('label_items');
          countBadge.textContent = `${slot.itemCount.toLocaleString()} ${itemLabel}`;

          const btnDel = document.createElement('button');
          btnDel.className = 'toolbar-btn';
          btnDel.style.cssText = 'background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 2px 4px; font-size: 0.75rem; line-height: 1; display: flex; align-items: center; justify-content: center; border-radius: 3px; transition: color 0.15s ease, background 0.15s ease;';
          btnDel.innerHTML = icons.delete || '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
          btnDel.title = `Unload ${slot.name}`;
          btnDel.addEventListener('mouseenter', () => {
            btnDel.style.color = '#ef4444';
            btnDel.style.background = 'rgba(239, 68, 68, 0.12)';
          });
          btnDel.addEventListener('mouseleave', () => {
            btnDel.style.color = 'var(--text-muted)';
            btnDel.style.background = 'transparent';
          });
          btnDel.addEventListener('click', async (e) => {
            e.stopPropagation();
            await removeKnowledgeSlot(slot.id);
          });

          rightContainer.appendChild(countBadge);
          rightContainer.appendChild(btnDel);

          itemEl.appendChild(leftContainer);
          itemEl.appendChild(rightContainer);
          slotsListEl.appendChild(itemEl);
        });
      }
    }
  } catch (err) {
    console.warn("Failed to get semantic state:", err);
  }
}

function promptForPassword(filePath) {
  return new Promise((resolve) => {
    const filename = filePath.split(/[\\/]/).pop();
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(2px);';
    
    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg-panel);border:1px solid var(--border-color);border-radius:8px;padding:20px;width:320px;box-shadow:0 10px 25px rgba(0,0,0,0.3);display:flex;flex-direction:column;gap:15px;font-family:inherit;';
    
    const title = document.createElement('div');
    title.textContent = `Encrypted Knowledge Slot`;
    title.style.cssText = 'font-weight:600;color:var(--text-color);font-size:15px;';
    
    const desc = document.createElement('div');
    desc.textContent = `Password required for: ${filename}`;
    desc.style.cssText = 'color:var(--text-muted);font-size:12px;word-break:break-all;';
    
    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = 'Enter password...';
    input.style.cssText = 'padding:10px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-input);color:var(--text-color);outline:none;font-size:14px;';
    
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:5px;';
    
    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancel';
    btnCancel.style.cssText = 'padding:6px 12px;border:1px solid var(--border-color);border-radius:4px;background:transparent;color:var(--text-muted);cursor:pointer;font-size:13px;';
    
    const btnSubmit = document.createElement('button');
    btnSubmit.textContent = 'Unlock';
    btnSubmit.style.cssText = 'padding:6px 12px;border:none;border-radius:4px;background:var(--accent-color, #007acc);color:#fff;cursor:pointer;font-size:13px;';
    
    btnRow.appendChild(btnCancel);
    btnRow.appendChild(btnSubmit);
    
    modal.appendChild(title);
    modal.appendChild(desc);
    modal.appendChild(input);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    input.focus();
    
    const cleanup = () => document.body.removeChild(overlay);
    
    btnCancel.onclick = () => { cleanup(); resolve(null); };
    btnSubmit.onclick = () => { cleanup(); resolve(input.value); };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') { cleanup(); resolve(input.value); }
      if (e.key === 'Escape') { cleanup(); resolve(null); }
    };
  });
}

export async function addKnowledgeSlot() {
  if (window.engineAPI && window.engineAPI.addKnowledgeSlot) {
    try {
      let res = await window.engineAPI.addKnowledgeSlot();
      if (res && res.requiresPassword) {
        const pwd = await promptForPassword(res.filePath);
        if (pwd) {
          res = await window.engineAPI.addKnowledgeSlot(res.filePath, pwd);
        } else {
          return null;
        }
      }
      if (res && res.success) {
        if (res.data) setKnowledgeItems(res.data);
        await updateSemanticStateDisplay();
        resetVectorSearchResults();
        refreshLinter();
        return res;
      } else if (res && !res.success) {
        const errorMsg = res.errorCode ? t(res.errorCode, res.errorParams || {}) : (res.error || t('error_slot_add', { message: 'Unknown' }));
        alert(errorMsg);
      }
    } catch (err) {
      console.error("Failed to add knowledge slot:", err);
      alert(t('error_slot_add', { message: err.message }));
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

export async function resetGoalProfile() {
  if (window.engineAPI && window.engineAPI.resetGoalProfile) {
    try {
      await window.engineAPI.resetGoalProfile();
    } catch (e) {
      console.warn("resetGoalProfile failed:", e);
    }
  }
  await updateSemanticStateDisplay();
  refreshLinter();
}

export async function clearAllKnowledgeSlots() {
  if (window.engineAPI && window.engineAPI.clearAllKnowledgeSlots) {
    try {
      const res = await window.engineAPI.clearAllKnowledgeSlots();
      if (res && res.success) {
        setKnowledgeItems([]);
        await updateSemanticStateDisplay();
        resetVectorSearchResults();
        refreshLinter();
        return res;
      }
    } catch (err) {
      console.error("Failed to clear all knowledge slots:", err);
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
