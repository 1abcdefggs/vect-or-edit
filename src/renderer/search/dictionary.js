import { resetVectorSearchResults } from './vectorSearch.js';
import { refreshLinter } from '../editor/editorManager.js';
import { icons } from '../core/icons.js';
import { i18n, t } from '../core/i18n.js';
import { confirmClose } from '../ui/notifications/closeGuard.js';
import { setLoadedSlotCount } from './searchUi.js';

export const allKnowledgeItems = [];
export const allDictEntries = [];

// A translation, or the English fallback when the key is missing (t() returns the key itself then)
function slotText(key, fallback) {
  const value = t(key);
  return value && value !== key ? value : fallback;
}

// Why a dictionary is not (fully) in the vector search, from the compatibility the main process worked out; '' when nothing to say
function slotCompatNote(slot) {
  const c = slot?.compat;
  if (!c) return '';
  if (c.state === 'excluded') {
    const key = c.reason === 'space-mismatch' ? 'slot_compat_space' : c.reason === 'dim-mismatch-mixed' ? 'slot_compat_mixed' : c.reason === 'truncation-off' ? 'slot_compat_trunc_off' : 'slot_compat_dim';
    return slotText(key, 'Left out of vector search');
  }
  if (c.state === 'approximate') return slotText('slot_compat_approx', 'Approximate: vectors are cut');
  if (c.state === 'unverified') return slotText('slot_compat_unverified', 'Embedding model not recorded');
  return '';
}

// The domain of each loaded dictionary, read once from its header and kept by slot id ('' when unknown)
const slotDomainCache = new Map();

function slotDomain(slot) {
  return slotDomainCache.get(slot.id) || '';
}

async function loadSlotDomain(slot) {
  if (slotDomainCache.has(slot.id)) return slotDomainCache.get(slot.id);
  let domain = '';
  try {
    const res = await window.engineAPI.getSlotInfo(slot.id);
    domain = res?.success && res.header?.domain ? String(res.header.domain) : '';
  } catch (err) {
    domain = '';
  }
  slotDomainCache.set(slot.id, domain);
  return domain;
}

// The header of one dictionary (domain, version, dimension, ...), as a small table. Entries are never shown.
async function renderSlotInfo(container, slot) {
  container.textContent = '';
  const note = document.createElement('div');
  note.style.cssText = 'color: var(--text-muted); margin-bottom: 4px;';
  container.appendChild(note);

  let res;
  try {
    res = await window.engineAPI.getSlotInfo(slot.id);
  } catch (err) {
    res = { success: false, error: String(err) };
  }
  if (!res?.success) {
    note.textContent = res?.error || slotText('kb_info_failed', 'Could not read this dictionary.');
    return;
  }
  if (res.encrypted) {
    note.textContent = slotText('kb_info_encrypted', 'Encrypted (VENC). Load it with its password to see the header.');
  } else {
    note.textContent = slotText('kb_info_note', 'Header only. The entries are not shown here.');
  }

  const h = res.header || {};
  const yesNo = (v) => (v === null || v === undefined ? null : (v ? 'yes' : 'no'));
  const rows = res.encrypted ? [
    [slotText('kb_info_items', 'Items'), res.itemCount],
  ] : [
    [slotText('kb_info_domain', 'Domain'), h.domain],
    [slotText('kb_info_version', 'Version'), h.version],
    [slotText('kb_info_dimension', 'Dimension'), h.dimension],
    [slotText('kb_info_metric', 'Metric'), h.metric],
    [slotText('kb_info_items', 'Items'), res.itemCount],
    [slotText('kb_info_fidelity', 'Fidelity'), h.fidelity_score == null ? null : `${h.fidelity_score} %`],
    [slotText('kb_info_sanitized', 'Sanitized'), yesNo(h.is_sanitized)],
  ];

  const table = document.createElement('table');
  table.style.cssText = 'width: 100%; border-collapse: collapse;';
  rows.forEach(([label, value]) => {
    const tr = document.createElement('tr');
    const th = document.createElement('td');
    th.style.cssText = 'color: var(--text-muted); padding: 2px 8px 2px 0; white-space: nowrap; vertical-align: top;';
    th.textContent = label;
    const td = document.createElement('td');
    td.style.cssText = 'padding: 2px 0; word-break: break-word;';
    td.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
    tr.appendChild(th);
    tr.appendChild(td);
    table.appendChild(tr);
  });
  container.appendChild(table);
}

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
      if (btnInsertTemplate) {
        btnInsertTemplate.style.display = hasTemplate ? 'inline-flex' : 'none';
      }
    } else {
      const btnResetGoal = document.getElementById('btnResetGoal');
      if (btnResetGoal) btnResetGoal.style.display = 'none';
      if (btnInsertTemplate) btnInsertTemplate.style.display = 'none';
    }

    // Guideline card: say what it is for while no guideline is loaded, so it is not an empty box
    const guidelineCard = document.getElementById('guidelineModuleCard');
    if (guidelineCard) {
      guidelineCard.querySelector('.guideline-empty-hint')?.remove();
      if (!state?.activeGoal) {
        const hint = document.createElement('ul');
        hint.className = 'guideline-empty-hint';
        hint.style.cssText = 'margin: 0; padding: 4px 10px 8px 26px; font-size: var(--fs-11); line-height: 1.6; color: var(--text-muted);';
        ['guideline_hint_1', 'guideline_hint_2', 'guideline_hint_3'].forEach((key) => {
          const item = document.createElement('li');
          item.textContent = t(key);
          hint.appendChild(item);
        });
        // The card's body is what collapses, so the hint goes inside it
        let body = guidelineCard.querySelector('.semantic-module-body');
        if (!body) {
          body = document.createElement('div');
          body.className = 'semantic-module-body';
          guidelineCard.appendChild(body);
        }
        body.appendChild(hint);
      }
    }

    // Toggle Clear All Slots button & Search Filters Container
    const btnClearAllSlots = document.getElementById('btnClearAllSlots');
    const searchFiltersContainer = document.getElementById('searchFiltersContainer');
    const hasSlots = (state?.slots && state.slots.length > 0);
    const slots = state?.slots || [];
    setLoadedSlotCount(slots.length, slots.filter((s) => s.compat?.state !== 'excluded').length);

    // "Unload All" only makes sense with two or more files; with one file the row's X is the way (ADR-11)
    if (btnClearAllSlots) {
      btnClearAllSlots.style.display = (state?.slots?.length ?? 0) >= 2 ? 'inline-flex' : 'none';
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
      if (state?.slots?.length) {
        state.slots.forEach((slot, idx) => {
          const itemEl = document.createElement('div');
          itemEl.className = 'knowledge-slot-row';

          const leftContainer = document.createElement('div');
          leftContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;';

          // The index only: the panel's heading already says these are knowledge slots
          const slotIndexBadge = document.createElement('span');
          slotIndexBadge.className = 'knowledge-slot-index';
          slotIndexBadge.textContent = `${idx + 1}`;

          const infoSpan = document.createElement('span');
          infoSpan.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--success-color, #10b981);  font-size: var(--fs-12);';
          // The title is the dictionary's domain (from its header) when known, otherwise the file name
          infoSpan.textContent = slotDomain(slot) || slot.name;
          infoSpan.title = t('tip_slot_info', { n: idx + 1, path: slot.filePath, items: slot.itemCount.toLocaleString() });
          if (!slotDomainCache.has(slot.id)) {
            loadSlotDomain(slot).then((domain) => {
              if (domain && infoSpan.isConnected) infoSpan.textContent = domain;
            });
          }

          // Second line, under the name: the file name (its last part) and the item count, in a quiet colour
          const infoCol = document.createElement('div');
          infoCol.style.cssText = 'display: flex; flex-direction: column; min-width: 0;';
          const detailLine = document.createElement('span');
          detailLine.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-muted); font-size: var(--fs-10);';
          const itemLabel = slotText('label_items', 'items');
          const fileName = (slot.filePath || '').split(/[\\/]/).pop();
          detailLine.textContent = `${fileName} · ${slot.itemCount.toLocaleString()} ${itemLabel}`;
          const compatNote = slotCompatNote(slot);
          if (compatNote) {
            detailLine.textContent += ` · ${compatNote}`;
            detailLine.title = compatNote;
          }
          infoCol.appendChild(infoSpan);
          infoCol.appendChild(detailLine);

          leftContainer.appendChild(slotIndexBadge);
          leftContainer.appendChild(infoCol);

          const rightContainer = document.createElement('div');
          rightContainer.style.cssText = 'display: flex; align-items: center; gap: 4px; flex-shrink: 0;';

          const btnDel = document.createElement('button');
          btnDel.className = 'toolbar-btn';
          btnDel.style.cssText = 'background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 2px 4px; font-size: var(--fs-12); line-height: 1; display: flex; align-items: center; justify-content: center; border-radius: 3px; transition: color 0.15s ease, background 0.15s ease;';
          btnDel.innerHTML = icons.delete || '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
          btnDel.title = t('tip_slot_unload', { name: slot.name });
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
            if (await confirmClose('slot', { name: slot.name })) await removeKnowledgeSlot(slot.id);
          });

          rightContainer.appendChild(btnDel);

          // Info: the dictionary header (domain, version, dimension, ...) under the row, read on first open
          const btnInfo = document.createElement('button');
          btnInfo.type = 'button';
          btnInfo.className = 'toolbar-btn';
          btnInfo.style.cssText = 'background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 2px 4px; font-size: var(--fs-11); line-height: 1;';
          btnInfo.textContent = slotText('kb_info_btn', 'Info');
          btnInfo.title = slotText('kb_info_tip', 'Show the dictionary header');
          rightContainer.insertBefore(btnInfo, btnDel);

          // Read on first open only: each render would otherwise ask the main process to parse every file
          const detailsEl = document.createElement('div');
          detailsEl.hidden = true;
          detailsEl.style.cssText = 'padding: 6px 8px 8px 26px; font-size: var(--fs-11); color: var(--text-main);';
          btnInfo.addEventListener('click', async (e) => {
            e.stopPropagation();
            detailsEl.hidden = !detailsEl.hidden;
            btnInfo.setAttribute('aria-expanded', String(!detailsEl.hidden));
            if (!detailsEl.hidden && !detailsEl.dataset.loaded) {
              detailsEl.dataset.loaded = '1';
              await renderSlotInfo(detailsEl, slot);
            }
          });
          btnInfo.setAttribute('aria-expanded', 'false');

          itemEl.appendChild(leftContainer);
          itemEl.appendChild(rightContainer);
          const wrapEl = document.createElement('div');
          wrapEl.style.cssText = 'display: flex; flex-direction: column;';
          wrapEl.appendChild(itemEl);
          wrapEl.appendChild(detailsEl);
          slotsListEl.appendChild(wrapEl);
        });
      } else {
        // No slot loaded: the section says what it is for, so it is not an empty box
        const hint = document.createElement('ul');
        hint.className = 'knowledge-empty-hint';
        hint.style.cssText = 'margin: 0; padding: 4px 6px 4px 20px; font-size: var(--fs-11); line-height: 1.6; color: var(--text-muted);';
        ['knowledge_hint_1', 'knowledge_hint_2', 'knowledge_hint_3'].forEach((key) => {
          const item = document.createElement('li');
          item.textContent = t(key);
          hint.appendChild(item);
        });
        slotsListEl.appendChild(hint);
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
    modal.style.cssText = 'background:var(--bg-panel);border:var(--border-width) solid var(--border-color);border-radius:8px;padding:20px;width:320px;box-shadow:0 10px 25px rgba(0,0,0,0.3);display:flex;flex-direction:column;gap:15px;font-family:inherit;';
    
    const title = document.createElement('div');
    title.textContent = `Encrypted Knowledge Slot`;
    title.style.cssText = 'font-weight:600;color:var(--text-color);font-size:var(--fs-15);';
    
    const desc = document.createElement('div');
    desc.textContent = `Password required for: ${filename}`;
    desc.style.cssText = 'color:var(--text-muted);font-size:var(--fs-12);word-break:break-all;';
    
    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = 'Enter password...';
    input.style.cssText = 'padding:10px;border:var(--border-width) solid var(--border-color);border-radius:6px;background:var(--bg-input);color:var(--text-color);outline:none;font-size:var(--fs-14);';
    
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:5px;';
    
    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancel';
    btnCancel.style.cssText = 'padding:6px 12px;border:var(--border-width) solid var(--border-color);border-radius:4px;background:transparent;color:var(--text-muted);cursor:pointer;font-size:var(--fs-13);';
    
    const btnSubmit = document.createElement('button');
    btnSubmit.textContent = 'Unlock';
    btnSubmit.style.cssText = 'padding:6px 12px;border:none;border-radius:4px;background:var(--accent-color, #007acc);color:#fff;cursor:pointer;font-size:var(--fs-13);';
    
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
      } else if (res && !res.success && !res.canceled) {
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

// The selected embedding model changed what can be compared: draw the dictionary list again
if (typeof window !== 'undefined') {
  window.addEventListener('app:slotCompatChanged', () => { updateSemanticStateDisplay(); });
}
