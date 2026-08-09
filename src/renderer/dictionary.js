let quickDictTrie = null;

class TrieNode {
  constructor() {
    this.children = new Map();
    this.entries = [];
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }
  insert(word, entry) {
    let node = this.root;
    for (const char of word.toLowerCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char);
    }
    node.entries.push(entry);
  }
  searchPrefix(prefix) {
    let node = this.root;
    for (const char of prefix.toLowerCase()) {
      if (!node.children.has(char)) return [];
      node = node.children.get(char);
    }
    return this._collectEntries(node);
  }
  _collectEntries(node) {
    let results = [...node.entries];
    for (const child of node.children.values()) {
      results = results.concat(this._collectEntries(child));
    }
    return results;
  }
}

export let allDictEntries = [];

export async function initQuickDictionary() {
  try {
    quickDictTrie = new Trie();
    if (window.engineAPI && window.engineAPI.loadImeDict) {
      const rawText = await window.engineAPI.loadImeDict();
      if (rawText) {
        const lines = rawText.split('\n');
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const subtitle = parts[0].trim();
            const title = parts[1] ? parts[1].trim() : subtitle;
            const note = parts[3] || '';
            
            const codePrefix = 'Code:';
            let itemCode = 'UNKNOWN';
            
            if (note.includes(codePrefix)) {
              const sub = note.substring(note.indexOf(codePrefix) + codePrefix.length).trim();
              itemCode = sub.split(/[ |]/)[0].trim() || 'UNKNOWN';
            }

            const entry = {
              item: { id: title, title: title, subtitle: subtitle, code: itemCode },
              note: note,
              isQuick: true
            };
            
            quickDictTrie.insert(title, entry);
            quickDictTrie.insert(subtitle, entry);
            if (itemCode !== 'UNKNOWN') quickDictTrie.insert(itemCode, entry);
            allDictEntries.push(entry);
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to load quick IME dictionary:", err);
  }
}

export function getQuickMatches(query, limit = 5) {
  if (!query || !quickDictTrie) return [];
  const results = quickDictTrie.searchPrefix(query);
  
  // Deduplicate entries based on title
  const unique = [];
  const seen = new Set();
  for (const r of results) {
    if (!seen.has(r.item.title)) {
      seen.add(r.item.title);
      unique.push({ ...r, score: 0.90 });
      if (unique.length >= limit) break;
    }
  }
  return unique;
}
