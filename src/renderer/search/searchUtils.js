// Schema-Agnostic Title & Description Resolvers (International Standard)
export function resolveItemTitle(r) {
  return r.title || r.name || r.label || r.prefLabel || r.term || r.text || '';
}

export function resolveItemCode(r) {
  return r.code || r.id || r.key || r['@id'] || '';
}

export function resolveItemDescription(r) {
  let desc = r.description || r.comment || r.summary || r.definition || '';
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
