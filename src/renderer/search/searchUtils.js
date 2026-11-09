// Schema-Agnostic Title & Description Resolvers (International Standard)
export function resolveItemTitle(r) {
  let title = r.title || r.name || r.label || r.prefLabel || r.term || r.text;
  if (!title && r.metadata) title = r.metadata.title || r.metadata.name || r.metadata.label || r.metadata.prefLabel;
  
  if (!title) {
    const code = resolveItemCode(r);
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'string' && v !== code && k !== 'code' && k !== 'id') {
        title = v;
        break;
      }
    }
  }
  return title || '';
}

export function resolveItemCode(r) {
  return r.code || r.id || r.key || r['@id'] || r.metadata?.code || r.metadata?.id || '';
}

export function resolveItemDescription(r) {
  let desc = r.description || r.comment || r.summary || r.definition;
  if (!desc && r.metadata) desc = r.metadata.description || r.metadata.comment || r.metadata.summary || r.metadata.definition;
  
  if (!desc) {
    let longestStr = '';
    const title = resolveItemTitle(r);
    const code = resolveItemCode(r);
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'string' && v !== title && v !== code && v.length > longestStr.length) {
        longestStr = v;
      }
    }
    desc = longestStr;
  }
  
  if (!desc || typeof desc !== 'string') return '';

  const code = resolveItemCode(r);
  const title = resolveItemTitle(r);

  // Schema-Agnostic Generic Prefix Trimmer
  let trimmed = desc;
  if (code) {
    const codeRegex = new RegExp(`^([^:]+:\\s*)?${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s:\\-–—]+`, 'i');
    trimmed = trimmed.replace(codeRegex, '').trim();
  }
  if (title && trimmed.toLowerCase().startsWith(title.toLowerCase())) {
    trimmed = trimmed.substring(title.length).replace(/^[\s:\\-–—]+/, '').trim();
  }

  return trimmed || desc;
}
